import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import { DeleteTransactionDialog } from "@/components/transactions/delete-transaction-dialog";

vi.mock("@/actions/transaction-crud-actions", () => ({
  createTransactionAction: vi.fn(),
  updateTransactionAction: vi.fn(),
  deleteTransactionAction: vi.fn(),
}));

describe("TransactionFormDialog Component", () => {
  const mockAccounts = [
    { id: "acc-bca", name: "BCA (Baim)" },
    { id: "acc-blu", name: "Blu BCA" },
  ];

  const mockCategories = [
    {
      id: "cat-food",
      name: "🥣 Makanan & Minuman",
      type: "EXPENSE",
      subcategories: [{ id: "sub-coffee", name: "Kopi" }],
    },
    {
      id: "cat-adj",
      name: "⚙️ Penyesuaian Saldo",
      type: "BOTH",
      subcategories: [{ id: "sub-adj", name: "⚙️ Penyesuaian Saldo" }],
    },
  ];

  it("renders form fields for creating a transaction including date and precise time", () => {
    render(
      <TransactionFormDialog
        open={true}
        onOpenChange={() => {}}
        mode="create"
        accounts={mockAccounts}
        categories={mockCategories}
      />
    );

    // Verify key fields
    expect(screen.getByText("Tambah Transaksi Baru")).toBeDefined();
    expect(screen.getByLabelText(/Rekening Sumber/i)).toBeDefined();
    expect(screen.getByLabelText(/Tanggal/i)).toBeDefined();
    expect(screen.getByLabelText(/Jam, Menit, Detik/i)).toBeDefined();
    expect(screen.getByLabelText(/Nominal/i)).toBeDefined();
    expect(screen.getByLabelText(/^Kategori$/i)).toBeDefined();
    expect(screen.getByLabelText(/Keterangan/i)).toBeDefined();
  });

  it("renders OCC conflict warning when server returns MODIFIED conflict on edit", async () => {
    const { updateTransactionAction } = await import("@/actions/transaction-crud-actions");
    (updateTransactionAction as any).mockResolvedValueOnce({
      success: false,
      conflict: "MODIFIED",
      message: "Transaksi ini baru saja diubah oleh pasangan Anda.",
      freshTransaction: {
        id: "tx-1",
        description: "Beli Kopi Revisi Istri",
      },
    });

    render(
      <TransactionFormDialog
        open={true}
        onOpenChange={() => {}}
        mode="edit"
        initialData={{
          id: "tx-1",
          accountId: "acc-bca",
          accountName: "BCA (Baim)",
          amount: 5000000,
          type: "EXPENSE",
          date: "2026-08-31",
          time: "10:00:00",
          description: "Beli Kopi",
          note: null,
          sourceType: "MANUAL",
          transferPairId: null,
          categoryName: "🥣 Makanan & Minuman",
        }}
        accounts={mockAccounts}
        categories={mockCategories}
      />
    );

    const submitBtn = screen.getByRole("button", { name: /Simpan Perubahan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Transaksi ini baru saja diubah oleh pasangan Anda/i)
      ).toBeDefined();
      expect(screen.getByRole("button", { name: /Muat Data Terbaru/i })).toBeDefined();
    });
  });
});

describe("DeleteTransactionDialog Component", () => {
  it("renders confirmation details and calls delete action on confirm", async () => {
    const { deleteTransactionAction } = await import("@/actions/transaction-crud-actions");
    (deleteTransactionAction as any).mockResolvedValueOnce({
      success: true,
      message: "Transaksi berhasil dihapus.",
    });

    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <DeleteTransactionDialog
        open={true}
        onOpenChange={onOpenChange}
        transaction={{
          id: "tx-delete-1",
          accountId: "acc-bca",
          accountName: "BCA (Baim)",
          amount: 10000000,
          type: "EXPENSE",
          date: "2026-08-31",
          time: "15:00:00",
          description: "Makan Malam",
          note: null,
          sourceType: "MANUAL",
          transferPairId: null,
          categoryName: "🥣 Makanan & Minuman",
        }}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText(/Hapus Transaksi/i)).toBeDefined();
    expect(screen.getByText(/Makan Malam/i)).toBeDefined();

    const deleteBtn = screen.getByRole("button", { name: /Hapus Mutasi/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteTransactionAction).toHaveBeenCalled();
    });
  });
});
