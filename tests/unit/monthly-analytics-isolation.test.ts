import { describe, it, expect } from "vitest";
import { isOperationalTransaction } from "@/lib/data/monthly-analytics";

describe("Monthly Analytics Operational Isolation for Penyesuaian Saldo", () => {
  it("excludes '⚙️ Penyesuaian Saldo' from operational income and expense", () => {
    const mockTransactions = [
      {
        id: "tx-income-salary",
        amountCents: 1000000000, // Rp 10.000.000
        type: "INCOME" as const,
        transferPairId: null,
        categoryName: "💲 Pemasukan Utama",
      },
      {
        id: "tx-expense-living",
        amountCents: 300000000, // Rp 3.000.000
        type: "EXPENSE" as const,
        transferPairId: null,
        categoryName: "🏠 Tempat Tinggal",
      },
      {
        id: "tx-adj-positive",
        amountCents: 50000000, // Rp 500.000 (Penyesuaian saldo surplus migrasi)
        type: "INCOME" as const,
        transferPairId: null,
        categoryName: "⚙️ Penyesuaian Saldo",
      },
      {
        id: "tx-adj-negative",
        amountCents: 20000000, // Rp 200.000 (Penyesuaian saldo defisit migrasi)
        type: "EXPENSE" as const,
        transferPairId: null,
        categoryName: "⚙️ Penyesuaian Saldo",
      },
      {
        id: "tx-transfer",
        amountCents: 100000000, // Rp 1.000.000
        type: "TRANSFER" as const,
        transferPairId: "pair-1",
        categoryName: "🔄 Pindah Uang",
      },
    ];

    // Filter using isOperationalTransaction
    const operationalIncomes = mockTransactions.filter(
      (t) => t.type === "INCOME" && isOperationalTransaction(t.categoryName, t.transferPairId, t.type)
    );
    const operationalExpenses = mockTransactions.filter(
      (t) => t.type === "EXPENSE" && isOperationalTransaction(t.categoryName, t.transferPairId, t.type)
    );

    const totalIncome = operationalIncomes.reduce((sum, t) => sum + t.amountCents, 0);
    const totalExpense = operationalExpenses.reduce((sum, t) => sum + t.amountCents, 0);

    // Operational income must only be salary (10.000.000), not including the 500.000 adjustment
    expect(totalIncome).toBe(1000000000);
    // Operational expense must only be rent (3.000.000), not including the 200.000 adjustment
    expect(totalExpense).toBe(300000000);
    // Net cashflow
    expect(totalIncome - totalExpense).toBe(700000000);
  });
});
