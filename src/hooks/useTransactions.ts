'use client';

import { useTransactionStore } from '@/store/transactionStore';
import type { Transaction } from '@/types/transaction';

/**
 * Custom hook yang membungkus Transaction Store (Zustand).
 * Ini adalah cara terbaik untuk menjaga compatibility sambil menggunakan state global.
 */
export function useTransactions() {
  const store = useTransactionStore();

  return {
    // State
    transactions: store.getActiveTransactions(),
    allTransactions: store.transactions,
    isLoading: store.isLoading,
    deviceId: store.deviceId,

    // Actions
    addTransaction: store.addTransaction,
    updateTransaction: store.updateTransaction,
    deleteTransaction: store.deleteTransaction,
    replaceTransactionsFromSync: store.replaceTransactions,
  };
}