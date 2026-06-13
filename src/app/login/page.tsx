'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { useTransactionStore } from '@/store/transactionStore';
import { mergeTransactions } from '@/features/sync/merge';
import { downloadFromDrive, uploadToDrive } from '@/lib/google-drive';
import { Wallet, LogIn, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isSyncing, isSignedIn, isInitializing } = useAuthStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setError('');

    try {
      const success = await signIn();

      if (success) {
        // Hapus data guest (karena user harus login)
        localStorage.removeItem('transactions_guest');
        localStorage.removeItem('money_manager_transactions_guest');

        // === AUTO SYNC SETELAH LOGIN BERHASIL ===
        try {
          const remoteData = await downloadFromDrive();
          const transactionStore = useTransactionStore.getState();
          const localTransactions = transactionStore.transactions || [];

          if (remoteData?.transactions && Array.isArray(remoteData.transactions)) {
            // Merge data dari Google Drive dengan data lokal
            const mergeResult = mergeTransactions(localTransactions, remoteData.transactions);

            if (mergeResult.mergedTransactions.length > 0) {
              transactionStore.replaceTransactions(mergeResult.mergedTransactions);
            }
          }

          // Upload hasil merge kembali ke Google Drive
          await uploadToDrive({
            version: 1,
            lastSync: new Date().toISOString(),
            deviceId: transactionStore.deviceId || 'web',
            transactions: transactionStore.getActiveTransactions(),
          });
        } catch (syncError) {
          console.warn('Auto sync setelah login gagal:', syncError);
        }

        router.push('/');
      } else {
        setError('Login gagal. Silakan coba lagi.');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat login.');
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center">
              <Wallet className="w-9 h-9 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Money Manager</h1>
          <p className="text-zinc-400 mt-2">Local-first • Private • Sync via Google Drive</p>
        </div>

        {/* Login Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-white">Selamat Datang</h2>
            <p className="text-zinc-400 mt-2 text-sm">
              Login dengan Google untuk mulai mengelola keuanganmu.<br />
              Data akan disinkronkan secara otomatis.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-rose-950 border border-rose-800 text-rose-400 text-sm rounded-2xl">
              {error}
            </div>
          )}

          {/* Jika sudah login (token masih valid) */}
          {!isInitializing && isSignedIn ? (
            <div className="text-center">
              <p className="text-emerald-400 mb-4">Kamu sudah login.</p>
              <button
                onClick={() => router.push('/')}
                className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-medium"
              >
                Masuk ke Dashboard
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn || isSyncing}
              className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-4 rounded-2xl hover:bg-zinc-100 transition-colors disabled:opacity-70"
            >
              {isLoggingIn || isSyncing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isSyncing ? 'Sinkronisasi data...' : 'Logging in...'}
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Login dengan Google
                </>
              )}
            </button>
          )}

          <div className="mt-6 text-center text-xs text-zinc-500">
            Data kamu akan disimpan secara privat di Google Drive milikmu.
          </div>
        </div>

        <p className="text-center text-xs text-zinc-500 mt-8">
          Dengan login, kamu menyetujui untuk menyinkronkan data keuanganmu ke Google Drive.
        </p>
      </div>
    </div>
  );
}
