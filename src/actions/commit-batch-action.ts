"use server";

import { db } from "@/db";
import { accounts, categories, transactions, importBatches } from "@/db/schema";
import { CandidateTransaction } from "@/lib/reconciliation/transfer-detector";
import { markDuplicateCandidates, sanitizeTimeString } from "@/lib/reconciliation/fingerprint";
import { and, or, eq, gte, lte, inArray, sql } from "drizzle-orm";

export interface CommitBatchResult {
  success: boolean;
  message: string;
  committedCount: number;
}

/**
 * Atomically commits approved staging transactions to Turso Database
 * with server-side duplicate defense, and recalculates running balances for all affected accounts.
 */
export async function commitBatchAction(
  batchId: string | null,
  stagingTransactions: CandidateTransaction[]
): Promise<CommitBatchResult> {
  try {
    if (!stagingTransactions || stagingTransactions.length === 0) {
      return { success: false, message: "No transactions to commit.", committedCount: 0 };
    }

    // 1. Fetch accounts and categories
    const allAccounts = await db.select().from(accounts);
    const accountMap = new Map<string, string>(); // name -> id
    for (const acc of allAccounts) {
      accountMap.set(acc.name.toLowerCase(), acc.id);
    }

    const allCategories = await db.select().from(categories);
    const categoryMap = new Map<string, string>();
    for (const cat of allCategories) {
      categoryMap.set(cat.name.toLowerCase(), cat.id);
    }

    const pindahUangCatId = categoryMap.get("🔄 pindah uang") || null;

    // 2. Server-side Backend Defense Gate: Filter out duplicate transactions against Turso DB
    const dates = stagingTransactions.map((st) => st.date).filter(Boolean);
    let validStagingTransactions = stagingTransactions;

    if (dates.length > 0) {
      const minDate = dates.reduce((a, b) => (a < b ? a : b));
      const maxDate = dates.reduce((a, b) => (a > b ? a : b));

      const involvedAccountIds = Array.from(
        new Set(
          stagingTransactions
            .map((st) => accountMap.get(st.sourceWalletName.toLowerCase()))
            .filter((id): id is string => Boolean(id))
        )
      );

      if (involvedAccountIds.length > 0) {
        const existingTxs = await db
          .select({
            id: transactions.id,
            accountId: transactions.accountId,
            targetAccountId: transactions.targetAccountId,
            date: transactions.date,
            time: transactions.time,
            amount: transactions.amount,
            type: transactions.type,
            description: transactions.description,
          })
          .from(transactions)
          .where(
            and(
              or(
                inArray(transactions.accountId, involvedAccountIds),
                inArray(transactions.targetAccountId, involvedAccountIds)
              ),
              gte(transactions.date, minDate),
              lte(transactions.date, maxDate)
            )
          );

        const marked = markDuplicateCandidates(stagingTransactions, existingTxs, accountMap);
        validStagingTransactions = marked.filter((m) => !m.isDuplicate);
      }
    }

    if (validStagingTransactions.length === 0) {
      return {
        success: true,
        message: "Seluruh transaksi yang dipilih sudah tercatat di buku besar database (0 mutasi baru disisipkan).",
        committedCount: 0,
      };
    }

    // 3. Prepare transaction rows
    const affectedAccountIds = new Set<string>();

    const rowsToInsert = validStagingTransactions.map((st) => {
      const sourceAccId = accountMap.get(st.sourceWalletName.toLowerCase());
      if (!sourceAccId) {
        throw new Error(`Unknown source wallet: "${st.sourceWalletName}"`);
      }
      affectedAccountIds.add(sourceAccId);

      let targetAccId: string | null = null;
      if (st.targetWalletName) {
        targetAccId = accountMap.get(st.targetWalletName.toLowerCase()) || null;
        if (targetAccId) affectedAccountIds.add(targetAccId);
      }

      const catId = st.type === "TRANSFER"
        ? pindahUangCatId
        : categoryMap.get("⚠️ tidak terduga") || null;

      return {
        id: st.id.startsWith("manual-") || st.id.startsWith("mandiri-") || st.id.startsWith("csv-") || st.id.startsWith("pdf-") || st.id.startsWith("img-")
          ? crypto.randomUUID()
          : st.id,
        accountId: sourceAccId,
        targetAccountId: targetAccId,
        categoryId: catId,
        subcategoryId: null,
        amount: st.amountCents,
        type: st.type,
        date: st.date,
        time: sanitizeTimeString(st.time) || null,
        description: st.description,
        note: null,
        sourceType: "MANUAL" as const,
        importBatchId: batchId,
        transferPairId: st.transferPairId || null,
        rawConfidence: 100,
      };
    });

    // 3. Insert transactions in batch
    await db.insert(transactions).values(rowsToInsert);

    // 4. Recalculate balances for all affected accounts
    for (const accId of affectedAccountIds) {
      const accRecord = allAccounts.find((a) => a.id === accId);
      const initialBal = accRecord?.initialBalance || 0;

      const incomeRes = await db
        .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(transactions)
        .where(sql`account_id = ${accId} AND type = 'INCOME'`);

      const expenseRes = await db
        .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(transactions)
        .where(sql`account_id = ${accId} AND type = 'EXPENSE'`);

      const transferOutRes = await db
        .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(transactions)
        .where(sql`account_id = ${accId} AND type = 'TRANSFER'`);

      const transferInRes = await db
        .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(transactions)
        .where(sql`target_account_id = ${accId} AND type = 'TRANSFER'`);

      const totalIncome = Number(incomeRes[0]?.sum || 0);
      const totalExpense = Number(expenseRes[0]?.sum || 0);
      const totalTransferOut = Number(transferOutRes[0]?.sum || 0);
      const totalTransferIn = Number(transferInRes[0]?.sum || 0);

      const netBalance = initialBal + totalIncome - totalExpense - totalTransferOut + totalTransferIn;

      await db
        .update(accounts)
        .set({
          currentBalance: netBalance,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(accounts.id, accId));
    }

    // 5. Update import batch status if batchId is valid
    if (batchId) {
      await db
        .update(importBatches)
        .set({
          totalCommitted: validStagingTransactions.length,
          status: "COMMITTED",
        })
        .where(eq(importBatches.id, batchId));
    }

    return {
      success: true,
      message: `Sukses menyimpan ${validStagingTransactions.length} transaksi baru ke database.`,
      committedCount: validStagingTransactions.length,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Failed to commit transactions to database.",
      committedCount: 0,
    };
  }
}
