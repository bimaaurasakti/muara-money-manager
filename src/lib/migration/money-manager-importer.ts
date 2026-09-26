import ExcelJS from "exceljs";
import { toCents, excelSerialToDateTime } from "@/lib/money";

export interface ParsedMigrationRow {
  rowNumber: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  sourceAccountName: string;
  targetAccountName: string | null;
  categoryName: string;
  subcategoryName: string | null;
  amountCents: number; // Integer cents (always positive)
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  description: string;
  note: string | null;
  isModifiedBalance: boolean;
  transferPairId?: string;
}

export interface MigrationParseResult {
  totalRows: number;
  transactions: ParsedMigrationRow[];
  summary: {
    expenseCount: number;
    incomeCount: number;
    transferCount: number;
    modifiedBalCount: number;
    totalAmountCents: number;
  };
}

/**
 * Parses the legacy Money Manager Excel file (455 transactions).
 * Handles serial dates, Modified Bal. mapping, and Transfer-Out pairings.
 */
export async function parseMoneyManagerExcel(
  filePathOrBuffer: string | ArrayBuffer | Buffer
): Promise<MigrationParseResult> {
  const workbook = new ExcelJS.Workbook();

  if (typeof filePathOrBuffer === "string") {
    await workbook.xlsx.readFile(filePathOrBuffer);
  } else {
    // ArrayBuffer or Buffer
    const buffer = Buffer.isBuffer(filePathOrBuffer)
      ? filePathOrBuffer
      : Buffer.from(filePathOrBuffer);
    await workbook.xlsx.load(buffer as any);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("No worksheet found in Money Manager Excel file.");
  }

  const transactions: ParsedMigrationRow[] = [];
  let expenseCount = 0;
  let incomeCount = 0;
  let transferCount = 0;
  let modifiedBalCount = 0;
  let totalAmountCents = 0;

  worksheet.eachRow((row, rowNumber) => {
    // Skip header row (row 1)
    if (rowNumber === 1) return;

    const rawDate = row.getCell(1).value;
    const accountName = String(row.getCell(2).value || "").trim();
    const rawCategory = String(row.getCell(3).value || "").trim();
    const rawSubcategory = String(row.getCell(4).value || "").trim();
    const note = row.getCell(5).value ? String(row.getCell(5).value).trim() : null;
    const rawAmount = Number(row.getCell(6).value || 0);
    const rawType = String(row.getCell(7).value || "").trim();
    const description = row.getCell(8).value ? String(row.getCell(8).value).trim() : "";

    // 1. Resolve date and time
    let dateStr = "";
    let timeStr = "00:00:00";

    if (rawDate instanceof Date) {
      const year = rawDate.getUTCFullYear();
      const month = String(rawDate.getUTCMonth() + 1).padStart(2, "0");
      const day = String(rawDate.getUTCDate()).padStart(2, "0");
      const hours = String(rawDate.getUTCHours()).padStart(2, "0");
      const minutes = String(rawDate.getUTCMinutes()).padStart(2, "0");
      const seconds = String(rawDate.getUTCSeconds()).padStart(2, "0");
      dateStr = `${year}-${month}-${day}`;
      timeStr = `${hours}:${minutes}:${seconds}`;
    } else if (typeof rawDate === "number") {
      const dt = excelSerialToDateTime(rawDate);
      dateStr = dt.date;
      timeStr = dt.time;
    } else if (typeof rawDate === "string") {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        dateStr = parsed.toISOString().split("T")[0];
        timeStr = parsed.toISOString().split("T")[1]?.slice(0, 8) || "00:00:00";
      } else {
        dateStr = rawDate.slice(0, 10);
      }
    }

    // 2. Resolve type, category, target account
    let type: "INCOME" | "EXPENSE" | "TRANSFER" = "EXPENSE";
    let targetAccountName: string | null = null;
    let categoryName = rawCategory;
    let subcategoryName: string | null = rawSubcategory || null;
    let isModifiedBalance = false;
    let transferPairId: string | undefined = undefined;

    if (rawCategory === "Modified Bal.") {
      isModifiedBalance = true;
      modifiedBalCount++;
      categoryName = "⚙️ Penyesuaian Saldo";
      subcategoryName = "⚙️ Penyesuaian Saldo";
      const isExpense =
        rawType.toLowerCase().includes("expense") ||
        rawType.toLowerCase().includes("pengeluaran");
      type = isExpense ? "EXPENSE" : "INCOME";
      if (type === "INCOME") incomeCount++;
      else expenseCount++;
    } else if (rawType === "Transfer-Out" || rawType.toLowerCase().includes("transfer")) {
      type = "TRANSFER";
      transferCount++;
      targetAccountName = rawCategory; // Category column holds target wallet
      categoryName = "🔄 Pindah Uang";
      subcategoryName = null;
      transferPairId = crypto.randomUUID();
    } else if (rawType.toLowerCase() === "income") {
      type = "INCOME";
      incomeCount++;
    } else {
      type = "EXPENSE";
      expenseCount++;
    }

    const amountCents = toCents(Math.abs(rawAmount));
    totalAmountCents += amountCents;

    transactions.push({
      rowNumber,
      date: dateStr,
      time: timeStr,
      sourceAccountName: accountName,
      targetAccountName,
      categoryName,
      subcategoryName,
      amountCents,
      type,
      description: description || note || categoryName,
      note,
      isModifiedBalance,
      transferPairId,
    });
  });

  return {
    totalRows: transactions.length,
    transactions,
    summary: {
      expenseCount,
      incomeCount,
      transferCount,
      modifiedBalCount,
      totalAmountCents,
    },
  };
}
