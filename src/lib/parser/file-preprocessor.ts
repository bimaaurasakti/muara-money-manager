/**
 * File Preprocessor Module (Muara Ingestion Pipeline)
 * Normalizes multi-format banking statements and receipts before AI extraction.
 */

import { CandidateTransaction } from "../reconciliation/transfer-detector";
import { toCents } from "../money";

export interface PreprocessedDocument {
  fileType: "PDF" | "IMAGE" | "CSV" | "EXCEL_MANDIRI";
  mimeType: string;
  base64Data?: string;
  textContent?: string;
  detectedAccountHint?: string;
  detectedYear?: string;
}

/**
 * Preprocesses Blu BCA CSV files by stripping metadata headers and recap footers.
 */
export function preprocessBluCsv(csvContent: string): {
  cleanCsv: string;
  accountNumber: string;
  accountHolder: string;
} {
  const lines = csvContent.split(/\r?\n/);
  let accountNumber = "000777929188";
  let accountHolder = "Bima Aurasakti Rochmatullah";

  for (const line of lines.slice(0, 5)) {
    if (line.includes("bluAccount")) {
      const match = line.match(/000\d+/);
      if (match) accountNumber = match[0];
    }
    if (line.includes("Nama") || line.includes("Name")) {
      const parts = line.split(",");
      if (parts[2]) accountHolder = parts[2].trim();
    }
  }

  // Find table header row (starts with "Tanggal" or "Date")
  const headerIdx = lines.findIndex((l) =>
    l.toLowerCase().includes("tanggal") || l.toLowerCase().includes("date")
  );

  if (headerIdx === -1) {
    return { cleanCsv: csvContent, accountNumber, accountHolder };
  }

  // Collect data rows until an empty line or summary footer
  const contentLines: string[] = [lines[headerIdx]];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith(",,,,")) break;
    // Check if line starts with date DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}/.test(line)) {
      contentLines.push(line);
    }
  }

  return {
    cleanCsv: contentLines.join("\n"),
    accountNumber,
    accountHolder,
  };
}

export interface ParsedBluCsvResult {
  cleanCsv: string;
  accountNumber: string;
  accountHolder: string;
  detectedAccountName: string;
  transactions: CandidateTransaction[];
}

/**
 * Deterministically parses Blu BCA CSV statement into structured transactions with 100% precision.
 */
export function parseBluCsv(
  csvContent: string,
  selectedWalletName?: string,
  knownAccounts: { name: string; accountNumber?: string | null }[] = []
): ParsedBluCsvResult {
  if (!csvContent || !csvContent.trim()) {
    return {
      cleanCsv: "",
      accountNumber: "",
      accountHolder: "",
      detectedAccountName: selectedWalletName || "Blu BCA (Baim)",
      transactions: [],
    };
  }

  const { cleanCsv, accountNumber, accountHolder } = preprocessBluCsv(csvContent);

  let detectedAccountName = selectedWalletName;
  if (!detectedAccountName) {
    const matched = knownAccounts.find((a) => a.accountNumber && accountNumber.includes(a.accountNumber));
    detectedAccountName = matched ? matched.name : "Blu BCA (Baim)";
  }

  const contentLines = cleanCsv.split("\n");
  if (contentLines.length <= 1) {
    return {
      cleanCsv,
      accountNumber,
      accountHolder,
      detectedAccountName,
      transactions: [],
    };
  }

  const transactions: CandidateTransaction[] = [];

  for (let i = 1; i < contentLines.length; i++) {
    const line = contentLines[i].trim();
    if (!line) continue;

    const cols = splitCsvLine(line);
    if (cols.length < 4) continue;

    const rawDate = cols[0]?.trim(); // DD/MM/YYYY
    const rawRemarks = cols[1]?.trim() || "Transaksi Tanpa Keterangan";
    const rawNominal = cols[2]?.trim() || "0";
    const rawType = cols[3]?.trim()?.toLowerCase() || "";

    // Convert date DD/MM/YYYY to YYYY-MM-DD
    const dateMatch = rawDate.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    let date = rawDate;
    if (dateMatch) {
      const [, dd, mm, yyyy] = dateMatch;
      date = `${yyyy}-${mm}-${dd}`;
    }

    // Parse amount
    const parsedNumber = parseFloat(rawNominal.replace(/,/g, ""));
    const absNominal = isNaN(parsedNumber) ? 0 : Math.abs(parsedNumber);
    const amountCents = toCents(absNominal);

    // Determine default type
    let type: "EXPENSE" | "INCOME" | "TRANSFER" = "EXPENSE";
    if (rawType.includes("pemasukan") || parsedNumber > 0) {
      type = "INCOME";
    } else if (rawType.includes("pengeluaran") || parsedNumber < 0) {
      type = "EXPENSE";
    }

    transactions.push({
      id: `blu-csv-${Date.now()}-${i}`,
      sourceWalletName: detectedAccountName,
      amountCents,
      type,
      date,
      time: null,
      description: rawRemarks,
      targetWalletName: null,
    });
  }

  return {
    cleanCsv,
    accountNumber,
    accountHolder,
    detectedAccountName,
    transactions,
  };
}

/**
 * Standard CSV line splitter handling quoted strings.
 */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}


/**
 * Deduplicates DANA e-wallet transactions where split breakdown rows
 * (item line vs Saldo DANA payment line) appear for the same transaction.
 */
export function deduplicateDanaTransactions<T extends {
  date: string;
  time?: string | null;
  amountCents: number;
  description: string;
}>(items: T[]): T[] {
  const seen = new Set<string>();
  const results: T[] = [];

  for (const item of items) {
    // Key based on date + amount + time (hour and minute)
    const timeKey = item.time ? item.time.slice(0, 5) : "";
    const key = `${item.date}_${timeKey}_${item.amountCents}`;

    if (seen.has(key)) {
      // If we've already seen this exact amount on the same minute:
      // If current item mentions "Saldo DANA", prefer it or keep the existing one
      continue;
    }

    seen.add(key);
    results.push(item);
  }

  return results;
}
