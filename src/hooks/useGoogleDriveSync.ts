'use client';

import { useState, useCallback, useEffect } from 'react';
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

export function useGoogleDriveSync() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError('Silakan login ke Google terlebih dahulu');
      return false;
    }

    setIsSyncing(true);
    setError(null);

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
        setLastSyncTime(new Date().toISOString());
        return true;
      } else {
        setError('Gagal mengupload data ke Google Drive');
        return false;
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat sinkronisasi');
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  return {
    isSignedIn,
    isSyncing,
    lastSyncTime,
    error,
    signIn,
    signOut,
    syncNow,
    checkSignInStatus,
  };
}