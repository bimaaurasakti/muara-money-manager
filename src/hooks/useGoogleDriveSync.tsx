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
import toast from 'react-hot-toast';
import { isOnline } from '@/utils/offlineManager';
import { auth } from '@/lib/firebase';

export function useGoogleDriveSync() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const isSigningInRef = useRef(false);

  // Inisialisasi Google Drive + restore login state via Firebase Auth
  useEffect(() => {
    setIsInitializing(true);
    initializeGoogleDrive();

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
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
        } else {
          setIsSignedIn(false);
          setUser(null);
        }
      } else {
        setIsSignedIn(false);
        setUser(null);
      }
      setIsInitializing(false);
    });

    return unsubscribe;
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
    if (isSigningInRef.current) return false;
    isSigningInRef.current = true;
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
        isSigningInRef.current = false;
        return true;
      }
      isSigningInRef.current = false;
      return false;
    } catch (err: any) {
      const errorMessage = err.message === 'popup_closed_by_user' || err.message === 'access_denied'
        ? 'Login dibatalkan oleh pengguna'
        : (err.message || 'Gagal login ke Google');
      setError(errorMessage);
      isSigningInRef.current = false;
      return false;
    }
  }, []);

  /**
   * Logout
   */
  const signOut = useCallback(async () => {
    await signOutFromGoogle();
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
      toast('Offline: Sinkronisasi akan dilakukan saat koneksi kembali online.', {
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
        toast.success('Data tersinkronisasi', { id: 'sync-loading' });
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
        try {
          await syncNow(state.transactions, (merged) => {
            state.replaceTransactions(merged);
          });
        } catch (error) {
          console.error("Sync error:", error);
        }
      } else if (user) {
        const toastId = toast.error(
          <span>
            Sesi Google Drive berakhir. Silakan login kembali.{" "}
            <button
              onClick={() => {
                signIn();
                toast.dismiss(toastId);
              }}
            >
              Login
            </button>
          </span>
        );
      }
    }, 3000);
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