import React, { createContext, useContext, useState } from 'react';
const Context = createContext<any>(null);
export function PrivyProvider({ children }: { children: React.ReactNode; appId?: string; clientId?: string }) {
  const [user, setUser] = useState<{id:string}|null>({ id: 'preview-brian' });
  return <Context.Provider value={{ user, isReady: true, getAccessToken: async () => null, logout: async () => setUser(null), signIn: async () => setUser({id:'preview-brian'}) }}>{children}</Context.Provider>;
}
export const usePrivy = () => useContext(Context);
export const PrivyElements = () => null;
export function useLoginWithSMS() { const auth = usePrivy(); return { sendCode: async () => {}, loginWithCode: auth.signIn }; }
export const useLoginWithEmail = useLoginWithSMS;
export function useLoginWithOAuth() { const auth = usePrivy(); return { login: auth.signIn }; }
export const useLinkEmail = () => ({ sendCode: async () => {}, linkWithCode: async () => {} });
export const useEmbeddedSolanaWallet = () => ({ status: 'not-created', wallets: [] });
