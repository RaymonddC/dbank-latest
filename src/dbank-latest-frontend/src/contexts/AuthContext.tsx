import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Actor, HttpAgent, type Identity } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import type { Principal } from '@dfinity/principal';
import { idlFactory, canisterId } from '../../../declarations/dbank-latest-backend';
import type { _SERVICE } from '../../../declarations/dbank-latest-backend/dbank-latest-backend.did';

type DBankActor = _SERVICE;

interface AuthContextValue {
  isAuthenticated: boolean;
  isReady: boolean;
  identity: Identity | null;
  principal: Principal | null;
  actor: DBankActor | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const isLocal = process.env.DFX_NETWORK !== 'ic';
const host = isLocal ? 'http://localhost:4943' : 'https://ic0.app';
const identityProvider = isLocal
  ? `http://${process.env.CANISTER_ID_INTERNET_IDENTITY}.localhost:4943`
  : 'https://identity.ic0.app';

async function buildActor(identity: Identity): Promise<DBankActor> {
  const agent = await HttpAgent.create({ identity, host, shouldFetchRootKey: isLocal });
  return Actor.createActor<DBankActor>(idlFactory, { agent, canisterId });
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authClient, setAuthClient] = useState<AuthClient | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [actor, setActor] = useState<DBankActor | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = await AuthClient.create();
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

  const login = useCallback(async () => {
    if (!authClient) return;
    await new Promise<void>((resolve, reject) => {
      authClient.login({
        identityProvider,
        maxTimeToLive: BigInt(7 * 24 * 60 * 60 * 1_000_000_000), // 7 days
        onSuccess: () => resolve(),
        onError: (err) => reject(new Error(err ?? 'Sign-in cancelled')),
      });
    });
    const id = authClient.getIdentity();
    const a = await buildActor(id);
    setIdentity(id);
    setActor(a);
  }, [authClient]);

  const logout = useCallback(async () => {
    if (!authClient) return;
    await authClient.logout();
    setIdentity(null);
    setActor(null);
  }, [authClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: identity !== null && !identity.getPrincipal().isAnonymous(),
      isReady,
      identity,
      principal: identity?.getPrincipal() ?? null,
      actor,
      login,
      logout,
    }),
    [identity, actor, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
