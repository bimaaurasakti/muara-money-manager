import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  TransactionsClient,
  TransactionRow,
} from "@/components/transactions/transactions-client";

const currentYear = new Date().getFullYear();
const currentMonthNumber = String(new Date().getMonth() + 1).padStart(2, "0");
const currentMonthStr = `${currentYear}-${currentMonthNumber}`;

const mockTransactions: TransactionRow[] = [
  {
    id: "tx-1",
    date: `${currentMonthStr}-01`,
    time: "10:00:00",
    amount: 1000000,
    type: "EXPENSE",
    description: "Tx Pagi 01",
    note: null,
    sourceType: "CSV",
    transferPairId: null,
    accountName: "BCA (Baim)",
    categoryName: "Makan",
  },
  {
    id: "tx-2",
    date: `${currentMonthStr}-01`,
    time: "18:30:00",
    amount: 2000000,
    type: "EXPENSE",
    description: "Tx Sore 01",
    note: null,
    sourceType: "CSV",
    transferPairId: null,
    accountName: "BCA (Baim)",
    categoryName: "Makan",
  },
  {
    id: "tx-3",
    date: `${currentMonthStr}-05`,
    time: "08:15:00",
    amount: 5000000,
    type: "INCOME",
    description: "Tx Pagi 05",
    note: null,
    sourceType: "CSV",
    transferPairId: null,
    accountName: "BCA (Baim)",
    categoryName: "Gaji",
  },
];

function getRenderedRowDescriptions(): string[] {
  const table = screen.getByRole("table");
  const rows = within(table).getAllByRole("row");
  // row 0 is header, rows 1..n are body rows
  return rows.slice(1).map((r) => {
    const cells = within(r).getAllByRole("cell");
    // With "No." column: cell 0 is No, cell 1 is Date, cell 2 is Wallet, cell 3 is Description
    return cells[3]?.textContent || cells[2]?.textContent || "";
  });
}

describe("Transactions Date Sorting Feature", () => {
  it("defaults to DESC date order (newest first) with time tie-breaker", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
      />
    );

    const descriptions = getRenderedRowDescriptions();
    expect(descriptions[0]).toContain("Tx Pagi 05"); // 05 (terbaru)
    expect(descriptions[1]).toContain("Tx Sore 01"); // 01 18:30:00
    expect(descriptions[2]).toContain("Tx Pagi 01"); // 01 10:00:00
  });

  it("toggles to ASC date order (oldest first) when clicking Tanggal header", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
      />
    );

    const sortButton = screen.getByRole("button", {
      name: /urutkan tanggal/i,
    });
    fireEvent.click(sortButton);

    const descriptions = getRenderedRowDescriptions();
    expect(descriptions[0]).toContain("Tx Pagi 01"); // 01 10:00:00 (terlama)
    expect(descriptions[1]).toContain("Tx Sore 01"); // 01 18:30:00
    expect(descriptions[2]).toContain("Tx Pagi 05"); // 05

    // Active filter badge should show Terlama ➔ Terbaru
    expect(screen.getByText(/terlama ➔ terbaru/i)).toBeDefined();

    // Reset filter button should be visible
    expect(screen.getByRole("button", { name: /reset filter/i })).toBeDefined();
  });

  it("toggles back to DESC when clicking Tanggal header twice", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
      />
    );

    const sortButton = screen.getByRole("button", {
      name: /urutkan tanggal/i,
    });
    fireEvent.click(sortButton); // to ASC
    fireEvent.click(sortButton); // back to DESC

    const descriptions = getRenderedRowDescriptions();
    expect(descriptions[0]).toContain("Tx Pagi 05");
    expect(descriptions[1]).toContain("Tx Sore 01");
    expect(descriptions[2]).toContain("Tx Pagi 01");
  });

  it("resets sort order to DESC when Reset Filter is clicked", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
      />
    );

    const sortButton = screen.getByRole("button", {
      name: /urutkan tanggal/i,
    });
    fireEvent.click(sortButton); // to ASC

    expect(screen.getByText(/terlama ➔ terbaru/i)).toBeDefined();

    const resetBtn = screen.getByRole("button", { name: /reset filter/i });
    fireEvent.click(resetBtn);

    const descriptions = getRenderedRowDescriptions();
    expect(descriptions[0]).toContain("Tx Pagi 05");
    expect(descriptions[1]).toContain("Tx Sore 01");
    expect(descriptions[2]).toContain("Tx Pagi 01");

    expect(screen.queryByText(/terlama ➔ terbaru/i)).toBeNull();
  });

  it("respects initialSort='asc' prop", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
        initialSort="asc"
      />
    );

    const descriptions = getRenderedRowDescriptions();
    expect(descriptions[0]).toContain("Tx Pagi 01");
    expect(descriptions[1]).toContain("Tx Sore 01");
    expect(descriptions[2]).toContain("Tx Pagi 05");
  });
});
