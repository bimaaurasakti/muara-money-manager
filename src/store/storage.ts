// src/store/storage.ts
// Centralized storage untuk seluruh aplikasi Money Manager
// Semua data disimpan dalam 1 key localStorage saja: "money_manager_data"

const STORAGE_KEY = 'money_manager_data';

export interface MoneyManagerData {
  user?: {
    id: string;
    email: string;
    name: string;
  };
  transactions: any[];
  deviceId: string | null;
  lastSyncTime: string | null;
}

export const getStoredData = (): MoneyManagerData => {
  if (typeof window === 'undefined') {
    return { transactions: [], deviceId: null, lastSyncTime: null };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Gagal membaca money_manager_data dari localStorage');
  }

  return {
    transactions: [],
    deviceId: null,
    lastSyncTime: null,
  };
};

export const saveStoredData = (data: Partial<MoneyManagerData>) => {
  if (typeof window === 'undefined') return;

  try {
    const current = getStoredData();
    const updated = { ...current, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Gagal menyimpan money_manager_data ke localStorage');
  }
};

export const clearStoredData = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
};