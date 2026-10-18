import crypto from "node:crypto";

export interface TransactionFingerprintInput {
  accountId: string;
  targetAccountId?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  amount: number;
  type: string;
  date: string;
  time?: string | null;
  description: string;
  note?: string | null;
}

/**
 * Computes a deterministic SHA-256 state fingerprint for a transaction.
 * Used for Optimistic Concurrency Control (OCC) to prevent conflicting edits between users.
 */
export function computeTransactionFingerprint(tx: TransactionFingerprintInput): string {
  const canonical = [
    tx.accountId?.trim() || "",
    (tx.targetAccountId || "").trim(),
    (tx.categoryId || "").trim(),
    (tx.subcategoryId || "").trim(),
    String(Math.round(Number(tx.amount || 0))),
    tx.type?.trim().toUpperCase() || "",
    tx.date?.trim() || "",
    (tx.time || "").trim(),
    tx.description?.trim() || "",
    (tx.note || "").trim(),
  ].join("|");

  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Verifies whether the current transaction state matches the expected fingerprint.
 */
export function verifyTransactionFingerprint(
  currentTx: TransactionFingerprintInput,
  expectedFingerprint: string
): boolean {
  if (!expectedFingerprint) return false;
  const currentFp = computeTransactionFingerprint(currentTx);
  return currentFp === expectedFingerprint;
}
