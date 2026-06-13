'use client';

import { useEffect } from 'react';
import { useGoogleDriveSync } from '@/hooks/useGoogleDriveSync';
import { useTransactionStore } from '@/store/transactionStore';
import { setupOnlineListener } from '@/utils/offlineManager';
import { Toaster } from 'sonner';

/**
 * SyncManager Component
 * Menghubungkan hook sinkronisasi dengan store dan menangani event online/offline.
 */
export function SyncManager() {
  const { syncWithDebounce, syncNow, isSignedIn } = useGoogleDriveSync();
  const setSyncTrigger = useTransactionStore((state) => state.setSyncTrigger);
  const { transactions, replaceTransactions } = useTransactionStore();

  // Daftarkan trigger sinkronisasi ke store
  useEffect(() => {
    setSyncTrigger(syncWithDebounce);
  }, [setSyncTrigger, syncWithDebounce]);

  // Handle otomatis sinkronisasi saat kembali online
  useEffect(() => {
    const cleanup = setupOnlineListener(() => {
      if (isSignedIn) {
        syncNow(transactions, replaceTransactions);
      }
    });
    
    return cleanup;
  }, [isSignedIn, syncNow, transactions, replaceTransactions]);

  return <Toaster richColors position="top-right" />;
}
