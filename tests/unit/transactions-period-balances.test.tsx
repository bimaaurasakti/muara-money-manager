import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import {
  TransactionsClient,
  TransactionRow,
  AccountMetadata,
  calculatePeriodBalances,
} from "@/components/transactions/transactions-client";
import { usePrivacyStore } from "@/store/use-privacy-store";

const currentYear = new Date().getFullYear();
const currentMonthNumber = String(new Date().getMonth() + 1).padStart(2, "0");
const currentMonthStr = `${currentYear}-${currentMonthNumber}`;

describe("Transactions Period Starting & Ending Balances Feature", () => {
  const mockAccountsMetadata: AccountMetadata[] = [
    {
      id: "acc-bca",
      name: "BCA (Baim)",
      initialBalance: 10000000, // Rp 100.000,00
      currentBalance: 11500000,
    },
    {
      id: "acc-blu",
      name: "Blu BCA",
      initialBalance: 5000000, // Rp 50.000,00
      currentBalance: 5000000,
    },
  ];

  const mockTransactions: TransactionRow[] = [
    // Past transaction (earlier month)
    {
      id: "tx-past",
      inputOrder: 1,
      date: "2025-01-10",
      time: "10:00:00",
      amount: 2000000, // Rp 20.000,00
      type: "EXPENSE",
      description: "Belanja Lampau",
      note: null,
      sourceType: "MANUAL",
      transferPairId: null,
      accountId: "acc-bca",
      accountName: "BCA (Baim)",
      categoryName: "Belanja",
    },
    // Current month transactions
    {
      id: "tx-cur-1",
      inputOrder: 2,
      date: `${currentMonthStr}-05`,
      time: "09:00:00",
      amount: 5000000, // Rp 50.000,00
      type: "INCOME",
      description: "Gaji Freelance",
      note: null,
      sourceType: "MANUAL",
      transferPairId: null,
      accountId: "acc-bca",
      accountName: "BCA (Baim)",
      categoryName: "Pemasukan",
    },
    {
      id: "tx-cur-2",
      inputOrder: 3,
      date: `${currentMonthStr}-15`,
      time: "14:00:00",
      amount: 1000000, // Rp 10.000,00
      type: "EXPENSE",
      description: "Tagihan Internet",
      note: null,
      sourceType: "MANUAL",
      transferPairId: null,
      accountId: "acc-bca",
      accountName: "BCA (Baim)",
      categoryName: "Tagihan",
    },
  ];

  beforeEach(() => {
    usePrivacyStore.getState().setBalanceHidden(false);
  });

  describe("calculatePeriodBalances Engine", () => {
    it("accurately computes start and end balance for a specific month", () => {
      const summary = calculatePeriodBalances(
        mockTransactions,
        mockAccountsMetadata,
        "BCA (Baim)",
        currentMonthStr
      );

      // Start balance: 100.000 (initial) - 20.000 (past expense) = 80.000 (8.000.000 cents)
      expect(summary.startBalance).toBe(8000000);
      // End balance: 80.000 + 50.000 (income) - 10.000 (expense) = 120.000 (12.000.000 cents)
      expect(summary.endBalance).toBe(12000000);
      expect(summary.startDateStr).toBe(`${currentMonthStr}-01`);
    });

    it("accurately computes start and end balance when viewing ALL periods", () => {
      const summary = calculatePeriodBalances(
        mockTransactions,
        mockAccountsMetadata,
        "BCA (Baim)",
        "ALL"
      );

      // In ALL periods, start balance is initialBalance
      expect(summary.startBalance).toBe(10000000);
      // End balance is final balance across all transactions: 100.000 - 20.000 + 50.000 - 10.000 = 120.000
      expect(summary.endBalance).toBe(12000000);
    });
  });

  describe("Table UI Dynamic Rendering for Saldo Awal & Saldo Akhir", () => {
    it("renders Saldo Akhir at top and Saldo Awal at bottom under default DESC sort", () => {
      render(
        <TransactionsClient
          initialTransactions={mockTransactions}
          accounts={["BCA (Baim)", "Blu BCA"]}
          accountsMetadata={mockAccountsMetadata}
          initialWallet="BCA (Baim)"
          initialSort="date-desc"
        />
      );

      const table = screen.getByRole("table");
      const rows = within(table).getAllByRole("row").slice(1); // exclude header

      // Top body row should be Saldo Akhir (ending balance 120.000)
      expect(rows[0].textContent).toContain("Saldo Akhir");
      expect(rows[0].textContent).toContain("120.000");

      // Bottom body row should be Saldo Awal (starting balance 80.000)
      const lastRow = rows[rows.length - 1];
      expect(lastRow.textContent).toContain("Saldo Awal");
      expect(lastRow.textContent).toContain("80.000");
    });

    it("renders Saldo Awal at top and Saldo Akhir at bottom under ASC sort", () => {
      render(
        <TransactionsClient
          initialTransactions={mockTransactions}
          accounts={["BCA (Baim)", "Blu BCA"]}
          accountsMetadata={mockAccountsMetadata}
          initialWallet="BCA (Baim)"
          initialSort="date-asc"
        />
      );

      const table = screen.getByRole("table");
      const rows = within(table).getAllByRole("row").slice(1); // exclude header

      // Top body row should be Saldo Awal
      expect(rows[0].textContent).toContain("Saldo Awal");
      expect(rows[0].textContent).toContain("80.000");

      // Bottom body row should be Saldo Akhir
      const lastRow = rows[rows.length - 1];
      expect(lastRow.textContent).toContain("Saldo Akhir");
      expect(lastRow.textContent).toContain("120.000");
    });

    it("hides Saldo Awal and Saldo Akhir rows when searchTerm is active", () => {
      render(
        <TransactionsClient
          initialTransactions={mockTransactions}
          accounts={["BCA (Baim)", "Blu BCA"]}
          accountsMetadata={mockAccountsMetadata}
          initialWallet="BCA (Baim)"
        />
      );

      const tableBefore = screen.getByRole("table");
      expect(tableBefore.textContent).toContain("Saldo Awal");
      expect(tableBefore.textContent).toContain("Saldo Akhir");

      const searchInput = screen.getByPlaceholderText(/cari transaksi/i);
      fireEvent.change(searchInput, { target: { value: "Freelance" } });

      const tableAfter = screen.getByRole("table");
      expect(tableAfter.textContent).toContain("Gaji Freelance");
      expect(tableAfter.textContent).not.toContain("Saldo Awal");
      expect(tableAfter.textContent).not.toContain("Saldo Akhir");
    });

    it("masks starting and ending balances when Privacy Mode is activated", () => {
      usePrivacyStore.getState().setBalanceHidden(true);

      render(
        <TransactionsClient
          initialTransactions={mockTransactions}
          accounts={["BCA (Baim)", "Blu BCA"]}
          accountsMetadata={mockAccountsMetadata}
          initialWallet="BCA (Baim)"
        />
      );

      const table = screen.getByRole("table");
      expect(table.textContent).toContain("Saldo Awal");
      expect(table.textContent).toContain("Saldo Akhir");
      // Balances should be masked
      expect(table.textContent).not.toContain("120.000");
      expect(table.textContent).not.toContain("80.000");
      expect(table.textContent).toContain("••••••••");
    });
  });
});
