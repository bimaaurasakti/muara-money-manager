import type { Transaction } from '@/types/transaction';

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function calculateBalance(transactions: Transaction[]): number {
  return transactions
    .filter(t => !t.deleted)
    .reduce((balance, tx) => {
      return tx.type === 'income' 
        ? balance + tx.amount 
        : balance - tx.amount;
    }, 0);
}

export function getTotalIncome(transactions: Transaction[]): number {
  return transactions
    .filter(t => !t.deleted && t.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);
}

export function getTotalExpense(transactions: Transaction[]): number {
  return transactions
    .filter(t => !t.deleted && t.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);
}

export function getTransactionsByDateRange(
  transactions: Transaction[], 
  startDate: string, 
  endDate: string
): Transaction[] {
  return transactions.filter(tx => 
    !tx.deleted && 
    tx.date >= startDate && 
    tx.date <= endDate
  );
}
