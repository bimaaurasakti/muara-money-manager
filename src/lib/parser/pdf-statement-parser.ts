/**
 * Deterministic PDF Statement Parser for Bank BCA and DANA e-Statements.
 * Extracts financial transactions with 100% mathematical precision directly from
 * programmatic digital PDF text streams, without relying on lossy vision OCR.
 */

import { CandidateTransaction } from "../reconciliation/transfer-detector";
import { deduplicateDanaTransactions } from "./file-preprocessor";
import { toCents } from "../money";

export interface ParsedPdfResult {
  detectedBank: "BCA" | "DANA" | "UNKNOWN";
  accountNumber: string;
  accountHolder: string;
  detectedAccountName: string;
  statementPeriod: string;
  transactions: CandidateTransaction[];
  cleanSummaryText: string;
}

/**
 * Extracts raw digital text content from a PDF Buffer using pdf-parse.
 */
export async function extractPdfRawText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to support both ESM and CommonJS Next.js server runtime
    const pdfModule = await import("pdf-parse");
    const pdfParser = (pdfModule as any).default || pdfModule;
    const data = await pdfParser(buffer);
    return data.text || "";
  } catch (error) {
    console.error("[PdfParser] Failed to extract raw text from PDF:", error);
    return "";
  }
}

/**
 * Parses Indonesian currency strings like "10.000,00" or "24.526.500" into numeric IDR and cents.
 */
export function parseIndonesianCurrency(rawStr: string): { amount: number; amountCents: number } {
  if (!rawStr) return { amount: 0, amountCents: 0 };
  
  // Clean spaces and currency prefixes
  let s = rawStr.replace(/Rp\.?/gi, "").trim();
  
  // Replace dots (thousand separators) and replace comma with dot for decimals
  s = s.replace(/\./g, "").replace(/,/g, ".");
  const num = parseFloat(s);
  const amount = isNaN(num) ? 0 : Math.abs(num);
  return {
    amount,
    amountCents: toCents(amount),
  };
}

/**
 * Normalizes month names to 2-digit MM format.
 */
const MONTH_MAP: Record<string, string> = {
  jan: "01", januari: "01", january: "01",
  feb: "02", februari: "02", february: "02",
  mar: "03", maret: "03", march: "03",
  apr: "04", april: "04",
  mei: "05", may: "05",
  jun: "06", juni: "06", june: "06",
  jul: "07", juli: "07", july: "07",
  agu: "08", agt: "08", agustus: "08", aug: "08", august: "08",
  sep: "09", september: "09",
  okt: "10", oktober: "10", oct: "10", october: "10",
  nov: "11", november: "11",
  des: "12", desember: "12", dec: "12", december: "12",
};

/**
 * Deterministically parses BCA e-Statement digital text stream.
 */
export function parseBcaPdfStatement(
  rawText: string,
  selectedWalletName?: string
): ParsedPdfResult {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let accountNumber = "";
  let accountHolder = "";
  let detectedYear = new Date().getFullYear().toString();
  let statementPeriod = "";

  // 1. Extract Header Metadata
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i];

    // Account Number: "NO. REKENING : 0501191549" or "NO. REK : 0501191549"
    const accMatch = line.match(/(?:NO\.?\s*REKENING|NO\.?\s*REK)\s*[:\s]+(\d+)/i);
    if (accMatch && !accountNumber) {
      accountNumber = accMatch[1].trim();
    }

    // Account Holder: "NAMA : BIMA AURASAKTI ROCHMATULLAH"
    const nameMatch = line.match(/NAMA\s*[:\s]+([A-Z\s.,'-]+)/i);
    if (nameMatch && !accountHolder) {
      accountHolder = nameMatch[1].trim();
    }

    // Period: "PERIODE : AGUSTUS 2026" or "PERIODE : 01/08/26 - 31/08/26"
    const periodMatch = line.match(/PERIODE\s*[:\s]+([A-Z0-9\s/.-]+)/i);
    if (periodMatch) {
      statementPeriod = periodMatch[1].trim();
      const yearMatch = statementPeriod.match(/\b(20\d{2})\b/) || statementPeriod.match(/\/(\d{2})\b/);
      if (yearMatch) {
        detectedYear = yearMatch[1].length === 2 ? `20${yearMatch[1]}` : yearMatch[1];
      }
    }
  }

  // 2. Extract Transactions
  // BCA row pattern typically starts with DD/MM
  const transactions: CandidateTransaction[] = [];
  const dateRegex = /^(\d{2})\/(\d{2})\b/;

  let currentTx: {
    date: string;
    remarks: string[];
    amountCents: number;
    type: "INCOME" | "EXPENSE" | "TRANSFER";
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(dateRegex);

    if (dateMatch) {
      // Save previously accumulated transaction if completed
      if (currentTx && currentTx.amountCents > 0) {
        transactions.push({
          id: `bca-pdf-${Date.now()}-${transactions.length + 1}`,
          sourceWalletName: selectedWalletName || "BCA (Baim)",
          amountCents: currentTx.amountCents,
          type: currentTx.type,
          date: currentTx.date,
          time: null,
          description: currentTx.remarks.join(" ").replace(/\s+/g, " ").trim(),
          targetWalletName: null,
        });
      }

      const [, dd, mm] = dateMatch;
      const isoDate = `${detectedYear}-${mm}-${dd}`;
      const restOfLine = line.slice(dateMatch[0].length).trim();

      currentTx = {
        date: isoDate,
        remarks: [],
        amountCents: 0,
        type: "EXPENSE",
      };

      if (restOfLine) {
        checkAndExtractBcaMutation(restOfLine, currentTx);
      }
    } else if (currentTx) {
      // If footer/summary is reached, terminate table parsing
      if (
        line.includes("BERSAMBUNG KE HALAMAN") ||
        line.includes("SALDO AWAL") ||
        line.includes("TOTAL MUTASI") ||
        line.includes("SALDO AKHIR")
      ) {
        if (currentTx.amountCents > 0) {
          transactions.push({
            id: `bca-pdf-${Date.now()}-${transactions.length + 1}`,
            sourceWalletName: selectedWalletName || "BCA (Baim)",
            amountCents: currentTx.amountCents,
            type: currentTx.type,
            date: currentTx.date,
            time: null,
            description: currentTx.remarks.join(" ").replace(/\s+/g, " ").trim(),
            targetWalletName: null,
          });
          currentTx = null;
        }
        continue;
      }

      checkAndExtractBcaMutation(line, currentTx);
    }
  }

  // Push final transaction
  if (currentTx && currentTx.amountCents > 0) {
    transactions.push({
      id: `bca-pdf-${Date.now()}-${transactions.length + 1}`,
      sourceWalletName: selectedWalletName || "BCA (Baim)",
      amountCents: currentTx.amountCents,
      type: currentTx.type,
      date: currentTx.date,
      time: null,
      description: currentTx.remarks.join(" ").replace(/\s+/g, " ").trim(),
      targetWalletName: null,
    });
  }

  const cleanSummaryText = generateSummaryTableText(
    "BCA",
    accountHolder,
    accountNumber,
    statementPeriod,
    transactions
  );

  return {
    detectedBank: "BCA",
    accountNumber,
    accountHolder,
    detectedAccountName: selectedWalletName || "BCA (Baim)",
    statementPeriod,
    transactions,
    cleanSummaryText,
  };
}

/**
 * Helper to inspect line for BCA mutation amount and branch/saldo patterns.
 */
function checkAndExtractBcaMutation(
  line: string,
  tx: { remarks: string[]; amountCents: number; type: "INCOME" | "EXPENSE" | "TRANSFER" }
) {
  // Regex to look for mutation amount and saldo:
  // e.g. "0950 10.000,00 150.000.000,00" or "24.526.500,00 CR 174.526.500,00"
  // or "100.000,00 500.000,00"
  const mutationMatch = line.match(
    /(?:(\d{4})\s+)?([\d.,]+)\s*(CR|DB)?\s+([\d.,]+)\s*$/i
  );

  if (mutationMatch) {
    const rawRemarksPrefix = line.slice(0, mutationMatch.index).trim();
    if (rawRemarksPrefix) {
      tx.remarks.push(rawRemarksPrefix);
    }

    const rawAmount = mutationMatch[2];
    const indicator = (mutationMatch[3] || "").toUpperCase();
    const { amountCents } = parseIndonesianCurrency(rawAmount);

    tx.amountCents = amountCents;
    tx.type = indicator === "CR" ? "INCOME" : "EXPENSE";
  } else {
    // Check if line is purely an amount with CR/DB without saldo suffix
    const standaloneMatch = line.match(/^([\d.,]+)\s*(CR|DB)\s*$/i);
    if (standaloneMatch) {
      const { amountCents } = parseIndonesianCurrency(standaloneMatch[1]);
      tx.amountCents = amountCents;
      tx.type = standaloneMatch[2].toUpperCase() === "CR" ? "INCOME" : "EXPENSE";
    } else {
      tx.remarks.push(line);
    }
  }
}

/**
 * Deterministically parses DANA PDF statement digital text stream.
 */
export function parseDanaPdfStatement(
  rawText: string,
  selectedWalletName?: string
): ParsedPdfResult {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let accountNumber = "081392366770";
  let accountHolder = "Bima Aurasakti";
  let statementPeriod = "";

  // 1. Extract Header Metadata
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const line = lines[i];

    // Phone / Account: "081392366770" or "Nomor Akun : 08..."
    const phoneMatch = line.match(/(?:08\d{8,11})/);
    if (phoneMatch && !accountNumber) {
      accountNumber = phoneMatch[0];
    }

    // Name
    const nameMatch = line.match(/(?:Nama|Name)\s*[:\s]+([A-Z\s.,'-]+)/i);
    if (nameMatch) {
      accountHolder = nameMatch[1].trim();
    }

    // Period
    const periodMatch = line.match(/(?:Periode|Period)\s*[:\s]+([A-Z0-9\s/.-]+)/i);
    if (periodMatch) {
      statementPeriod = periodMatch[1].trim();
    }
  }

  // 2. Extract Transactions
  // DANA rows usually have Date formatted as DD MMM YYYY or DD/MM/YYYY
  const transactions: CandidateTransaction[] = [];
  const danaDateRegex = /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(danaDateRegex);

    if (match) {
      const [, day, monthStr, year, time] = match;
      const mm = MONTH_MAP[monthStr.toLowerCase()] || "01";
      const dd = day.padStart(2, "0");
      const isoDate = `${year}-${mm}-${dd}`;
      const timeStr = time ? (time.length === 5 ? `${time}:00` : time) : null;

      // Rest of line or subsequent lines contain description & amount
      let description = line.slice(match[0].length).trim();
      let amountCents = 0;
      let type: "INCOME" | "EXPENSE" | "TRANSFER" = "EXPENSE";

      // Look for Rp amount in the same line or next line
      const amountMatch = line.match(/([-+])?\s*Rp\.?\s*([\d.,]+)/i);
      if (amountMatch) {
        const sign = amountMatch[1] || "-";
        const { amountCents: cents } = parseIndonesianCurrency(amountMatch[2]);
        amountCents = cents;
        type = sign === "+" ? "INCOME" : "EXPENSE";
        description = description.replace(amountMatch[0], "").trim();
      } else if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextAmountMatch = nextLine.match(/([-+])?\s*Rp\.?\s*([\d.,]+)/i);
        if (nextAmountMatch) {
          const sign = nextAmountMatch[1] || "-";
          const { amountCents: cents } = parseIndonesianCurrency(nextAmountMatch[2]);
          amountCents = cents;
          type = sign === "+" ? "INCOME" : "EXPENSE";
          i++; // Consume next line
        }
      }

      if (amountCents > 0) {
        transactions.push({
          id: `dana-pdf-${Date.now()}-${transactions.length + 1}`,
          sourceWalletName: selectedWalletName || "Dana (Baim)",
          amountCents,
          type,
          date: isoDate,
          time: timeStr,
          description: description || "Transaksi DANA",
          targetWalletName: null,
        });
      }
    }
  }

  // Deduplicate DANA split payments (e.g. merchant line + saldo DANA line)
  const deduplicated = deduplicateDanaTransactions(transactions);

  const cleanSummaryText = generateSummaryTableText(
    "DANA",
    accountHolder,
    accountNumber,
    statementPeriod,
    deduplicated
  );

  return {
    detectedBank: "DANA",
    accountNumber,
    accountHolder,
    detectedAccountName: selectedWalletName || "Dana (Baim)",
    statementPeriod,
    transactions: deduplicated,
    cleanSummaryText,
  };
}

/**
 * Universal auto-routing PDF parser for bank statements.
 * Automatically identifies whether the document is BCA or DANA, or marks UNKNOWN.
 */
export function parseBankPdfStatement(
  rawText: string,
  selectedWalletName?: string
): ParsedPdfResult {
  const lower = rawText.toLowerCase();

  // Signature checks
  if (lower.includes("bca") || lower.includes("tahapan") || lower.includes("trsf e-banking") || lower.includes("kartu debit")) {
    const result = parseBcaPdfStatement(rawText, selectedWalletName);
    if (result.transactions.length > 0) {
      return result;
    }
  }

  if (lower.includes("dana") || lower.includes("laporan transaksi") || lower.includes("saldo dana")) {
    const result = parseDanaPdfStatement(rawText, selectedWalletName);
    if (result.transactions.length > 0) {
      return result;
    }
  }

  // If signatures matched partially but 0 rows extracted, return empty
  return {
    detectedBank: "UNKNOWN",
    accountNumber: "",
    accountHolder: "",
    detectedAccountName: selectedWalletName || "Unknown Account",
    statementPeriod: "",
    transactions: [],
    cleanSummaryText: "",
  };
}

/**
 * Formats extracted transactions into a concise Markdown table string
 * to be fed into Gemini for lightweight semantic enrichment.
 */
function generateSummaryTableText(
  bankName: string,
  accountHolder: string,
  accountNumber: string,
  period: string,
  txs: CandidateTransaction[]
): string {
  const header = `BANK STATEMENT (${bankName}):
Pemilik / Holder: ${accountHolder || "N/A"}
No. Rekening / Account: ${accountNumber || "N/A"}
Periode / Period: ${period || "N/A"}
Total Mutasi: ${txs.length} transaksi

DAFTAR TRANSAKSI:
| TANGGAL | WAKTU | TIPE | NOMINAL (IDR) | KETERANGAN MUTASI |
| --- | --- | --- | --- | --- |`;

  const rows = txs.map(
    (t) =>
      `| ${t.date} | ${t.time || "-"} | ${t.type} | Rp ${(t.amountCents / 100).toLocaleString("id-ID")} | ${t.description} |`
  );

  return `${header}\n${rows.join("\n")}`;
}
