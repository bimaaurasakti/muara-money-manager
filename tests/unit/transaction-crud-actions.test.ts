import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeTransactionFingerprint } from "@/lib/concurrency/transaction-fingerprint";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock db
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/db", () => ({
  db: {
    select: () => mockSelect(),
    insert: () => mockInsert(),
    update: () => mockUpdate(),
    delete: () => mockDelete(),
  },
}));

describe("Transaction CRUD Server Actions with OCC Concurrency Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports createTransactionAction, updateTransactionAction, and deleteTransactionAction", async () => {
    const crudActions = await import("@/actions/transaction-crud-actions");
    expect(crudActions.createTransactionAction).toBeDefined();
    expect(crudActions.updateTransactionAction).toBeDefined();
    expect(crudActions.deleteTransactionAction).toBeDefined();
    expect(crudActions.recalculateAccountBalances).toBeDefined();
  });

  describe("createTransactionAction Validation", () => {
    it("rejects creation if accountId is missing", async () => {
      const { createTransactionAction } = await import("@/actions/transaction-crud-actions");
      const res = await createTransactionAction({
        accountId: "",
        amount: 50000,
        type: "EXPENSE",
        date: "2026-08-31",
        description: "Beli Kopi",
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain("Rekening wajib");
    });

    it("rejects creation if amount is zero or negative", async () => {
      const { createTransactionAction } = await import("@/actions/transaction-crud-actions");
      const res = await createTransactionAction({
        accountId: "acc-1",
        amount: 0,
        type: "EXPENSE",
        date: "2026-08-31",
        description: "Beli Kopi",
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain("Nominal");
    });

    it("rejects transfer if target account is identical to source account", async () => {
      const { createTransactionAction } = await import("@/actions/transaction-crud-actions");
      const res = await createTransactionAction({
        accountId: "acc-1",
        targetAccountId: "acc-1",
        amount: 50000,
        type: "TRANSFER",
        date: "2026-08-31",
        description: "Transfer ke diri sendiri",
      });
      expect(res.success).toBe(false);
      expect(res.message).toContain("tidak boleh sama");
    });
  });

  describe("Optimistic Concurrency Control (OCC) Protection", () => {
    const existingTx = {
      id: "tx-existing-1",
      accountId: "acc-bca",
      targetAccountId: null,
      categoryId: "cat-living",
      subcategoryId: null,
      amount: 10000000,
      type: "EXPENSE",
      date: "2026-08-31",
      time: "10:00:00",
      description: "Belanja Bulanan",
      note: "Catatan Suami",
    };

    it("detects MODIFIED conflict when updating if transaction was modified by spouse", async () => {
      const { updateTransactionAction } = await import("@/actions/transaction-crud-actions");

      // Current state in DB has note "Catatan Istri" (so fingerprint changed)
      const currentDbTx = { ...existingTx, note: "Catatan Istri" };
      const staleClientFingerprint = computeTransactionFingerprint(existingTx);

      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([currentDbTx]),
          }),
        }),
      });

      const res = await updateTransactionAction("tx-existing-1", staleClientFingerprint, {
        accountId: "acc-bca",
        amount: 12000000,
        type: "EXPENSE",
        date: "2026-08-31",
        description: "Belanja Bulanan (Revisi)",
      });

      expect(res.success).toBe(false);
      expect(res.conflict).toBe("MODIFIED");
      expect(res.message).toContain("baru saja diubah oleh pengguna lain");
      expect(res.freshFingerprint).toBeDefined();
      expect(res.freshTransaction).toEqual(currentDbTx);
    });

    it("detects DELETED conflict when updating if transaction was deleted by spouse", async () => {
      const { updateTransactionAction } = await import("@/actions/transaction-crud-actions");

      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]), // Empty: already deleted
          }),
        }),
      });

      const res = await updateTransactionAction("tx-deleted", "stale-fp", {
        accountId: "acc-bca",
        amount: 12000000,
        type: "EXPENSE",
        date: "2026-08-31",
        description: "Belanja",
      });

      expect(res.success).toBe(false);
      expect(res.conflict).toBe("DELETED");
      expect(res.message).toContain("telah dihapus");
    });

    it("detects MODIFIED conflict when deleting if transaction was modified concurrently", async () => {
      const { deleteTransactionAction } = await import("@/actions/transaction-crud-actions");

      const currentDbTx = { ...existingTx, amount: 15000000 };
      const staleClientFingerprint = computeTransactionFingerprint(existingTx);

      mockSelect.mockReturnValue({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([currentDbTx]),
          }),
        }),
      });

      const res = await deleteTransactionAction("tx-existing-1", staleClientFingerprint);

      expect(res.success).toBe(false);
      expect(res.conflict).toBe("MODIFIED");
      expect(res.message).toContain("baru saja diubah oleh pengguna lain");
    });
  });
});
