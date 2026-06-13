import { create } from 'zustand';
import { getStoredData, saveStoredData } from './storage';
import type { Transaction } from '@/types/transaction';
import { generateId } from '@/utils/finance';

interface TransactionState {
  transactions: Transaction[];
  syncQueue: string[];
  isLoading: boolean;
  deviceId: string | null;
  onSyncTrigger?: () => void; // Listener for sync

  // Actions
  initialize: () => void;
  setSyncTrigger: (trigger: () => void) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'deleted'>) => Transaction;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  replaceTransactions: (newTransactions: Transaction[]) => void;
  removeFromQueue: (ids: string[]) => void;
  getActiveTransactions: () => Transaction[];
  clearAll: () => void;
}

export const useTransactionStore = create<TransactionState>()((set, get) => ({
  transactions: [],
  syncQueue: [],
  isLoading: true,
  deviceId: null,

  initialize: () => {
    const data = getStoredData();

    set({
      transactions: data.transactions || [],
      syncQueue: data.syncQueue || [],
      deviceId: data.deviceId || null,
      isLoading: false,
    });
  },

  setSyncTrigger: (trigger) => {
    set({ onSyncTrigger: trigger });
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
    const updatedQueue = Array.from(new Set([...get().syncQueue, newTx.id]));
    
    set({ transactions: updatedTransactions, syncQueue: updatedQueue });
    saveStoredData({ 
      transactions: updatedTransactions,
      syncQueue: updatedQueue
    });

    // Trigger Sync
    get().onSyncTrigger?.();

    return newTx;
  },

  updateTransaction: (id, updates) => {
    const updated = get().transactions.map((tx) =>
      tx.id === id ? { ...tx, ...updates, updatedAt: new Date().toISOString() } : tx
    );
    const updatedQueue = Array.from(new Set([...get().syncQueue, id]));

    set({ transactions: updated, syncQueue: updatedQueue });
    saveStoredData({ 
      transactions: updated,
      syncQueue: updatedQueue
    });

    // Trigger Sync
    get().onSyncTrigger?.();
  },

  deleteTransaction: (id) => {
    const updated = get().transactions.map((tx) =>
      tx.id === id ? { ...tx, deleted: true, updatedAt: new Date().toISOString() } : tx
    );
    const updatedQueue = Array.from(new Set([...get().syncQueue, id]));

    set({ transactions: updated, syncQueue: updatedQueue });
    saveStoredData({ 
      transactions: updated,
      syncQueue: updatedQueue
    });

    // Trigger Sync
    get().onSyncTrigger?.();
  },

  replaceTransactions: (newTransactions) => {
    set({ transactions: newTransactions });
    saveStoredData({ transactions: newTransactions });
  },

  removeFromQueue: (ids) => {
    const currentQueue = get().syncQueue;
    const updatedQueue = currentQueue.filter(id => !ids.includes(id));
    set({ syncQueue: updatedQueue });
    saveStoredData({ syncQueue: updatedQueue });
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
