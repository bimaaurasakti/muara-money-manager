import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  TransactionsClient,
  TransactionRow,
  AccountMetadata,
  calculateRunningBalances,
} from "@/components/transactions/transactions-client";
import { usePrivacyStore } from "@/store/use-privacy-store";

const currentYear = new Date().getFullYear();
const currentMonthNumber = String(new Date().getMonth() + 1).padStart(2, "0");
const currentMonthStr = `${currentYear}-${currentMonthNumber}`;

describe("Transactions Running Balance (Saldo Berjalan) Feature", () => {
  const mockAccountsMetadata: AccountMetadata[] = [
    {
      id: "acc-bca",
      name: "BCA (Baim)",
      initialBalance: 16276381, // Rp 162.763,81
      currentBalance: 10653481,
    },
    {
      id: "acc-blu",
      name: "Blu BCA",
      initialBalance: 5000000, // Rp 50.000,00
      currentBalance: 10000000,
    },
  ];

  const mockTransactions: TransactionRow[] = [
    {
      id: "tx-1",
      inputOrder: 1,
      date: `${currentMonthStr}-02`,
      time: "10:00:00",
      amount: 3850000, // Rp 38.500,00
      type: "EXPENSE",
      description: "Pembayaran QRIS MCD",
      note: null,
      sourceType: "CSV_BLU",
      transferPairId: null,
      accountId: "acc-bca",
      accountName: "BCA (Baim)",
      categoryName: "Makanan",
    },
    {
      id: "tx-2",
      inputOrder: 2,
      date: `${currentMonthStr}-05`,
      time: "12:30:00",
      amount: 3277100, // Rp 32.771,00
      type: "INCOME",
      description: "Dana Masuk Transfer",
      note: null,
      sourceType: "CSV_BLU",
      transferPairId: null,
      accountId: "acc-bca",
      accountName: "BCA (Baim)",
      categoryName: "Pemasukan Lain",
    },
    {
      id: "tx-3",
      inputOrder: 3,
      date: `${currentMonthStr}-09`,
      time: "15:00:00",
      amount: 5050000, // Rp 50.500,00
      type: "EXPENSE",
      description: "Beli Online",
      note: null,
      sourceType: "CSV_BLU",
      transferPairId: null,
      accountId: "acc-bca",
      accountName: "BCA (Baim)",
      categoryName: "Belanja",
    },
  ];

  beforeEach(() => {
    // Unmask balance for nominal/saldo inspection by default
    usePrivacyStore.getState().setBalanceHidden(false);
  });

  describe("calculateRunningBalances Engine", () => {
    it("accurately computes cumulative chronological running balances from initial balance", () => {
      const balanceMap = calculateRunningBalances(mockTransactions, mockAccountsMetadata);

      // Initial: 162.763,81
      // After tx-1 (-38.500,00): 124.263,81
      const res1 = balanceMap.get("tx-1");
      expect(res1?.sourceBalance).toBe(12426381);

      // After tx-2 (+32.771,00): 157.034,81
      const res2 = balanceMap.get("tx-2");
      expect(res2?.sourceBalance).toBe(15703481);

      // After tx-3 (-50.500,00): 106.534,81
      const res3 = balanceMap.get("tx-3");
      expect(res3?.sourceBalance).toBe(10653481);
    });

    it("handles intra-wallet transfers updating both source and target balances", () => {
      const transferTxs: TransactionRow[] = [
        {
          id: "tx-transfer",
          inputOrder: 1,
          date: "2026-08-10",
          time: "09:00:00",
          amount: 5000000, // Rp 50.000
          type: "TRANSFER",
          description: "Pindah Uang BCA ke Blu",
          note: null,
          sourceType: "MANUAL",
          transferPairId: null,
          accountId: "acc-bca",
          accountName: "BCA (Baim)",
          targetAccountId: "acc-blu",
          targetAccountName: "Blu BCA",
          categoryName: "🔄 Pindah Uang",
        },
      ];

      const balanceMap = calculateRunningBalances(transferTxs, mockAccountsMetadata);
      const res = balanceMap.get("tx-transfer");

      // BCA was 162.763,81 - 50.000 = 112.763,81
      expect(res?.sourceBalance).toBe(11276381);
      // Blu was 50.000,00 + 50.000 = 100.000,00
      expect(res?.targetBalance).toBe(10000000);
    });
  });

  describe("Table UI Rendering for Saldo Column", () => {
    it("renders 'Saldo' column header", () => {
      render(
        <TransactionsClient
          initialTransactions={mockTransactions}
          accounts={["BCA (Baim)", "Blu BCA"]}
          accountsMetadata={mockAccountsMetadata}
        />
      );

      const table = screen.getByRole("table");
      expect(within(table).getByText("Saldo")).toBeDefined();
    });

    it("displays the correct point-in-time balance in each row under default DESC sort", () => {
      render(
        <TransactionsClient
          initialTransactions={mockTransactions}
          accounts={["BCA (Baim)", "Blu BCA"]}
          accountsMetadata={mockAccountsMetadata}
          initialSort="date-desc"
        />
      );

      const table = screen.getByRole("table");
      const rows = within(table).getAllByRole("row").slice(1); // exclude header

      // In DESC order:
      // Row 0 is tx-3 (09/08): Saldo should be 106.534,81
      // Row 1 is tx-2 (05/08): Saldo should be 157.034,81
      // Row 2 is tx-1 (02/08): Saldo should be 124.263,81
      expect(rows[0].textContent).toContain("106.534");
      expect(rows[1].textContent).toContain("157.034");
      expect(rows[2].textContent).toContain("124.263");
    });

    it("displays the correct point-in-time balance in each row under ASC sort (Terlama ➔ Terbaru)", () => {
      render(
        <TransactionsClient
          initialTransactions={mockTransactions}
          accounts={["BCA (Baim)", "Blu BCA"]}
          accountsMetadata={mockAccountsMetadata}
          initialSort="date-asc"
        />
      );

      const table = screen.getByRole("table");
      const rows = within(table).getAllByRole("row").slice(1);

      // In ASC order:
      // Row 0 is tx-1 (02/08): Saldo should be 124.263,81
      // Row 1 is tx-2 (05/08): Saldo should be 157.034,81
      // Row 2 is tx-3 (09/08): Saldo should be 106.534,81
      expect(rows[0].textContent).toContain("124.263");
      expect(rows[1].textContent).toContain("157.034");
      expect(rows[2].textContent).toContain("106.534");
    });

    it("displays correct wallet balance when filtered by destination wallet on transfer", () => {
      const transferTx: TransactionRow = {
        id: "tx-tf-1",
        inputOrder: 1,
        date: `${currentMonthStr}-01`,
        time: "10:00:00",
        amount: 2000000, // Rp 20.000
        type: "TRANSFER",
        description: "Pindah dana",
        note: null,
        sourceType: "MANUAL",
        transferPairId: null,
        accountId: "acc-bca",
        accountName: "BCA (Baim)",
        targetAccountId: "acc-blu",
        targetAccountName: "Blu BCA",
        categoryName: "🔄 Pindah Uang",
      };

      // Filtered to Blu BCA (target wallet) -> should show Blu BCA's receiving balance (50.000 + 20.000 = 70.000)
      render(
        <TransactionsClient
          initialTransactions={[transferTx]}
          accounts={["BCA (Baim)", "Blu BCA"]}
          accountsMetadata={mockAccountsMetadata}
          initialWallet="Blu BCA"
        />
      );

      const table = screen.getByRole("table");
      const row = within(table).getAllByRole("row")[1];
      expect(row.textContent).toContain("70.000");
    });

    it("masks Saldo when Privacy Mode is activated", () => {
      usePrivacyStore.getState().setBalanceHidden(true);

      render(
        <TransactionsClient
          initialTransactions={mockTransactions}
          accounts={["BCA (Baim)", "Blu BCA"]}
          accountsMetadata={mockAccountsMetadata}
        />
      );

      const table = screen.getByRole("table");
      // All amounts and balances should be masked with bullets
      expect(table.textContent).toContain("••••••••");
      expect(table.textContent).not.toContain("106.534");
      expect(table.textContent).not.toContain("157.034");
    });
  });
});
