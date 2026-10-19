import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import {
  TransactionsClient,
  TransactionRow,
} from "@/components/transactions/transactions-client";

const currentYear = new Date().getFullYear();
const currentMonthNumber = String(new Date().getMonth() + 1).padStart(2, "0");
const currentMonthStr = `${currentYear}-${currentMonthNumber}`;

const mockTransactions: TransactionRow[] = [
  {
    id: "tx-expense",
    date: `${currentMonthStr}-01`,
    time: "10:00:00",
    amount: 1000000, // Rp 10.000
    type: "EXPENSE",
    description: "Admin BCA",
    note: null,
    sourceType: "CSV",
    transferPairId: null,
    accountId: "acc-bca",
    accountName: "BCA (Baim)",
    categoryName: "Biaya Bank",
  },
  {
    id: "tx-income",
    date: `${currentMonthStr}-02`,
    time: "11:00:00",
    amount: 20000000, // Rp 200.000
    type: "INCOME",
    description: "Jual Tiket Konser",
    note: null,
    sourceType: "MANUAL",
    transferPairId: null,
    accountId: "acc-bca",
    accountName: "BCA (Baim)",
    categoryName: "Lain-lain",
  },
  {
    id: "tx-transfer",
    date: `${currentMonthStr}-03`,
    time: "12:00:00",
    amount: 1300000000, // Rp 13.000.000
    type: "TRANSFER",
    description: "Transfer ke Emergency Fund",
    note: null,
    sourceType: "MANUAL",
    transferPairId: "pair-1",
    accountId: "acc-bca",
    accountName: "BCA (Baim)",
    targetAccountId: "acc-ef",
    targetAccountName: "Emergency Fund",
    categoryName: "🔄 Pindah Uang",
  },
  {
    id: "tx-self-transfer",
    date: `${currentMonthStr}-04`,
    time: "13:00:00",
    amount: 1707400000, // Rp 17.074.000
    type: "TRANSFER",
    description: "TRSF E-BANKING CR PYBCA",
    note: null,
    sourceType: "MANUAL",
    transferPairId: null,
    accountId: "acc-bca",
    accountName: "BCA (Baim)",
    targetAccountId: "acc-bca",
    targetAccountName: "BCA (Baim)",
    categoryName: "🔄 Pindah Uang",
  },
  {
    id: "tx-incoming-transfer",
    date: `${currentMonthStr}-05`,
    time: "14:00:00",
    amount: 2452650000, // Rp 24.526.500
    type: "TRANSFER",
    description: "Pinjem uang beli emas",
    note: null,
    sourceType: "MANUAL",
    transferPairId: "pair-2",
    accountId: "acc-ef",
    accountName: "Emergency Fund",
    targetAccountId: "acc-bca",
    targetAccountName: "BCA (Baim)",
    categoryName: "🔄 Pindah Uang",
  },
];

const mockAccounts = ["BCA (Baim)", "Emergency Fund"];

import { usePrivacyStore } from "@/store/use-privacy-store";

describe("Transaction Cash-Flow Nominal Signs Consistency", () => {
  beforeEach(() => {
    usePrivacyStore.setState({ isBalanceHidden: false });
  });

  it("renders '-' minus sign for pure EXPENSE and '+' plus sign for INCOME", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={mockAccounts}
        initialWallet="ALL"
      />
    );

    // Find table row for Admin BCA
    const expenseRow = screen.getByText("Admin BCA").closest("tr")!;
    const expenseNominal = within(expenseRow).getAllByRole("cell")[5];
    // The amount cell should display negative minus sign for expense: "- Rp 10.000"
    expect(within(expenseNominal).getByText("-")).toBeDefined();
    expect(within(expenseNominal).getByText("10.000")).toBeDefined();

    // Find table row for Jual Tiket Konser
    const incomeRow = screen.getByText("Jual Tiket Konser").closest("tr")!;
    const incomeNominal = within(incomeRow).getAllByRole("cell")[5];
    // The amount cell should display positive plus sign for income: "+ Rp 200.000"
    expect(within(incomeNominal).getByText("+")).toBeDefined();
    expect(within(incomeNominal).getByText("200.000")).toBeDefined();
  });

  it("renders '-' minus sign for outgoing TRANSFER when filtering to source wallet", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={mockAccounts}
        initialWallet="BCA (Baim)"
      />
    );

    const transferRow = screen.getByText("Transfer ke Emergency Fund").closest("tr")!;
    const transferNominal = within(transferRow).getAllByRole("cell")[5];
    // From BCA's perspective, transfer out is cash outflow (- Rp 13.000.000)
    expect(within(transferNominal).getByText("-")).toBeDefined();
    expect(within(transferNominal).getByText("13.000.000")).toBeDefined();
  });

  it("renders '+' plus sign for incoming TRANSFER when filtering to destination wallet", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={mockAccounts}
        initialWallet="Emergency Fund"
      />
    );

    const transferRow = screen.getByText("Transfer ke Emergency Fund").closest("tr")!;
    const transferNominal = within(transferRow).getAllByRole("cell")[5];
    // From Emergency Fund's perspective, transfer in is cash inflow (+ Rp 13.000.000)
    expect(within(transferNominal).getByText("+")).toBeDefined();
    expect(within(transferNominal).getByText("13.000.000")).toBeDefined();
  });

  it("renders NO plus/minus sign for internal TRANSFER when viewing ALL wallets", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={mockAccounts}
        initialWallet="ALL"
      />
    );

    const transferRow = screen.getByText("Transfer ke Emergency Fund").closest("tr")!;
    const transferNominal = within(transferRow).getAllByRole("cell")[5];
    // In ALL wallets portfolio view, internal transfer is neutral (no + or - sign)
    expect(within(transferNominal).queryByText("-")).toBeNull();
    expect(within(transferNominal).queryByText("+")).toBeNull();
    expect(within(transferNominal).getByText("13.000.000")).toBeDefined();
  });

  it("handles self-transfer without contradictory signs and with neutral Transfer badge when filtered to the account", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={mockAccounts}
        initialWallet="BCA (Baim)"
      />
    );

    // 1. Legitimate incoming transfer from Emergency Fund -> BCA (Baim)
    const incomingRow = screen.getByText("Pinjem uang beli emas").closest("tr")!;
    const incomingNominal = within(incomingRow).getAllByRole("cell")[5];
    const incomingBadgeCell = within(incomingRow).getAllByRole("cell")[7];
    expect(within(incomingNominal).getByText("+")).toBeDefined();
    expect(within(incomingNominal).getByText("24.526.500")).toBeDefined();
    expect(within(incomingBadgeCell).getByText("Transfer Masuk")).toBeDefined();

    // 2. Anomaly self-transfer (BCA -> BCA)
    const selfRow = screen.getByText("TRSF E-BANKING CR PYBCA").closest("tr")!;
    const selfNominal = within(selfRow).getAllByRole("cell")[5];
    const selfBadgeCell = within(selfRow).getAllByRole("cell")[7];

    // Must NOT have minus '-' sign, must NOT have '+' sign
    expect(within(selfNominal).queryByText("-")).toBeNull();
    expect(within(selfNominal).queryByText("+")).toBeNull();
    expect(within(selfNominal).getByText("17.074.000")).toBeDefined();

    // Badge must be neutral 'Transfer' (NOT 'Transfer Masuk' and NOT 'Transfer Keluar')
    expect(within(selfBadgeCell).queryByText("Transfer Masuk")).toBeNull();
    expect(within(selfBadgeCell).queryByText("Transfer Keluar")).toBeNull();
    expect(within(selfBadgeCell).getByText("Transfer")).toBeDefined();
  });

  it("excludes self-transfer from INCOME filter while preserving legitimate incoming transfers", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={mockAccounts}
        initialWallet="BCA (Baim)"
        initialType="INCOME"
      />
    );

    // Legitimate incoming transfer should appear
    expect(screen.getByText("Pinjem uang beli emas")).toBeDefined();

    // Pure income should appear
    expect(screen.getByText("Jual Tiket Konser")).toBeDefined();

    // Self-transfer should NOT appear in Pemasukan
    expect(screen.queryByText("TRSF E-BANKING CR PYBCA")).toBeNull();

    // Expense should NOT appear
    expect(screen.queryByText("Admin BCA")).toBeNull();
  });
});
