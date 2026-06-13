'use client';

import type { Transaction } from '@/types/transaction';
import { formatCurrency } from '@/utils/finance';

interface ReportsProps {
  transactions: Transaction[];
}

export function Reports({ transactions }: ReportsProps) {
  // Group by month
  const monthlyData = transactions
    .filter(t => !t.deleted)
    .reduce((acc, tx) => {
      const month = tx.date.substring(0, 7); // YYYY-MM
      if (!acc[month]) {
        acc[month] = { income: 0, expense: 0 };
      }
      if (tx.type === 'income') {
        acc[month].income += tx.amount;
      } else {
        acc[month].expense += tx.amount;
      }
      return acc;
    }, {} as Record<string, { income: number; expense: number }>);

  const sortedMonths = Object.keys(monthlyData).sort().reverse();

  if (sortedMonths.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400">
        Belum ada data untuk ditampilkan.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold px-1">Ringkasan Bulanan</h3>
      
      {sortedMonths.map(month => {
        const data = monthlyData[month];
        const balance = data.income - data.expense;
        const monthName = new Date(month + '-01').toLocaleDateString('id-ID', { 
          month: 'long', 
          year: 'numeric' 
        });

        return (
          <div key={month} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="font-semibold">{monthName}</div>
                <div className="text-xs text-zinc-500">{month}</div>
              </div>
              <div className={`text-right font-semibold ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(balance)}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-emerald-50 dark:bg-emerald-950/50 rounded-xl p-3">
                <div className="text-emerald-600 text-xs">Pemasukan</div>
                <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(data.income)}
                </div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/50 rounded-xl p-3">
                <div className="text-rose-600 text-xs">Pengeluaran</div>
                <div className="font-semibold text-rose-700 dark:text-rose-400">
                  {formatCurrency(data.expense)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
