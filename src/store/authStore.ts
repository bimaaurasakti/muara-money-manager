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

interface AuthState {
  isSignedIn: boolean;
  isInitializing: boolean;
  isSyncing: boolean;
  user: { id: string; email: string; name: string } | null;
  error: string | null;
  lastSyncTime: string | null;

  // Actions
  initialize: () => Promise<void>;
  signIn: () => Promise<boolean>;
  signOut: () => void;
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
      user: null,
      error: null,
      lastSyncTime: null,

      initialize: async () => {
        set({ isInitializing: true });
        try {
          await initializeGoogleDrive();
          const signedIn = isSignedInToGoogle();
          
          const storedData = getStoredData();
          
          if (signedIn) {
            const user = await getUserInfo();
            
            // Validasi: Jika user yang login berbeda dengan data di storage, bersihkan storage
            if (user && storedData.user && user.id !== storedData.user.id) {
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
        } catch (error) {
          console.error('Failed to initialize Google Drive', error);
        } finally {
          set({ isInitializing: false });
        }
      },

      signIn: async () => {
        set({ error: null });
        try {
          await signInWithGoogle();
          const user = await getUserInfo();
          
          if (user) {
            const storedData = getStoredData();
            // Jika ada data lokal dari user lain, bersihkan dulu sebelum login
            if (storedData.user && storedData.user.id !== user.id) {
              clearStoredData();
              useTransactionStore.getState().clearAll();
            }
            
            set({ isSignedIn: true, user });
            saveStoredData({ user });
            return true;
          }
          return false;
        } catch (err: any) {
          set({ error: err.message || 'Login gagal' });
          return false;
        }
      },

      signOut: () => {
        signOutFromGoogle();
        // Bersihkan data lokal saat logout untuk keamanan & mencegah data overlap
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
