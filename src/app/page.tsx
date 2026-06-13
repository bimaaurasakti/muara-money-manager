'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTransactions } from '@/hooks/useTransactions';
import { useAuthStore } from '@/store/authStore';
import { TransactionForm } from '@/components/TransactionForm';
import { TransactionList } from '@/components/TransactionList';
import { Reports } from '@/components/Reports';
import { formatCurrency, calculateBalance, getTotalIncome, getTotalExpense } from '@/utils/finance';
import { exportToCSV } from '@/utils/export';
import { Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw, LogIn, LogOut, Wifi, Download, Upload } from 'lucide-react';
import { ImportModal } from '@/components/ImportModal';

type Tab = 'transactions' | 'reports';

export default function MoneyManager() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('transactions');

  const {
    transactions,
    isLoading,
    addTransaction,
    deleteTransaction,
    replaceTransactionsFromSync,
  } = useTransactions();

  const {
    isSignedIn,
    isInitializing,
    isSyncing,
    error,
    lastSyncTime,
    signIn,
    signOut,
    syncNow,
  } = useAuthStore();

  // Redirect logic - hanya jalankan setelah inisialisasi selesai
  useEffect(() => {
    if (isInitializing) return;

    if (!isSignedIn) {
      router.replace('/login');
    }
  }, [isSignedIn, isInitializing, router]);

  const [syncMessage, setSyncMessage] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const balance = calculateBalance(transactions);
  const totalIncome = getTotalIncome(transactions);
  const totalExpense = getTotalExpense(transactions);

  const handleAddTransaction = (data: any) => {
    addTransaction(data);
  };

  const handleFullSync = async () => {
    setSyncMessage('');

    if (!isSignedIn) {
      const success = await signIn();
      if (!success) return;
    }

    const success = await syncNow(transactions, (mergedTransactions) => {
      replaceTransactionsFromSync(mergedTransactions);
    });

    if (success) {
      setSyncMessage('Sinkronisasi berhasil!');
      setTimeout(() => setSyncMessage(''), 2500);
    }
  };

  const handleExport = () => {
    exportToCSV(transactions);
  };

  // Tampilkan loading screen selama proses inisialisasi Google (restore token)
  if (isLoading || isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
          <p>Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-xl tracking-tight">Money Manager</h1>
              <p className="text-[10px] text-zinc-500 -mt-1">Local-first • Private Sync via Google Drive</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>

            <button 
              onClick={() => setIsImportModalOpen(true)} 
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import CSV</span>
            </button>

            {isSignedIn ? (
              <button onClick={signOut} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            ) : (
              <button onClick={signIn} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100">
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Sign in with Google</span>
              </button>
            )}

            <button
              onClick={handleFullSync}
              disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-70"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Google Drive'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Status */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-8">
          <div className="flex items-center gap-2 text-emerald-600">
            <Wifi className="w-4 h-4" />
            <span className="text-sm font-medium">Offline First • Data tersimpan lokal</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            {isSignedIn && <span className="text-emerald-600">✓ Terhubung ke Google</span>}
            {lastSyncTime && <span>Last sync: {new Date(lastSyncTime).toLocaleTimeString('id-ID')}</span>}
            {syncMessage && <span className="text-emerald-600">{syncMessage}</span>}
            {error && <span className="text-rose-600">{error}</span>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium text-zinc-500">Total Pemasukan</span>
            </div>
            <div className="text-4xl font-semibold tabular-nums tracking-tighter text-emerald-600">
              {formatCurrency(totalIncome)}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <ArrowDownCircle className="w-5 h-5 text-rose-600" />
              <span className="text-sm font-medium text-zinc-500">Total Pengeluaran</span>
            </div>
            <div className="text-4xl font-semibold tabular-nums tracking-tighter text-rose-600">
              {formatCurrency(totalExpense)}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6">
            <div className="text-sm font-medium text-zinc-500 mb-1">Saldo Saat Ini</div>
            <div className={`text-4xl font-semibold tabular-nums tracking-tighter ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatCurrency(balance)}
            </div>
            <div className="text-xs text-zinc-500 mt-2">Real-time</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 mb-6">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'transactions' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-zinc-500'}`}
          >
            Transaksi
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'reports' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-zinc-500'}`}
          >
            Laporan Bulanan
          </button>
        </div>

        {/* Content based on tab */}
        {activeTab === 'transactions' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <h3 className="font-semibold mb-4 px-1">Tambah Transaksi Baru</h3>
              <TransactionForm onSubmit={handleAddTransaction} />
            </div>
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="font-semibold">Riwayat Transaksi</h3>
                <span className="text-xs px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-zinc-500">
                  {transactions.length} transaksi
                </span>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-2">
                <TransactionList transactions={transactions} onDelete={deleteTransaction} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="max-w-2xl mx-auto">
            <Reports transactions={transactions} />
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-zinc-400 py-10 border-t border-zinc-100 dark:border-zinc-900 mt-8">
        Data disimpan lokal • Sinkronisasi via Google Drive • Export CSV tersedia
      </footer>

      {/* Import Modal */}
      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={(importedTransactions) => {
          // Add all imported transactions
          importedTransactions.forEach(tx => {
            // We need to use the raw add without the form
            // Since addTransaction is from hook, we can call it multiple times
            addTransaction({
              type: tx.type,
              amount: tx.amount,
              category: tx.category,
              date: tx.date,
              note: tx.note
            });
          });
          setIsImportModalOpen(false);
        }} 
      />
    </div>
  );
}
