"use server";

import { db } from "@/db";
import { transactions, accounts } from "@/db/schema";
import {
  computeTransactionFingerprint,
  verifyTransactionFingerprint,
} from "@/lib/concurrency/transaction-fingerprint";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export interface TransactionMutationInput {
  accountId: string;
  targetAccountId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  amount: number; // In cents (always positive integer)
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  date: string; // YYYY-MM-DD
  time?: string | null; // HH:mm:ss
  description: string;
  note?: string | null;
}

export interface CrudActionResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
  conflict?: "MODIFIED" | "DELETED";
  freshFingerprint?: string;
  freshTransaction?: any;
}

/**
 * Atomically recalculates current balances from scratch for affected accounts
 * based on all existing transactions, preventing any cumulative balance drift.
 */
export async function recalculateAccountBalances(
  accountIds: string[],
  txContext: any = db
): Promise<void> {
  const uniqueIds = Array.from(new Set(accountIds.filter(Boolean)));
  for (const accId of uniqueIds) {
    const accRecord = await txContext
      .select({ initialBalance: accounts.initialBalance })
      .from(accounts)
      .where(eq(accounts.id, accId))
      .limit(1);

    if (!accRecord[0]) continue;
    const initialBal = accRecord[0].initialBalance || 0;

    const incomeRes = await txContext
      .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(transactions)
      .where(sql`${transactions.accountId} = ${accId} AND ${transactions.type} = 'INCOME'`);

    const expenseRes = await txContext
      .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(transactions)
      .where(sql`${transactions.accountId} = ${accId} AND ${transactions.type} = 'EXPENSE'`);

    const transferOutRes = await txContext
      .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(transactions)
      .where(sql`${transactions.accountId} = ${accId} AND ${transactions.type} = 'TRANSFER'`);

    const transferInRes = await txContext
      .select({ sum: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(transactions)
      .where(sql`${transactions.targetAccountId} = ${accId} AND ${transactions.type} = 'TRANSFER'`);

    const totalIncome = Number(incomeRes[0]?.sum || 0);
    const totalExpense = Number(expenseRes[0]?.sum || 0);
    const totalTransferOut = Number(transferOutRes[0]?.sum || 0);
    const totalTransferIn = Number(transferInRes[0]?.sum || 0);

    const netBalance = initialBal + totalIncome - totalExpense - totalTransferOut + totalTransferIn;

    await txContext
      .update(accounts)
      .set({ currentBalance: netBalance, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(accounts.id, accId));
  }
}

/**
 * Creates a new transaction and recalculates affected account balances.
 */
export async function createTransactionAction(
  input: TransactionMutationInput
): Promise<CrudActionResult<{ id: string; fingerprint: string }>> {
  try {
    if (!input.accountId) {
      return { success: false, message: "Rekening wajib dipilih." };
    }
    if (!input.amount || input.amount <= 0) {
      return { success: false, message: "Nominal transaksi harus lebih dari Rp 0." };
    }
    if (!input.date) {
      return { success: false, message: "Tanggal transaksi wajib diisi." };
    }
    if (!input.description?.trim()) {
      return { success: false, message: "Keterangan transaksi wajib diisi." };
    }
    if (input.type === "TRANSFER" && !input.targetAccountId) {
      return { success: false, message: "Rekening tujuan transfer wajib dipilih." };
    }
    if (input.type === "TRANSFER" && input.accountId === input.targetAccountId) {
      return { success: false, message: "Rekening sumber dan tujuan tidak boleh sama." };
    }

    const newId = crypto.randomUUID();
    const formattedTime = input.time?.trim() || "00:00:00";

    const newTx = {
      id: newId,
      accountId: input.accountId,
      targetAccountId: input.type === "TRANSFER" ? input.targetAccountId || null : null,
      categoryId: input.categoryId || null,
      subcategoryId: input.subcategoryId || null,
      amount: Math.round(input.amount),
      type: input.type,
      date: input.date,
      time: formattedTime,
      description: input.description.trim(),
      note: input.note?.trim() || null,
      sourceType: "MANUAL" as const,
      rawConfidence: 100,
    };

    await db.insert(transactions).values(newTx);

    const affected = [input.accountId, input.targetAccountId].filter(Boolean) as string[];
    await recalculateAccountBalances(affected);

    const fingerprint = computeTransactionFingerprint(newTx);

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/monthly");

    return {
      success: true,
      message: "Transaksi berhasil ditambahkan.",
      data: { id: newId, fingerprint },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Gagal menambahkan transaksi.",
    };
  }
}

/**
 * Updates an existing transaction with Optimistic Concurrency Control (OCC) guard.
 */
export async function updateTransactionAction(
  id: string,
  expectedFingerprint: string,
  input: TransactionMutationInput
): Promise<CrudActionResult<{ id: string; fingerprint: string }>> {
  try {
    if (!id) return { success: false, message: "ID transaksi tidak valid." };

    const existingRows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    if (existingRows.length === 0) {
      return {
        success: false,
        conflict: "DELETED",
        message: "Transaksi ini telah dihapus oleh pengguna lain.",
      };
    }

    const existingTx = existingRows[0];
    const currentFingerprint = computeTransactionFingerprint(existingTx);

    if (expectedFingerprint && currentFingerprint !== expectedFingerprint) {
      return {
        success: false,
        conflict: "MODIFIED",
        message:
          "Transaksi ini baru saja diubah oleh pengguna lain. Silakan muat data terbaru sebelum menyimpan.",
        freshFingerprint: currentFingerprint,
        freshTransaction: existingTx,
      };
    }

    const formattedTime = input.time?.trim() || existingTx.time || "00:00:00";

    const updatedTx = {
      accountId: input.accountId,
      targetAccountId: input.type === "TRANSFER" ? input.targetAccountId || null : null,
      categoryId: input.categoryId || null,
      subcategoryId: input.subcategoryId || null,
      amount: Math.round(input.amount),
      type: input.type,
      date: input.date,
      time: formattedTime,
      description: input.description.trim(),
      note: input.note !== undefined ? input.note?.trim() || null : existingTx.note,
    };

    await db.update(transactions).set(updatedTx).where(eq(transactions.id, id));

    const affected = [
      existingTx.accountId,
      existingTx.targetAccountId,
      input.accountId,
      input.targetAccountId,
    ].filter(Boolean) as string[];

    await recalculateAccountBalances(affected);

    const newFingerprint = computeTransactionFingerprint({
      ...existingTx,
      ...updatedTx,
    });

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/monthly");

    return {
      success: true,
      message: "Transaksi berhasil diperbarui.",
      data: { id, fingerprint: newFingerprint },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Gagal memperbarui transaksi.",
    };
  }
}

/**
 * Deletes a transaction with Optimistic Concurrency Control (OCC) guard.
 */
export async function deleteTransactionAction(
  id: string,
  expectedFingerprint?: string
): Promise<CrudActionResult<{ id: string }>> {
  try {
    if (!id) return { success: false, message: "ID transaksi tidak valid." };

    const existingRows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    if (existingRows.length === 0) {
      return {
        success: false,
        conflict: "DELETED",
        message: "Transaksi ini sudah tidak ditemukan atau telah dihapus.",
      };
    }

    const existingTx = existingRows[0];
    const currentFingerprint = computeTransactionFingerprint(existingTx);

    if (expectedFingerprint && currentFingerprint !== expectedFingerprint) {
      return {
        success: false,
        conflict: "MODIFIED",
        message:
          "Transaksi ini baru saja diubah oleh pengguna lain sehingga penghapusan dibatalkan demi keamanan data.",
        freshFingerprint: currentFingerprint,
        freshTransaction: existingTx,
      };
    }

    await db.delete(transactions).where(eq(transactions.id, id));

    const affected = [existingTx.accountId, existingTx.targetAccountId].filter(Boolean) as string[];
    await recalculateAccountBalances(affected);

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/monthly");

    return {
      success: true,
      message: "Transaksi berhasil dihapus.",
      data: { id },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Gagal menghapus transaksi.",
    };
  }
}
