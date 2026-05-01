import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Actor, HttpAgent, type Identity } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import type { Principal } from '@dfinity/principal';
import { toast } from 'sonner';
import { idlFactory, canisterId } from '../../../declarations/dbank-latest-backend';
import type { _SERVICE } from '../../../declarations/dbank-latest-backend/dbank-latest-backend.did';

type DBankActor = _SERVICE;

export type ConnectionStatus = 'unknown' | 'ok' | 'down';

interface AuthContextValue {
  isAuthenticated: boolean;
  isReady: boolean;
  identity: Identity | null;
  principal: Principal | null;
  actor: DBankActor | null;
  connection: ConnectionStatus;
  login: () => Promise<void>;
  logout: (reason?: 'user' | 'idle' | 'expired') => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const isLocal = process.env.DFX_NETWORK !== 'ic';
const host = isLocal ? 'http://localhost:4943' : 'https://ic0.app';
const identityProvider = isLocal
  ? `http://${process.env.CANISTER_ID_INTERNET_IDENTITY}.localhost:4943`
  : 'https://identity.ic0.app';

const SESSION_TTL_NS = BigInt(7 * 24 * 60 * 60 * 1_000_000_000); // 7 days
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const DELEGATION_POLL_MS = 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;

async function buildActor(identity: Identity): Promise<DBankActor> {
  const agent = await HttpAgent.create({ identity, host, shouldFetchRootKey: isLocal });
  return Actor.createActor<DBankActor>(idlFactory, { agent, canisterId });
}

async function buildAnonymousActor(): Promise<DBankActor> {
  const agent = await HttpAgent.create({ host, shouldFetchRootKey: isLocal });
  return Actor.createActor<DBankActor>(idlFactory, { agent, canisterId });
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [actor, setActor] = useState<DBankActor | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [connection, setConnection] = useState<ConnectionStatus>('unknown');
  const heartbeatActorRef = useRef<DBankActor | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = await AuthClient.create({
        idleOptions: {
          idleTimeout: IDLE_TIMEOUT_MS,
          disableDefaultIdleCallback: true,
        },
      });
      heartbeatActorRef.current = await buildAnonymousActor();
      const authed = await client.isAuthenticated();
      if (cancelled) return;
      setAuthClient(client);
      if (authed) {
        const id = client.getIdentity();
        const a = await buildActor(id);
        if (cancelled) return;
        setIdentity(id);
        setActor(a);
      }
      setIsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(
    async (reason: 'user' | 'idle' | 'expired' = 'user') => {
      if (!authClient) return;
      await authClient.logout();
      setIdentity(null);
      setActor(null);
      if (reason === 'idle') {
        toast.info('Signed out due to inactivity', {
          description: 'Reconnect your wallet to continue.',
        });
      } else if (reason === 'expired') {
        toast.info('Session expired', {
          description: 'Please reconnect to continue.',
        });
      }
    },
    [authClient],
  );

  // Idle auto-logout via AuthClient's idle manager.
  useEffect(() => {
    if (!authClient || !identity) return;
    const idleManager = authClient.idleManager;
    if (!idleManager) return;
    idleManager.registerCallback(() => {
      void logout('idle');
    });
  }, [authClient, identity, logout]);

  // Periodic delegation-expiry poll: catches the case where the delegation
  // chain expires while the tab is open.
  useEffect(() => {
    if (!authClient || !identity) return;
    const id = window.setInterval(async () => {
      try {
        const stillAuthed = await authClient.isAuthenticated();
        if (!stillAuthed) void logout('expired');
      } catch {
        // network error — connection heartbeat will catch it
      }
    }, DELEGATION_POLL_MS);
    return () => window.clearInterval(id);
  }, [authClient, identity, logout]);

  // Connection heartbeat against the canister via an anonymous query.
  // getFees() is a cheap query and doesn't require auth.
  const lastStatusRef = useRef<ConnectionStatus>('unknown');
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      const a = heartbeatActorRef.current;
      if (!a) return;
      try {
        await a.getFees();
        if (cancelled) return;
        if (lastStatusRef.current === 'down') {
          toast.success('Reconnected to network');
        }
        lastStatusRef.current = 'ok';
        setConnection('ok');
      } catch {
        if (cancelled) return;
        if (lastStatusRef.current !== 'down') {
          toast.error('Cannot reach the canister', {
            description: 'Network or replica is unavailable. Retrying…',
          });
        }
        lastStatusRef.current = 'down';
        setConnection('down');
      }
    };
    void ping();
    const id = window.setInterval(ping, HEARTBEAT_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isReady]);

  const login = useCallback(async () => {
    if (!authClient) return;
    await new Promise<void>((resolve, reject) => {
      authClient.login({
        identityProvider,
        maxTimeToLive: SESSION_TTL_NS,
        onSuccess: () => resolve(),
        onError: (err) => reject(new Error(err ?? 'Sign-in cancelled')),
      });
    });
    const id = authClient.getIdentity();
    const a = await buildActor(id);
    setIdentity(id);
    setActor(a);
  }, [authClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: identity !== null && !identity.getPrincipal().isAnonymous(),
      isReady,
      identity,
      principal: identity?.getPrincipal() ?? null,
      actor,
      connection,
      login,
      logout,
    }),
    [identity, actor, isReady, connection, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
