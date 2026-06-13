/**
 * Offline Manager Utility
 * Menangani deteksi koneksi dan sinkronisasi otomatis saat kembali online.
 */

export const isOnline = (): boolean => {
  if (typeof window === 'undefined') return true;
  return navigator.onLine;
};

export const setupOnlineListener = (onOnline: () => void) => {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('online', onOnline);
  
  return () => {
    window.removeEventListener('online', onOnline);
  };
};

/**
 * Safe Get Helper untuk menghindari Unsafe Key Access
 */
export function safeGet<T, K extends keyof T>(obj: T | null | undefined, key: K, defaultValue: T[K]): T[K] {
  if (!obj) return defaultValue;
  return obj[key] !== undefined ? obj[key] : defaultValue;
}

/**
 * Helper untuk pengecekan keberadaan property (Safe Access Check)
 */
export function hasKey<T extends object>(obj: T, key: PropertyKey): key is keyof T {
  return key in obj;
}
