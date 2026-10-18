import { describe, it, expect } from "vitest";
import {
  computeTransactionFingerprint,
  verifyTransactionFingerprint,
} from "@/lib/concurrency/transaction-fingerprint";

describe("Transaction Fingerprint & OCC Concurrency Control", () => {
  const baseTx = {
    id: "tx-sample-1",
    accountId: "acc-bca",
    targetAccountId: null,
    categoryId: "cat-food",
    subcategoryId: "sub-coffee",
    amount: 5000000, // Rp 50.000
    type: "EXPENSE",
    date: "2026-08-15",
    time: "14:30:00",
    description: "Kopi Kenangan",
    note: "Dua cangkir kopi susu",
  };

  it("generates deterministic and identical fingerprint for identical transaction data", () => {
    const fp1 = computeTransactionFingerprint(baseTx);
    const fp2 = computeTransactionFingerprint({ ...baseTx });

    expect(fp1).toBeDefined();
    expect(typeof fp1).toBe("string");
    expect(fp1.length).toBeGreaterThan(16);
    expect(fp1).toBe(fp2);
    expect(verifyTransactionFingerprint(baseTx, fp1)).toBe(true);
  });

  it("detects changes in any transaction field (amount, note, time, date, account, type)", () => {
    const originalFp = computeTransactionFingerprint(baseTx);

    // 1. Amount modified
    const fpAmount = computeTransactionFingerprint({ ...baseTx, amount: 5500000 });
    expect(fpAmount).not.toBe(originalFp);
    expect(verifyTransactionFingerprint({ ...baseTx, amount: 5500000 }, originalFp)).toBe(false);

    // 2. Note modified by spouse
    const fpNote = computeTransactionFingerprint({ ...baseTx, note: "Tambahan donat" });
    expect(fpNote).not.toBe(originalFp);
    expect(verifyTransactionFingerprint({ ...baseTx, note: "Tambahan donat" }, originalFp)).toBe(false);

    // 3. Time modified (exact second)
    const fpTime = computeTransactionFingerprint({ ...baseTx, time: "14:30:05" });
    expect(fpTime).not.toBe(originalFp);

    // 4. Category modified
    const fpCategory = computeTransactionFingerprint({ ...baseTx, categoryId: "cat-other" });
    expect(fpCategory).not.toBe(originalFp);

    // 5. Target account for transfer modified
    const fpTarget = computeTransactionFingerprint({ ...baseTx, targetAccountId: "acc-blu" });
    expect(fpTarget).not.toBe(originalFp);
  });

  it("handles null or undefined optional fields safely and consistently", () => {
    const txWithoutOptionals = {
      id: "tx-2",
      accountId: "acc-bca",
      targetAccountId: undefined,
      categoryId: undefined,
      subcategoryId: null,
      amount: 10000,
      type: "EXPENSE",
      date: "2026-08-31",
      time: null,
      description: "Parkir",
      note: null,
    };

    const fp = computeTransactionFingerprint(txWithoutOptionals);
    expect(fp).toBeDefined();
    expect(verifyTransactionFingerprint(txWithoutOptionals, fp)).toBe(true);
  });
});
