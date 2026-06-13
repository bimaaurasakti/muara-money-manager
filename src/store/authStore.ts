import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import {
  initializeGoogleDrive,
  signInWithGoogle,
  signOutFromGoogle,
  isSignedInToGoogle,
  downloadFromDrive,
  uploadToDrive,
} from '@/lib/google-drive';
import { mergeTransactions } from '@/features/sync/merge';
import type { Transaction } from '@/types/transaction';
import { getStoredData, saveStoredData } from './storage';

interface AuthState {
  isSignedIn: boolean;
  isInitializing: boolean;
  isSyncing: boolean;
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
      error: null,
      lastSyncTime: null,

      initialize: async () => {
        set({ isInitializing: true });
        try {
          await initializeGoogleDrive();
          const signedIn = isSignedInToGoogle();
          set({ isSignedIn: signedIn });

          // Ambil lastSyncTime dari centralized storage
          const data = getStoredData();
          if (data.lastSyncTime) {
            set({ lastSyncTime: data.lastSyncTime });
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
          set({ isSignedIn: true });
          return true;
        } catch (err: any) {
          set({ error: err.message || 'Login gagal' });
          return false;
        }
      },

      signOut: () => {
        signOutFromGoogle();
        set({
          isSignedIn: false,
          lastSyncTime: null,
          error: null,
        });
        // Data di money_manager_data tetap dipertahankan setelah logout.
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
