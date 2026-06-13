'use client';

import { useState } from 'react';
import { parseCSV, convertToTransactions, ParsedTransaction } from '@/utils/import';
import type { Transaction } from '@/types/transaction';
import { X } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (transactions: Transaction[]) => void;
}

export function ImportModal({ isOpen, onClose, onImport }: ImportModalProps) {
  const [csvText, setCsvText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      processCSV(text);
    };
    reader.readAsText(file);
  };

  const processCSV = (text: string) => {
    setIsProcessing(true);
    try {
      const parsed = parseCSV(text);
      setParsedData(parsed);
    } catch (error) {
      alert('Gagal memproses file CSV');
    }
    setIsProcessing(false);
  };

  const handleImport = () => {
    if (parsedData.length === 0) return;

    const transactions = convertToTransactions(parsedData);
    onImport(transactions);
    handleClose();
  };

  const handleClose = () => {
    setCsvText('');
    setParsedData([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">Import Data Transaksi</h2>
            <p className="text-sm text-zinc-500">Upload file CSV dari tabel kamu</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-zinc-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-auto">
          {!parsedData.length ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Upload File CSV</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>

              <div className="text-xs text-zinc-500">
                <p className="font-medium mb-1">Format yang didukung:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Kolom: Date, Amount, Income/Expense, Category, Note</li>
                  <li>Bisa dari Stockbit, BCA, atau aplikasi keuangan lain</li>
                  <li>Header row wajib ada</li>
                </ul>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <span className="font-semibold">{parsedData.length}</span> transaksi ditemukan
                </div>
                <button 
                  onClick={() => { setParsedData([]); setCsvText(''); }}
                  className="text-sm text-zinc-500 hover:text-zinc-700"
                >
                  Upload ulang
                </button>
              </div>

              <div className="max-h-80 overflow-auto border rounded-2xl">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-100 dark:bg-zinc-800 sticky top-0">
                    <tr>
                      <th className="text-left p-3">Tanggal</th>
                      <th className="text-left p-3">Tipe</th>
                      <th className="text-left p-3">Kategori</th>
                      <th className="text-right p-3">Jumlah</th>
                      <th className="text-left p-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 50).map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-3">{item.date}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs ${item.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="p-3">{item.category}</td>
                        <td className="p-3 text-right font-medium tabular-nums">{item.amount.toLocaleString('id-ID')}</td>
                        <td className="p-3 text-xs text-zinc-500 truncate max-w-[200px]">{item.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 50 && (
                <p className="text-xs text-center text-zinc-500 mt-2">Menampilkan 50 data pertama dari {parsedData.length}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t flex justify-end gap-3">
          <button onClick={handleClose} className="px-5 py-2.5 rounded-2xl border">
            Batal
          </button>
          {parsedData.length > 0 && (
            <button 
              onClick={handleImport}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-2xl font-medium hover:bg-emerald-700"
            >
              Import {parsedData.length} Transaksi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
