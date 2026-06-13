export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;                    // UUID v4
  type: TransactionType;
  amount: number;                // Always positive number
  category: string;
  date: string;                  // YYYY-MM-DD
  note?: string;
  createdAt: string;             // ISO 8601
  updatedAt: string;             // ISO 8601
  deleted: boolean;              // Soft delete for sync safety
}

export interface SyncData {
  version: number;
  lastSync: string;              // ISO timestamp
  deviceId: string;
  transactions: Transaction[];
}

export interface MergeResult {
  mergedTransactions: Transaction[];
  hasChanges: boolean;
  conflicts: Transaction[];      // For future advanced conflict UI
}
