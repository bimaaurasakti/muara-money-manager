import { describe, it, expect } from "vitest";
import {
  markDuplicateCandidates,
  ExistingDbTransaction,
} from "@/lib/reconciliation/fingerprint";
import { CandidateTransaction } from "@/lib/reconciliation/transfer-detector";
import { buildIngestionSystemPrompt, ExistingReferenceTransaction } from "@/lib/gemini/prompts";

describe("Inter-Wallet Transfer Reconciliation & Contra-Leg Matcher", () => {
  const accountMap = new Map<string, string>([
    ["dana (baim)", "acc-dana-id"],
    ["blu bca (baim)", "acc-blu-id"],
    ["bca (baim)", "acc-bca-id"],
  ]);

  it("successfully matches incoming statement mutation with existing DB transfer (August 5, 2026 scenario)", () => {
    // 1. Existing transfer record in DB (from Dana to Blu BCA)
    const existingDbTxs: ExistingDbTransaction[] = [
      {
        id: "tx-transfer-aug5",
        accountId: "acc-dana-id", // Dana (Baim)
        targetAccountId: "acc-blu-id", // Blu BCA (Baim)
        date: "2026-08-05",
        time: "11:52:32",
        amount: 3277100, // Rp 32.771 in cents
        type: "TRANSFER",
        description: "Transfer ke Blu Baim",
      },
    ];

    // 2. Incoming statement mutation on Blu BCA CSV
    const bluCandidates: CandidateTransaction[] = [
      {
        id: "blu-csv-row-7",
        sourceWalletName: "Blu BCA (Baim)",
        date: "2026-08-05",
        time: null,
        amountCents: 3277100, // Rp 32.771
        type: "INCOME", // Raw type from "Pemasukan"
        description:
          "Dana Masuk dari BIMA AURASAKTI ROCHMATULLAH | DANA - DANA20260805DANAIDJ1010O9993138256BIMAAURASAKTIROCHMATULLAH",
      },
      {
        id: "blu-csv-row-9",
        sourceWalletName: "Blu BCA (Baim)",
        date: "2026-08-09",
        time: null,
        amountCents: 2500000,
        type: "INCOME",
        description: "Cashback | BLUKKMAPPTC26",
      },
    ];

    const results = markDuplicateCandidates(bluCandidates, existingDbTxs, accountMap);

    // Row 7 (the 32.771 transfer) must be matched and flagged as duplicate
    const matchedTransfer = results.find((r) => r.id === "blu-csv-row-7")!;
    expect(matchedTransfer.isDuplicate).toBe(true);
    expect(matchedTransfer.type).toBe("TRANSFER");
    expect(matchedTransfer.transferPairId).toBe("tx-transfer-aug5");
    expect(matchedTransfer.duplicateReason).toContain("Dana (Baim)");
    expect(matchedTransfer.duplicateReason).toContain("Blu BCA (Baim)");

    // Row 9 (regular cashback) must NOT be marked as duplicate
    const cashback = results.find((r) => r.id === "blu-csv-row-9")!;
    expect(cashback.isDuplicate).toBe(false);
  });

  it("successfully matches outgoing statement mutation with existing DB transfer (source account leg)", () => {
    const existingDbTxs: ExistingDbTransaction[] = [
      {
        id: "tx-bca-to-dana",
        accountId: "acc-bca-id",
        targetAccountId: "acc-dana-id",
        date: "2026-08-15",
        time: "10:00:00",
        amount: 50000000, // Rp 500.000
        type: "TRANSFER",
        description: "Top up Dana",
      },
    ];

    const bcaCandidates: CandidateTransaction[] = [
      {
        id: "bca-outflow-cand",
        sourceWalletName: "BCA (Baim)",
        date: "2026-08-15",
        time: null,
        amountCents: 50000000,
        type: "EXPENSE",
        description: "TRSF E-BANKING DB TOP UP DANA",
      },
    ];

    const results = markDuplicateCandidates(bcaCandidates, existingDbTxs, accountMap);
    const matched = results[0];

    expect(matched.isDuplicate).toBe(true);
    expect(matched.type).toBe("TRANSFER");
    expect(matched.transferPairId).toBe("tx-bca-to-dana");
    expect(matched.duplicateReason).toContain("BCA (Baim)");
  });

  it("injects transfer route context into Gemini prompt for accurate AI duplicate detection", () => {
    const existingTxs: ExistingReferenceTransaction[] = [
      {
        id: "tx-aug5",
        date: "2026-08-05",
        time: "11:52:32",
        amount: 32771,
        type: "TRANSFER",
        description: "Transfer ke Blu Baim",
        sourceWalletName: "Dana (Baim)",
        targetWalletName: "Blu BCA (Baim)",
      },
    ];

    const prompt = buildIngestionSystemPrompt("Blu BCA (Baim)", [], existingTxs);

    expect(prompt).toContain("PRIOR DATABASE TRANSACTIONS FOR THIS ACCOUNT & DATE RANGE (DUPLICATE REFERENCE):");
    expect(prompt).toContain("Transfer: Dana (Baim) -> Blu BCA (Baim)");
    expect(prompt).toContain("32771");
    expect(prompt).toContain("Inter-Wallet Contra-Transfer Matching");
  });
});
