import type { Transaction } from '@/types/transaction';

export function exportToCSV(transactions: Transaction[]) {
  if (transactions.length === 0) {
    alert('Tidak ada data untuk diexport');
    return;
  }

  const headers = ['Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Catatan'];
  
  const rows = transactions
    .filter(t => !t.deleted)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(tx => [
      tx.date,
      tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
      tx.category,
      tx.amount,
      tx.note || '',
    ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.href = url;
  link.download = `money_manager_${new Date().toISOString().split('T')[0]}.csv`;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
