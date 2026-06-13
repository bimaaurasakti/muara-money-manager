'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  initializeGoogleDrive,
  signInWithGoogle,
  signOutFromGoogle,
  downloadFromDrive,
  uploadToDrive,
  isSignedInToGoogle,
  getUserInfo,
} from '@/lib/google-drive';
import type { Transaction } from '@/types/transaction';
import { mergeTransactions } from '@/features/sync/merge';
import { clearStoredData, getStoredData, saveStoredData } from '@/store/storage';
import { useTransactionStore } from '@/store/transactionStore';
import { toast } from 'sonner';
import { isOnline } from '@/utils/offlineManager';

export function useGoogleDriveSync() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Inisialisasi Google Drive + restore login state jika token masih valid
  useEffect(() => {
    const initGoogle = async () => {
      setIsInitializing(true);
      await initializeGoogleDrive();

      const stillSignedIn = isSignedInToGoogle();
      if (stillSignedIn) {
        setIsSignedIn(true);
        const userInfo = await getUserInfo();
        setUser(userInfo);

        const storedData = getStoredData();
        if (userInfo && storedData.user && userInfo.id !== storedData.user.id) {
          clearStoredData();
          useTransactionStore.getState().clearAll();
        }
      }
      setIsInitializing(false);
    };
    initGoogle();
  }, []);

  const checkSignInStatus = useCallback(() => {
    const signedIn = isSignedInToGoogle();
    setIsSignedIn(signedIn);
    return signedIn;
  }, []);

  /**
   * Login ke Google
   */
  const signIn = useCallback(async () => {
    setError(null);
    try {
      await signInWithGoogle();
      const userInfo = await getUserInfo();

      if (userInfo) {
        const storedData = getStoredData();
        if (storedData.user && storedData.user.id !== userInfo.id) {
          clearStoredData();
          useTransactionStore.getState().clearAll();
        }

        setIsSignedIn(true);
        setUser(userInfo);
        saveStoredData({ user: userInfo });
        return true;
      }
      return false;
    } catch (err: any) {
      const errorMessage = err.message === 'popup_closed_by_user' || err.message === 'access_denied'
        ? 'Login dibatalkan oleh pengguna'
        : (err.message || 'Gagal login ke Google');
      setError(errorMessage);
      return false;
    }
  }, []);

  /**
   * Logout
   */
  const signOut = useCallback(() => {
    signOutFromGoogle();
    clearStoredData();
    useTransactionStore.getState().clearAll();

    setIsSignedIn(false);
    setUser(null);
    setLastSyncTime(null);
  }, []);

  /**
   * Sinkronisasi penuh (Download → Merge → Upload)
   */
  const syncNow = useCallback(async (
    currentLocalTransactions: Transaction[],
    onMerged: (merged: Transaction[]) => void
  ) => {
    if (!isSignedInToGoogle()) {
      return false;
    }

    if (!isOnline()) {
      toast.info('Offline: Sinkronisasi akan dilakukan saat koneksi kembali online.', {
        id: 'sync-offline'
      });
      return false;
    }

    setIsSyncing(true);
    setError(null);

    // Tampilkan toast loading hanya jika proses terasa lama (> 1 detik)
    const toastId = setTimeout(() => {
      toast.loading('Menyelaraskan data...', { id: 'sync-loading' });
    }, 1000);

    try {
      // 1. Download data dari Drive
      const remoteData = await downloadFromDrive();

      let mergedTransactions = currentLocalTransactions;

      if (remoteData?.transactions) {
        // 2. Merge dengan local data
        const result = mergeTransactions(currentLocalTransactions, remoteData.transactions);
        mergedTransactions = result.mergedTransactions;

        if (result.hasChanges) {
          onMerged(mergedTransactions);
        }
      }

      // 3. Upload data yang sudah di-merge
      const uploadSuccess = await uploadToDrive({
        version: 1,
        lastSync: new Date().toISOString(),
        deviceId: 'web-' + Date.now(),
        transactions: mergedTransactions,
      });

      if (uploadSuccess) {
        clearTimeout(toastId);
        toast.success('Data tersinkronisasi', { id: 'sync-loading', duration: 2000 });
        setLastSyncTime(new Date().toISOString());

        // Bersihkan queue jika ada
        const { removeFromQueue, syncQueue } = useTransactionStore.getState();
        if (syncQueue.length > 0) {
          removeFromQueue(syncQueue);
        }

        return true;
      } else {
        throw new Error('Gagal mengupload data');
      }
    } catch (err: any) {
      clearTimeout(toastId);
      toast.error('Gagal menyelaraskan. Perubahan disimpan lokal.', { id: 'sync-loading' });
      setError(err.message || 'Terjadi kesalahan saat sinkronisasi');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /**
   * Sinkronisasi dengan Debounce
   */
  const syncWithDebounce = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      const state = useTransactionStore.getState();
      const stillSignedIn = isSignedInToGoogle();

      if (stillSignedIn) {
        await syncNow(state.transactions, (merged) => {
          state.replaceTransactions(merged);
        });
      } else if (user) {
        // Pernah login tapi token habis, ingatkan untuk re-auth
        toast.error('Sesi Google Drive berakhir. Silakan login kembali.', {
          action: {
            label: 'Login',
            onClick: () => signIn()
          }
        });
      }
    }, 3000); // 3 detik debounce
  }, [syncNow, user, signIn]);

  return {
    isSignedIn,
    isSyncing,
    lastSyncTime,
    error,
    signIn,
    signOut,
    syncNow,
    syncWithDebounce,
    checkSignInStatus,
  };
}