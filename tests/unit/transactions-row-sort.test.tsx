import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  TransactionsClient,
  TransactionRow,
} from "@/components/transactions/transactions-client";

const currentYear = new Date().getFullYear();
const currentMonthNumber = String(new Date().getMonth() + 1).padStart(2, "0");
const currentMonthStr = `${currentYear}-${currentMonthNumber}`;

// Mock transactions representing input sequence from a bank statement
// Row 1 in bank statement: Topup E-Wallet on 2026-10-02
// Row 2 in bank statement: Gaji Masuk on 2026-10-01 (earlier date but row 2 in statement)
// Row 3 in bank statement: Beli Kopi on 2026-10-03 (latest date but row 3 in statement)
const mockTransactions: TransactionRow[] = [
  {
    id: "tx-1",
    inputOrder: 1,
    date: `${currentMonthStr}-02`,
    time: "10:00:00",
    amount: 1000000,
    type: "EXPENSE",
    description: "Baris 1 Dokumen Bank: Topup E-Wallet",
    note: null,
    sourceType: "PDF_BCA",
    transferPairId: null,
    accountName: "BCA (Baim)",
    categoryName: "Lainnya",
  },
  {
    id: "tx-2",
    inputOrder: 2,
    date: `${currentMonthStr}-01`,
    time: "08:00:00",
    amount: 12000000,
    type: "INCOME",
    description: "Baris 2 Dokumen Bank: Gaji Masuk",
    note: null,
    sourceType: "PDF_BCA",
    transferPairId: null,
    accountName: "BCA (Baim)",
    categoryName: "Gaji",
  },
  {
    id: "tx-3",
    inputOrder: 3,
    date: `${currentMonthStr}-03`,
    time: "15:30:00",
    amount: 50000,
    type: "EXPENSE",
    description: "Baris 3 Dokumen Bank: Beli Kopi",
    note: null,
    sourceType: "PDF_BCA",
    transferPairId: null,
    accountName: "BCA (Baim)",
    categoryName: "Makanan",
  },
];

function getRenderedRowDetails(): Array<{ no: string; desc: string }> {
  const table = screen.getByRole("table");
  const rows = within(table).getAllByRole("row");
  // row 0 is header, rows 1..n are body rows
  return rows
    .slice(1)
    .filter((r) => !r.hasAttribute("data-summary-row"))
    .map((r) => {
      const cells = within(r).getAllByRole("cell");
      return {
        no: cells[0]?.textContent?.trim() || "",
        desc: cells[3]?.textContent || "", // cell 0 is No., cell 1 is Tanggal, cell 2 is Wallet, cell 3 is Keterangan
      };
    });
}

describe("Transactions Row Input Order Sorting Feature", () => {
  it("renders 'No.' column header and displays sequential row numbers", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
      />
    );

    // Header "No." button must exist
    const noHeaderBtn = screen.getByRole("button", {
      name: /urutkan nomor urut input/i,
    });
    expect(noHeaderBtn).toBeDefined();

    // Default sorting is by date (descending), so Tx 3 (03 Oct), Tx 1 (02 Oct), Tx 2 (01 Oct)
    const details = getRenderedRowDetails();
    expect(details.length).toBe(3);
  });

  it("sorts by input order (1 ➔ N) when clicking 'No.' header button", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
      />
    );

    const noHeaderBtn = screen.getByRole("button", {
      name: /urutkan nomor urut input/i,
    });
    fireEvent.click(noHeaderBtn);

    // In ASC input order: Baris 1, Baris 2, Baris 3
    const details = getRenderedRowDetails();
    expect(details[0].desc).toContain("Baris 1 Dokumen Bank");
    expect(details[0].no).toBe("#1");

    expect(details[1].desc).toContain("Baris 2 Dokumen Bank");
    expect(details[1].no).toBe("#2");

    expect(details[2].desc).toContain("Baris 3 Dokumen Bank");
    expect(details[2].no).toBe("#3");

    // Active badge for input order should be displayed
    expect(screen.getByText(/no\. input: 1 ➔ n/i)).toBeDefined();
  });

  it("toggles to reverse input order (N ➔ 1) when clicking 'No.' header twice", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
      />
    );

    const noHeaderBtn = screen.getByRole("button", {
      name: /urutkan nomor urut input/i,
    });
    fireEvent.click(noHeaderBtn); // to ASC (1 ➔ N)
    fireEvent.click(noHeaderBtn); // to DESC (N ➔ 1)

    const details = getRenderedRowDetails();
    expect(details[0].desc).toContain("Baris 3 Dokumen Bank");
    expect(details[0].no).toBe("#3");

    expect(details[1].desc).toContain("Baris 2 Dokumen Bank");
    expect(details[1].no).toBe("#2");

    expect(details[2].desc).toContain("Baris 1 Dokumen Bank");
    expect(details[2].no).toBe("#1");

    expect(screen.getByText(/no\. input: n ➔ 1/i)).toBeDefined();
  });

  it("resets back to default date sort when Reset Filter is clicked", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
      />
    );

    const noHeaderBtn = screen.getByRole("button", {
      name: /urutkan nomor urut input/i,
    });
    fireEvent.click(noHeaderBtn); // in row sort mode

    const resetBtn = screen.getByRole("button", { name: /reset filter/i });
    fireEvent.click(resetBtn);

    // Order should return to date-desc: Baris 3 (03 Oct), Baris 1 (02 Oct), Baris 2 (01 Oct)
    const details = getRenderedRowDetails();
    expect(details[0].desc).toContain("Baris 3 Dokumen Bank");
    expect(details[1].desc).toContain("Baris 1 Dokumen Bank");
    expect(details[2].desc).toContain("Baris 2 Dokumen Bank");

    expect(screen.queryByText(/no\. input/i)).toBeNull();
  });

  it("respects initialSort='row-asc' prop", () => {
    render(
      <TransactionsClient
        initialTransactions={mockTransactions}
        accounts={["BCA (Baim)"]}
        initialSort="row-asc"
      />
    );

    const details = getRenderedRowDetails();
    expect(details[0].desc).toContain("Baris 1 Dokumen Bank");
    expect(details[0].no).toBe("#1");
    expect(details[1].desc).toContain("Baris 2 Dokumen Bank");
    expect(details[1].no).toBe("#2");
    expect(details[2].desc).toContain("Baris 3 Dokumen Bank");
    expect(details[2].no).toBe("#3");
  });
});
