'use client';

import type { Transaction } from '@/types/transaction';
import { formatCurrency } from '@/utils/finance';
import { Trash2, Edit2 } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit?: (tx: Transaction) => void;
}

export function TransactionList({ transactions, onDelete, onEdit }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <p>Belum ada transaksi.</p>
        <p className="text-sm mt-1">Tambahkan transaksi pertama kamu di atas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <div 
          key={tx.id}
          className="group flex items-center justify-between bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${tx.type === 'income' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            
            <div>
              <div className="font-medium">{tx.category}</div>
              {tx.note && <div className="text-xs text-zinc-500 mt-0.5">{tx.note}</div>}
              <div className="text-[10px] text-zinc-400 mt-1">{tx.date}</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={`font-semibold tabular-nums text-right ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {tx.type === 'income' ? '+' : '-'} {formatCurrency(tx.amount)}
            </div>

            {onEdit && (
              <button
                onClick={() => onEdit(tx)}
                className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-emerald-600 transition-all"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => onDelete(tx.id)}
              className="opacity-0 group-hover:opacity-100 p-2 text-zinc-400 hover:text-rose-500 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
