import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AccountSession = {
  token: string;
  userId: string;
  signedInAt: number;
};

interface AccountState {
  session: AccountSession | null;
  setSession: (session: AccountSession | null) => void;
  signOut: () => void;
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      signOut: () => set({ session: null })
    }),
    { name: 'aetherforge-account' }
  )
);
