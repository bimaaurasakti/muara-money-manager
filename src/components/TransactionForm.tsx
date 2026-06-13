'use client';

import { useState, useEffect } from 'react';
import type { Transaction, TransactionType } from '@/types/transaction';

interface TransactionFormProps {
  onSubmit: (data: any) => void;
  initialData?: Transaction | null;
  onCancel?: () => void;
  isEditing?: boolean;
}

const CATEGORIES = {
  income: ['Gaji', 'Freelance', 'Investasi', 'Hadiah', 'Lainnya'],
  expense: ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Kesehatan', 'Hiburan', 'Lainnya'],
};

export function TransactionForm({ onSubmit, initialData, onCancel, isEditing = false }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(initialData?.type || 'expense');
  const [amount, setAmount] = useState(initialData?.amount?.toString() || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [date, setDate] = useState(initialData?.date || new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState(initialData?.note || '');

  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setAmount(initialData.amount.toString());
      setCategory(initialData.category);
      setDate(initialData.date);
      setNote(initialData.note || '');
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) return;

    onSubmit({
      type,
      amount: parseInt(amount),
      category,
      date,
      note: note || undefined,
    });
  };

  const currentCategories = CATEGORIES[type];

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setType('income'); setCategory(''); }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${type === 'income' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600'}`}
        >
          Pemasukan
        </button>
        <button
          type="button"
          onClick={() => { setType('expense'); setCategory(''); }}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${type === 'expense' ? 'bg-rose-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600'}`}
        >
          Pengeluaran
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">JUMLAH</label>
          <div className="relative">
            <span className="absolute left-4 top-3.5 text-zinc-400">Rp</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-lg font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="0"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-500 mb-1.5">TANGGAL</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">KATEGORI</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        >
          <option value="">Pilih kategori...</option>
          {currentCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1.5">CATATAN</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Catatan opsional"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition-colors"
        >
          {isEditing ? 'SIMPAN PERUBAHAN' : 'TAMBAH TRANSAKSI'}
        </button>
        
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3.5 border border-zinc-300 dark:border-zinc-700 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Batal
          </button>
        )}
      </div>
    </form>
  );
}
