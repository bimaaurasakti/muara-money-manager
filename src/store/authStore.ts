import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import {
  initializeGoogleDrive,
  signInWithGoogle,
  signOutFromGoogle,
  isSignedInToGoogle,
  downloadFromDrive,
  uploadToDrive,
  getUserInfo,
} from '@/lib/google-drive';
import { mergeTransactions } from '@/features/sync/merge';
import type { Transaction } from '@/types/transaction';
import { getStoredData, saveStoredData, clearStoredData } from './storage';
import { useTransactionStore } from './transactionStore';
import { auth } from '@/lib/firebase';

interface AuthState {
  isSignedIn: boolean;
  isInitializing: boolean;
  isSyncing: boolean;
  isSigningIn: boolean;
  user: { id: string; email: string; name: string } | null;
  error: string | null;
  lastSyncTime: string | null;

  // Actions
  initialize: () => Promise<void>;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
  syncNow: (
    currentTransactions: Transaction[],
    onMerged: (merged: Transaction[]) => void
  ) => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
    (set, get) => ({
      isSignedIn: false,
      isInitializing: true,
      isSyncing: false,
      isSigningIn: false,
      user: null,
      error: null,
      lastSyncTime: null,

      initialize: async () => {
        set({ isInitializing: true });
        try {
          await initializeGoogleDrive();
          
          await new Promise<void>((resolve) => {
            const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
              const storedData = getStoredData();
              
              if (firebaseUser) {
                const user = {
                  id: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  name: firebaseUser.displayName || '',
                };

                if (storedData.user && user.id !== storedData.user.id) {
                  console.warn('User mismatch detected. Clearing local data.');
                  clearStoredData();
                  useTransactionStore.getState().clearAll();
                  set({ user, isSignedIn: true, lastSyncTime: null });
                } else {
                  set({ user, isSignedIn: true, lastSyncTime: storedData.lastSyncTime || null });
                }
              } else {
                set({ isSignedIn: false, user: null, lastSyncTime: storedData.lastSyncTime || null });
              }
              resolve();
            });
          });
        } catch (error) {
          console.error('Failed to initialize Google Drive', error);
        } finally {
          set({ isInitializing: false });
        }
      },

      signIn: async () => {
        if (get().isSigningIn) return false;
        set({ error: null, isSigningIn: true });
        try {
          await signInWithGoogle();
          const user = await getUserInfo();
          
          if (user) {
            const storedData = getStoredData();
            if (storedData.user && storedData.user.id !== user.id) {
              clearStoredData();
              useTransactionStore.getState().clearAll();
            }
            
            set({ isSignedIn: true, user, isSigningIn: false });
            saveStoredData({ user });
            return true;
          }
          set({ isSigningIn: false });
          return false;
        } catch (err: any) {
          const errorMessage = err.message === 'popup_closed_by_user' || err.message === 'access_denied'
            ? 'Login dibatalkan oleh pengguna'
            : (err.message || 'Gagal login ke Google');
          set({ error: errorMessage, isSigningIn: false });
          return false;
        }
      },

      signOut: async () => {
        await signOutFromGoogle();
        clearStoredData();
        useTransactionStore.getState().clearAll();
        
        set({
          isSignedIn: false,
          user: null,
          lastSyncTime: null,
          error: null,
        });
      },

      syncNow: async (currentTransactions, onMerged) => {
        if (!isSignedInToGoogle()) {
          set({ error: 'Silakan login terlebih dahulu' });
          return false;
        }

        set({ isSyncing: true, error: null });

        try {
          const remoteData = await downloadFromDrive();
          let mergedTransactions = currentTransactions;
          console.log(remoteData)
          console.log(currentTransactions)
          if (remoteData?.transactions) {
            const result = mergeTransactions(currentTransactions, remoteData.transactions);
            mergedTransactions = result.mergedTransactions;

            if (result.hasChanges) {
              onMerged(mergedTransactions);
            }
          }

          const success = await uploadToDrive({
            version: 1,
            lastSync: new Date().toISOString(),
            deviceId: 'web-client',
            transactions: mergedTransactions,
          });

          if (success) {
            const newTime = new Date().toISOString();
            set({ lastSyncTime: newTime });
            saveStoredData({ lastSyncTime: newTime });
            return true;
          }
          return false;
        } catch (err: any) {
          set({ error: err.message || 'Sinkronisasi gagal' });
          return false;
        } finally {
          set({ isSyncing: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Hanya persist data yang perlu
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
  )
);

// Auto initialize saat store pertama kali dibuat
if (typeof window !== 'undefined') {
  useAuthStore.getState().initialize();
}
