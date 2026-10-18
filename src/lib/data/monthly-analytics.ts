import { db } from "@/db";
import { transactions, categories, subcategories, accounts } from "@/db/schema";
import { sql, eq, and, like, desc, isNull } from "drizzle-orm";

export interface MonthlyKPISummary {
  yearMonth: string;
  totalIncomeCents: number; // Operasional murni (bebas transfer)
  totalExpenseCents: number; // Biaya hidup riil (bebas transfer)
  netCashflowCents: number; // Surplus / Defisit murni
  savingsRatePercentage: number;
  incomeMomDeltaPercentage: number;
  expenseMomDeltaPercentage: number;
  totalTransferVolumeCents: number; // Volume pemindahan dana internal (single-sided)
  transferCount: number; // Frekuensi transfer internal
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  totalCents: number;
  percentage: number;
  subcategories: {
    subcategoryId: string;
    subcategoryName: string;
    totalCents: number;
    percentageOfParent: number;
  }[];
}

export interface TitleBreakdownItem {
  title: string;
  categoryName: string;
  frequency: number;
  averageCents: number;
  totalCents: number;
  percentageOfTotal: number;
}

export interface DailyTimelinePoint {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 1 - 31
  incomeCents: number; // Operasional murni
  expenseCents: number; // Operasional murni
  netCents: number;
}

export interface InterWalletTransferItem {
  id: string;
  date: string;
  time: string | null;
  sourceAccountName: string;
  targetAccountName: string;
  amountCents: number;
  description: string;
  note: string | null;
}

export const NON_OPERATIONAL_CATEGORIES = ["🔄 Pindah Uang", "⚙️ Penyesuaian Saldo"] as const;

export function isOperationalTransaction(
  categoryName: string | null | undefined,
  transferPairId: string | null | undefined,
  type: string
): boolean {
  if (type === "TRANSFER" || transferPairId) return false;
  if (!categoryName) return true;
  return !NON_OPERATIONAL_CATEGORIES.includes(categoryName as any);
}

function getPreviousMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  const prevDate = new Date(Date.UTC(y, m - 2, 1));
  const prevYear = prevDate.getUTCFullYear();
  const prevMonth = String(prevDate.getUTCMonth() + 1).padStart(2, "0");
  return `${prevYear}-${prevMonth}`;
}

/**
 * Calculates Monthly KPI Summary with Strict Operational Cash Flow Isolation (Transfer Neutrality).
 */
export async function getMonthlyKPISummary(yearMonth: string): Promise<MonthlyKPISummary> {
  const prevMonth = getPreviousMonth(yearMonth);

  // 1. Current Month Pure Operational Income
  const incomeRes = await db
    .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      sql`${transactions.date} LIKE ${`${yearMonth}%`} 
          AND ${transactions.type} = 'INCOME' 
          AND ${transactions.transferPairId} IS NULL 
          AND ((${categories.name} != '🔄 Pindah Uang' AND ${categories.name} != '⚙️ Penyesuaian Saldo') OR ${categories.name} IS NULL)`
    );

  // 2. Current Month Pure Operational Expense
  const expenseRes = await db
    .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      sql`${transactions.date} LIKE ${`${yearMonth}%`} 
          AND ${transactions.type} = 'EXPENSE' 
          AND ${transactions.transferPairId} IS NULL 
          AND ((${categories.name} != '🔄 Pindah Uang' AND ${categories.name} != '⚙️ Penyesuaian Saldo') OR ${categories.name} IS NULL)`
    );

  // 3. Current Month Inter-Wallet Transfers (single-sided volume)
  const transferRes = await db
    .select({
      sum: sql<number>`COALESCE(SUM(amount), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(transactions)
    .where(
      sql`${transactions.date} LIKE ${`${yearMonth}%`} 
          AND (${transactions.type} = 'TRANSFER' OR ${transactions.transferPairId} IS NOT NULL)`
    );

  // 4. Previous Month for MoM Delta
  const prevIncomeRes = await db
    .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      sql`${transactions.date} LIKE ${`${prevMonth}%`} 
          AND ${transactions.type} = 'INCOME' 
          AND ${transactions.transferPairId} IS NULL 
          AND ((${categories.name} != '🔄 Pindah Uang' AND ${categories.name} != '⚙️ Penyesuaian Saldo') OR ${categories.name} IS NULL)`
    );

  const prevExpenseRes = await db
    .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      sql`${transactions.date} LIKE ${`${prevMonth}%`} 
          AND ${transactions.type} = 'EXPENSE' 
          AND ${transactions.transferPairId} IS NULL 
          AND ((${categories.name} != '🔄 Pindah Uang' AND ${categories.name} != '⚙️ Penyesuaian Saldo') OR ${categories.name} IS NULL)`
    );

  const totalIncomeCents = Number(incomeRes[0]?.sum || 0);
  const totalExpenseCents = Number(expenseRes[0]?.sum || 0);
  const netCashflowCents = totalIncomeCents - totalExpenseCents;

  const prevIncomeCents = Number(prevIncomeRes[0]?.sum || 0);
  const prevExpenseCents = Number(prevExpenseRes[0]?.sum || 0);

  const incomeMomDeltaPercentage =
    prevIncomeCents > 0
      ? Math.round(((totalIncomeCents - prevIncomeCents) / prevIncomeCents) * 100)
      : 0;

  const expenseMomDeltaPercentage =
    prevExpenseCents > 0
      ? Math.round(((totalExpenseCents - prevExpenseCents) / prevExpenseCents) * 100)
      : 0;

  const savingsRatePercentage =
    totalIncomeCents > 0 && netCashflowCents > 0
      ? Math.round((netCashflowCents / totalIncomeCents) * 100)
      : 0;

  const rawTransferSum = Number(transferRes[0]?.sum || 0);
  const rawTransferCount = Number(transferRes[0]?.count || 0);
  // Transfers have two sides (debit & credit), so single-sided volume = sum / 2
  const totalTransferVolumeCents = Math.round(rawTransferSum / 2);
  const transferCount = Math.round(rawTransferCount / 2);

  return {
    yearMonth,
    totalIncomeCents,
    totalExpenseCents,
    netCashflowCents,
    savingsRatePercentage,
    incomeMomDeltaPercentage,
    expenseMomDeltaPercentage,
    totalTransferVolumeCents,
    transferCount,
  };
}

/**
 * Calculates hierarchical category & subcategory expense breakdown (excluding transfers).
 */
export async function getCategoryBreakdown(yearMonth: string): Promise<CategoryBreakdownItem[]> {
  const summary = await getMonthlyKPISummary(yearMonth);
  const totalExpense = summary.totalExpenseCents;

  const rows = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      subcategoryId: subcategories.id,
      subcategoryName: subcategories.name,
      totalAmount: sql<number>`SUM(${transactions.amount})`,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(subcategories, eq(transactions.subcategoryId, subcategories.id))
    .where(
      sql`${transactions.date} LIKE ${`${yearMonth}%`} 
          AND ${transactions.type} = 'EXPENSE' 
          AND ${transactions.transferPairId} IS NULL 
          AND ${categories.name} != '🔄 Pindah Uang'
          AND ${categories.name} != '⚙️ Penyesuaian Saldo'`
    )
    .groupBy(categories.id, categories.name, categories.icon, subcategories.id, subcategories.name)
    .orderBy(desc(sql`SUM(${transactions.amount})`));

  const categoryMap = new Map<string, CategoryBreakdownItem>();

  for (const r of rows) {
    const catId = r.categoryId;
    const amount = Number(r.totalAmount || 0);

    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        categoryId: catId,
        categoryName: r.categoryName,
        categoryIcon: r.categoryIcon,
        totalCents: 0,
        percentage: 0,
        subcategories: [],
      });
    }

    const catItem = categoryMap.get(catId)!;
    catItem.totalCents += amount;

    if (r.subcategoryId && r.subcategoryName) {
      catItem.subcategories.push({
        subcategoryId: r.subcategoryId,
        subcategoryName: r.subcategoryName,
        totalCents: amount,
        percentageOfParent: 0,
      });
    }
  }

  const results = Array.from(categoryMap.values()).map((cat) => {
    const percentage = totalExpense > 0 ? (cat.totalCents / totalExpense) * 100 : 0;
    const subcats = cat.subcategories.map((sub) => ({
      ...sub,
      percentageOfParent: cat.totalCents > 0 ? (sub.totalCents / cat.totalCents) * 100 : 0,
    }));
    return {
      ...cat,
      percentage: Number(percentage.toFixed(1)),
      subcategories: subcats,
    };
  });

  return results.sort((a, b) => b.totalCents - a.totalCents);
}

/**
 * Calculates expense leaderboard grouped by title/description (excluding transfers).
 */
export async function getTitleBreakdown(yearMonth: string): Promise<TitleBreakdownItem[]> {
  const summary = await getMonthlyKPISummary(yearMonth);
  const totalExpense = summary.totalExpenseCents;

  const rows = await db
    .select({
      title: transactions.description,
      categoryName: sql<string>`COALESCE(${categories.name}, 'Lainnya')`,
      frequency: sql<number>`COUNT(*)`,
      totalAmount: sql<number>`SUM(${transactions.amount})`,
      avgAmount: sql<number>`AVG(${transactions.amount})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      sql`${transactions.date} LIKE ${`${yearMonth}%`} 
          AND ${transactions.type} = 'EXPENSE' 
          AND ${transactions.transferPairId} IS NULL 
          AND ((${categories.name} != '🔄 Pindah Uang' AND ${categories.name} != '⚙️ Penyesuaian Saldo') OR ${categories.name} IS NULL)`
    )
    .groupBy(transactions.description, categories.name)
    .orderBy(desc(sql`SUM(${transactions.amount})`));

  return rows.map((r) => {
    const totalCents = Number(r.totalAmount || 0);
    const percentageOfTotal =
      totalExpense > 0 ? Number(((totalCents / totalExpense) * 100).toFixed(1)) : 0;

    return {
      title: r.title,
      categoryName: r.categoryName,
      frequency: Number(r.frequency || 0),
      averageCents: Math.round(Number(r.avgAmount || 0)),
      totalCents,
      percentageOfTotal,
    };
  });
}

/**
 * Computes daily cashflow timeline for the 1-31 area chart.
 */
export async function getDailyTimeline(yearMonth: string): Promise<DailyTimelinePoint[]> {
  const daysInMonth = 31;
  const map = new Map<number, { income: number; expense: number }>();

  for (let d = 1; d <= daysInMonth; d++) {
    map.set(d, { income: 0, expense: 0 });
  }

  const rows = await db
    .select({
      date: transactions.date,
      type: transactions.type,
      totalAmount: sql<number>`SUM(${transactions.amount})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      sql`${transactions.date} LIKE ${`${yearMonth}%`} 
          AND ${transactions.transferPairId} IS NULL 
          AND ((${categories.name} != '🔄 Pindah Uang' AND ${categories.name} != '⚙️ Penyesuaian Saldo') OR ${categories.name} IS NULL)`
    )
    .groupBy(transactions.date, transactions.type);

  for (const r of rows) {
    const day = parseInt(r.date.split("-")[2], 10);
    if (map.has(day)) {
      const entry = map.get(day)!;
      const amt = Number(r.totalAmount || 0);
      if (r.type === "INCOME") entry.income += amt;
      else if (r.type === "EXPENSE") entry.expense += amt;
    }
  }

  const results: DailyTimelinePoint[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, "0");
    const entry = map.get(d)!;
    results.push({
      date: `${yearMonth}-${dayStr}`,
      dayNumber: d,
      incomeCents: entry.income,
      expenseCents: entry.expense,
      netCents: entry.income - entry.expense,
    });
  }

  return results;
}

/**
 * Returns list of inter-wallet transfers for audit and transparency.
 */
export async function getInterWalletTransfers(yearMonth: string): Promise<InterWalletTransferItem[]> {
  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      time: transactions.time,
      amount: transactions.amount,
      description: transactions.description,
      note: transactions.note,
      sourceAccountId: transactions.accountId,
      targetAccountId: transactions.targetAccountId,
    })
    .from(transactions)
    .where(
      sql`${transactions.date} LIKE ${`${yearMonth}%`} 
          AND (${transactions.type} = 'TRANSFER' OR ${transactions.transferPairId} IS NOT NULL)`
    )
    .orderBy(desc(transactions.date));

  const allAccounts = await db.select().from(accounts);
  const accMap = new Map<string, string>();
  for (const acc of allAccounts) {
    accMap.set(acc.id, acc.name);
  }

  // Deduplicate transfer pairs by transferPairId (or display unique rows)
  const results: InterWalletTransferItem[] = [];
  for (const r of rows) {
    const srcName = accMap.get(r.sourceAccountId) || "Akun Sumber";
    const tgtName = r.targetAccountId ? accMap.get(r.targetAccountId) || "Akun Tujuan" : "Akun Tujuan";

    results.push({
      id: r.id,
      date: r.date,
      time: r.time,
      sourceAccountName: srcName,
      targetAccountName: tgtName,
      amountCents: r.amount,
      description: r.description,
      note: r.note,
    });
  }

  return results;
}
