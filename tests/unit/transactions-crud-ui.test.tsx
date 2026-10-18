import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { TransactionsClient, TransactionRow } from "@/components/transactions/transactions-client";

const currentYear = new Date().getFullYear();
const currentMonthNumber = String(new Date().getMonth() + 1).padStart(2, "0");
const currentMonthStr = `${currentYear}-${currentMonthNumber}`;

const mockTransactions: TransactionRow[] = [
  {
    id: "tx-crud-1",
    inputOrder: 1,
    date: `${currentMonthStr}-15`,
    time: "10:30:00",
    amount: 5000000,
    type: "EXPENSE",
    description: "Kopi Kenangan",
    note: "Jajan",
    sourceType: "MANUAL",
    transferPairId: null,
    accountId: "acc-bca",
    accountName: "BCA (Baim)",
    categoryName: "🥣 Makanan & Minuman",
  },
];

const mockAccountsMetadata = [
  { id: "acc-bca", name: "BCA (Baim)", initialBalance: 100000000, currentBalance: 95000000 },
];

const mockCategoriesData = [
  {
    id: "cat-1",
    name: "🥣 Makanan & Minuman",
    type: "EXPENSE",
    subcategories: [{ id: "sub-1", name: "Kopi" }],
  },
];

describe("Transactions Client CRUD UI Integration", () => {
  it("renders '+ Tambah Transaksi' button in header and opens create dialog", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
        accountsMetadata={mockAccountsMetadata}
        categoriesData={mockCategoriesData}
      />
    );

    const addBtn = screen.getByRole("button", { name: /\+ Tambah Transaksi/i });
    expect(addBtn).toBeDefined();

    fireEvent.click(addBtn);
    expect(screen.getByText("Tambah Transaksi Baru")).toBeDefined();
  });

  it("renders 'Aksi' table header and edit/delete action buttons in transaction rows", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
        accountsMetadata={mockAccountsMetadata}
        categoriesData={mockCategoriesData}
      />
    );

    const table = screen.getByRole("table");
    expect(within(table).getByText("Aksi")).toBeDefined();

    // Find row
    const editBtn = screen.getByRole("button", { name: /Edit Transaksi Kopi Kenangan/i });
    const deleteBtn = screen.getByRole("button", { name: /Hapus Transaksi Kopi Kenangan/i });

    expect(editBtn).toBeDefined();
    expect(deleteBtn).toBeDefined();

    // Clicking edit opens form in edit mode
    fireEvent.click(editBtn);
    expect(screen.getByText("Edit Mutasi Transaksi")).toBeDefined();
  });

  it("renders delete confirmation dialog when delete button is clicked", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
        accountsMetadata={mockAccountsMetadata}
        categoriesData={mockCategoriesData}
      />
    );

    const deleteBtn = screen.getByRole("button", { name: /Hapus Transaksi Kopi Kenangan/i });
    fireEvent.click(deleteBtn);

    expect(screen.getByText("Hapus Transaksi Ini?")).toBeDefined();
    expect(screen.getAllByText("Kopi Kenangan").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/mengembalikan saldo/i)).toBeDefined();
  });
});
