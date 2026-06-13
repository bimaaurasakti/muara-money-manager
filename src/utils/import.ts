import type { Transaction } from '@/types/transaction';
import { generateId } from './finance';

export interface ParsedTransaction {
  date: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  note?: string;
  raw: any; // original row for debugging
}

export function parseCSV(csvText: string): ParsedTransaction[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 3) continue;

    const row: any = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Mapping logic
    const parsed = mapRowToTransaction(row);
    if (parsed) {
      transactions.push(parsed);
    }
  }

  return transactions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function mapRowToTransaction(row: any): ParsedTransaction | null {
  // Try to find relevant fields (case insensitive)
  const getField = (possibleNames: string[]) => {
    for (const name of possibleNames) {
      const key = Object.keys(row).find(k => 
        k.toLowerCase().includes(name.toLowerCase())
      );
      if (key) return row[key];
    }
    return '';
  };

  const dateStr = getField(['Date', 'Tanggal']);
  const amountStr = getField(['Amount', 'IDR', 'Jumlah']);
  const typeStr = getField(['Income/Expense', 'Type', 'Tipe']);
  const categoryStr = getField(['Category', 'Kategori']);
  const noteStr = getField(['Note', 'Description', 'Catatan', 'Keterangan']);

  if (!dateStr || !amountStr) return null;

  // Parse amount
  const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0;
  if (amount === 0) return null;

  // Determine type
  let type: 'income' | 'expense' = 'expense';
  const lowerType = typeStr.toLowerCase();
  
  if (lowerType.includes('income') || lowerType.includes('pemasukan')) {
    type = 'income';
  } else if (lowerType.includes('expense') || lowerType.includes('pengeluaran')) {
    type = 'expense';
  } else if (amount > 0 && lowerType.includes('transfer')) {
    type = 'income'; // treat transfer in as income for simplicity
  }

  // Parse date (support multiple formats)
  let date = '';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      date = d.toISOString().split('T')[0];
    } else {
      // Try DD/MM/YYYY or similar
      const parts = dateStr.split(/[\/\-]/);
      if (parts.length === 3) {
        date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      }
    }
  } catch {
    date = new Date().toISOString().split('T')[0];
  }

  return {
    date,
    type,
    amount: Math.abs(amount),
    category: categoryStr || 'Imported',
    note: noteStr || '',
    raw: row
  };
}

export function convertToTransactions(parsed: ParsedTransaction[]): Transaction[] {
  return parsed.map(p => ({
    id: generateId(),
    type: p.type,
    amount: p.amount,
    category: p.category,
    date: p.date,
    note: p.note,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false
  }));
}
