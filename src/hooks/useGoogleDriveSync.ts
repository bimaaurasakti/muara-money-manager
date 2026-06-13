'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  initializeGoogleDrive,
  signInWithGoogle,
  signOutFromGoogle,
  downloadFromDrive,
  uploadToDrive,
  isSignedInToGoogle,
} from '@/lib/google-drive';
import type { Transaction } from '@/types/transaction';
import { mergeTransactions } from '@/features/sync/merge';

export function useGoogleDriveSync() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); // ← Tambahan
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Inisialisasi Google Drive + restore login state jika token masih valid
  useEffect(() => {
    const initGoogle = async () => {
      setIsInitializing(true);
      await initializeGoogleDrive();
      
      const stillSignedIn = isSignedInToGoogle();
      if (stillSignedIn) {
        setIsSignedIn(true);
      }
      setIsInitializing(false); // ← Selesai inisialisasi
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
      const token = await signInWithGoogle();
      setIsSignedIn(true);

      // Ambil info user Google
      try {
        // const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        //   headers: { Authorization: `Bearer ${token}` },
        // });
        // if (res.ok) {
        //   const userData = await res.json();
        //   // Simpan user info (bisa dikembangkan lebih lanjut)
        //   localStorage.setItem('google_user_info', JSON.stringify({
        //     id: userData.sub,
        //     email: userData.email,
        //     name: userData.name,
        //   }));
        // }
      } catch (e) {
        console.warn('Gagal mengambil info user');
      }

      return true;
    } catch (err: any) {
      setError(err.message || 'Gagal login ke Google');
      return false;
    }
  }, []);

  /**
   * Logout
   */
  const signOut = useCallback(() => {
    signOutFromGoogle();
    setIsSignedIn(false);
    setLastSyncTime(null);
    localStorage.removeItem('google_user_info');
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