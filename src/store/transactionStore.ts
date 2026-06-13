import { create } from 'zustand';
import { getStoredData, saveStoredData } from './storage';
import type { Transaction } from '@/types/transaction';
import { generateId } from '@/utils/finance';

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  deviceId: string | null;

  // Actions
  initialize: () => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deleted'>) => Transaction;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  replaceTransactions: (newTransactions: Transaction[]) => void;
  getActiveTransactions: () => Transaction[];
  clearAll: () => void;
}

export const useTransactionStore = create<TransactionState>()((set, get) => ({
  transactions: [],
  isLoading: true,
  deviceId: null,

  initialize: () => {
    const data = getStoredData();

    set({
      transactions: data.transactions || [],
      deviceId: data.deviceId || null,
      isLoading: false,
    });
  },

  addTransaction: (txData) => {
    const now = new Date().toISOString();
    const newTx: Transaction = {
      ...txData,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };

    const updatedTransactions = [newTx, ...get().transactions];
    set({ transactions: updatedTransactions });
    saveStoredData({ transactions: updatedTransactions });

    return newTx;
  },

  updateTransaction: (id, updates) => {
    const updated = get().transactions.map((tx) =>
      tx.id === id ? { ...tx, ...updates, updatedAt: new Date().toISOString() } : tx
    );
    set({ transactions: updated });
    saveStoredData({ transactions: updated });
  },

  deleteTransaction: (id) => {
    const updated = get().transactions.map((tx) =>
      tx.id === id ? { ...tx, deleted: true, updatedAt: new Date().toISOString() } : tx
    );
    set({ transactions: updated });
    saveStoredData({ transactions: updated });
  },

  replaceTransactions: (newTransactions) => {
    set({ transactions: newTransactions });
    saveStoredData({ transactions: newTransactions });
  },

  getActiveTransactions: () => {
    return get().transactions.filter((t) => !t.deleted);
  },

  clearAll: () => {
    set({ transactions: [] });
    saveStoredData({ transactions: [] });
  },
}));

// Auto initialize
if (typeof window !== 'undefined') {
  useTransactionStore.getState().initialize();
}
