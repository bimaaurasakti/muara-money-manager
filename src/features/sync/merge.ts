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

  // 1. Indeks local transactions untuk pengecekan cepat
  const localMap = new Map<string, Transaction>();
  for (const tx of localTransactions) {
    localMap.set(tx.id, tx);
  }

  // 2. Gunakan semua transaksi dari remote sebagai dasar
  for (const remoteTx of remoteTransactions) {
    txMap.set(remoteTx.id, { ...remoteTx });
  }

  // 3. Gabungkan dengan local menggunakan Last-Write-Wins
  for (const localTx of localTransactions) {
    const existing = txMap.get(localTx.id);

    if (!existing) {
      // Transaksi ini hanya ada di local
      txMap.set(localTx.id, { ...localTx });
    } else {
      // Bandingkan timestamp
      const localTime = new Date(localTx.updatedAt).getTime();
      const remoteTime = new Date(existing.updatedAt).getTime();

      if (localTime > remoteTime) {
        // Local lebih baru, timpa remote
        txMap.set(localTx.id, { ...localTx });
      }
    }
  }

  // 4. Deteksi apakah ada perbedaan antara local original dan hasil merge
  const finalTransactions = Array.from(txMap.values());
  
  if (finalTransactions.length !== localTransactions.length) {
    hasChanges = true;
  } else {
    // Cek apakah ada konten yang berubah atau order yang berbeda jika diperlukan, 
    // tapi di sini kita cek by content/updatedAt
    for (const tx of finalTransactions) {
      const local = localMap.get(tx.id);
      if (!local || local.updatedAt !== tx.updatedAt || local.deleted !== tx.deleted) {
        hasChanges = true;
        break;
      }
    }
  }

  return {
    mergedTransactions: finalTransactions.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
    hasChanges,
    conflicts: [],
  };
}
