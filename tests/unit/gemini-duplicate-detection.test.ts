import { describe, it, expect } from "vitest";
import { buildIngestionSystemPrompt, ExistingReferenceTransaction } from "@/lib/gemini/prompts";
import { transactionSchema } from "@/lib/gemini/extractor";

describe("Gemini Semantic Duplicate Detection & Database Context Injection", () => {
  it("injects prior database transactions and duplicate detection rules into system prompt", () => {
    const existingTxs: ExistingReferenceTransaction[] = [
      {
        id: "tx-db-001",
        date: "2026-08-02",
        time: "14:30:00",
        amount: 38500,
        type: "EXPENSE",
        description: "MCDONALD'S SOK 24601",
      },
      {
        id: "tx-db-002",
        date: "2026-08-05",
        time: null,
        amount: 32771,
        type: "INCOME",
        description: "Dana Masuk dari BIMA AURASAKTI ROCHMATULLAH",
      },
    ];

    const prompt = buildIngestionSystemPrompt("Blu BCA (Baim)", [], existingTxs);

    // Verify injected section header
    expect(prompt).toContain("PRIOR DATABASE TRANSACTIONS FOR THIS ACCOUNT & DATE RANGE (DUPLICATE REFERENCE):");

    // Verify transaction 1 details
    expect(prompt).toContain("tx-db-001");
    expect(prompt).toContain("2026-08-02");
    expect(prompt).toContain("38500");
    expect(prompt).toContain("MCDONALD'S SOK 24601");

    // Verify transaction 2 details
    expect(prompt).toContain("tx-db-002");
    expect(prompt).toContain("2026-08-05");
    expect(prompt).toContain("32771");

    // Verify duplicate detection rules
    expect(prompt).toContain("DUPLICATE DETECTION RULES");
    expect(prompt).toContain("isDuplicate");
    expect(prompt).toContain("duplicateReason");
    expect(prompt).toContain("matchedExistingTxId");
  });

  it("handles empty existingTransactions gracefully without crashing or polluting prompt", () => {
    const prompt = buildIngestionSystemPrompt("Blu BCA (Baim)", [], []);
    expect(prompt).toContain("DUPLICATE DETECTION RULES");
    expect(prompt).not.toContain("PRIOR DATABASE TRANSACTIONS FOR THIS ACCOUNT & DATE RANGE (DUPLICATE REFERENCE):");
  });

  it("verifies transactionSchema includes isDuplicate, duplicateReason, and matchedExistingTxId properties", () => {
    const itemProps = (transactionSchema as any).properties.transactions.items.properties;

    expect(itemProps).toHaveProperty("isDuplicate");
    expect(itemProps).toHaveProperty("duplicateReason");
    expect(itemProps).toHaveProperty("matchedExistingTxId");
  });

  it("ensures markDuplicateCandidates preserves AI-flagged semantic duplicates", async () => {
    const { markDuplicateCandidates } = await import("@/lib/reconciliation/fingerprint");

    const candidates = [
      {
        id: "cand-1",
        sourceWalletName: "Blu BCA (Baim)",
        amountCents: 5000000,
        type: "EXPENSE" as const,
        date: "2026-08-10",
        description: "BELI PULSA ONLINE VIA APLIKASI",
        isDuplicate: true,
        duplicateReason: "Duplikat semantik terdeteksi oleh AI: Pembelian pulsa di hari dan nominal sama.",
      },
      {
        id: "cand-2",
        sourceWalletName: "Blu BCA (Baim)",
        amountCents: 2000000,
        type: "EXPENSE" as const,
        date: "2026-08-11",
        description: "MAKAN SIANG WARTEG",
        isDuplicate: false,
      },
    ];

    const walletMap = new Map([["blu bca (baim)", "acc-blu-1"]]);
    const marked = markDuplicateCandidates(candidates, [], walletMap);

    expect(marked[0].isDuplicate).toBe(true);
    expect(marked[0].duplicateReason).toContain("Duplikat semantik terdeteksi oleh AI");
    expect(marked[1].isDuplicate).toBe(false);
  });
});
