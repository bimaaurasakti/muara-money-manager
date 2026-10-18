import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
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
});
