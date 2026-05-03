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
import { Actor, HttpAgent, type Identity } from '@icp-sdk/core/agent';
import { AuthClient } from '@icp-sdk/auth/client';
import { Principal } from '@icp-sdk/core/principal';
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
      try {
        // @icp-sdk/auth: AuthClient is now a synchronous constructor;
        // identityProvider lives on the constructor options, not on signIn.
        const client = new AuthClient({
          identityProvider,
          idleOptions: {
            idleTimeout: IDLE_TIMEOUT_MS,
            disableDefaultIdleCallback: true,
          },
        });
        // Build the heartbeat actor first; if this throws (replica down,
        // root key fetch fails) we still want the gate to open with a
        // surfaceable error instead of hanging "Loading…" forever.
        try {
          heartbeatActorRef.current = await buildAnonymousActor();
        } catch (err) {
          if (!cancelled) {
            toast.error('Could not connect to the canister', {
              description: err instanceof Error ? err.message : String(err),
            });
          }
        }
        const authed = await client.isAuthenticated();
        if (cancelled) return;
        setAuthClient(client);
        if (authed) {
          const id = await client.getIdentity();
          const a = await buildActor(id);
          if (cancelled) return;
          setIdentity(id);
          setActor(a);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error('Could not initialise the wallet', {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        // Always open the gate. If init failed, the user sees an error
        // toast and the connection banner; the page is at least usable.
        if (!cancelled) setIsReady(true);
      }
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

  // H1: IdleManager has no `unregister` method, so naive
  // registerCallback-on-every-effect-run accumulates callbacks. We capture
  // the latest `logout` in a ref and register a single stable trampoline
  // exactly once per AuthClient instance.
  const logoutRef = useRef<typeof logout>(logout);
  useEffect(() => {
    logoutRef.current = logout;
  }, [logout]);

  const idleRegisteredRef = useRef<AuthClient | null>(null);
  useEffect(() => {
    if (!authClient || !identity) return;
    if (idleRegisteredRef.current === authClient) return;
    const idleManager = authClient.idleManager;
    if (!idleManager) return;
    idleManager.registerCallback(() => {
      void logoutRef.current('idle');
    });
    idleRegisteredRef.current = authClient;
  }, [authClient, identity]);

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
    // signIn() replaces the old login(...). It returns the Identity directly
    // and throws on cancel/error — no onSuccess/onError callbacks.
    const id = await authClient.signIn({ maxTimeToLive: SESSION_TTL_NS });
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
