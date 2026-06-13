import type { Transaction, MergeResult } from '@/types/transaction';

/**
 * mergeTransactions
 * 
 * Core business logic for serverless sync.
 * Combines local and remote transactions using Last-Write-Wins strategy
 * based on `updatedAt` timestamp.
 * 
 * IMPORTANT: This function must be developed using strict TDD.
 * Write tests in tests/features/sync/merge.test.ts first.
 */
export function mergeTransactions(
  localTransactions: Transaction[],
  remoteTransactions: Transaction[]
): MergeResult {
  const txMap = new Map<string, Transaction>();
  let hasChanges = false;

  // 1. Masukkan semua transaksi dari remote
  for (const remoteTx of remoteTransactions) {
    txMap.set(remoteTx.id, { ...remoteTx });
  }

  // 2. Timpa dengan local jika lebih baru (Last-Write-Wins)
  for (const localTx of localTransactions) {
    const existing = txMap.get(localTx.id);

    if (!existing) {
      // Transaksi baru dari local
      txMap.set(localTx.id, { ...localTx });
      hasChanges = true;
    } else {
      // Bandingkan updatedAt
      const localTime = new Date(localTx.updatedAt).getTime();
      const remoteTime = new Date(existing.updatedAt).getTime();

      if (localTime > remoteTime) {
        txMap.set(localTx.id, { ...localTx });
        hasChanges = true;
      }
    }
  }

  // 3. Cek apakah ada transaksi baru dari remote
  const finalTransactions = Array.from(txMap.values());
  const originalLocalIds = new Set(localTransactions.map(t => t.id));
  
  const newFromRemote = finalTransactions.some(tx => !originalLocalIds.has(tx.id));
  if (newFromRemote) hasChanges = true;

  return {
    mergedTransactions: finalTransactions.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
    hasChanges,
    conflicts: [], // Bisa dikembangkan nanti untuk deteksi konflik timestamp dekat
  };
}
