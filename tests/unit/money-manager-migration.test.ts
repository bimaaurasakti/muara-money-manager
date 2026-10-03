import { describe, it, expect } from "vitest";
import path from "path";
import { parseMoneyManagerExcel } from "@/lib/migration/money-manager-importer";
import { MASTER_ACCOUNTS } from "@/db/seed";

describe("Legacy Money Manager Migration Parser", () => {
  const sampleFilePath = path.resolve(process.cwd(), "data-example/Money Manager - Excel.xlsx");

  it("parses all 455 historical rows accurately", async () => {
    const result = await parseMoneyManagerExcel(sampleFilePath);

    expect(result.totalRows).toBe(455);
    expect(result.transactions.length).toBe(455);
  });

  it("classifies transaction types matching the empirical findings", async () => {
    const result = await parseMoneyManagerExcel(sampleFilePath);

    expect(result.summary.transferCount).toBe(79);
    expect(result.summary.modifiedBalCount).toBe(40);
    expect(result.summary.expenseCount + result.summary.incomeCount + result.summary.transferCount).toBe(455);
  });

  it("correctly normalizes Transfer-Out transactions", async () => {
    const result = await parseMoneyManagerExcel(sampleFilePath);
    const transfers = result.transactions.filter((t) => t.type === "TRANSFER");

    expect(transfers.length).toBe(79);
    for (const t of transfers) {
      expect(t.categoryName).toBe("🔄 Pindah Uang");
      expect(t.targetAccountName).toBeTruthy();
      expect(t.transferPairId).toBeTruthy();
      expect(t.amountCents).toBeGreaterThan(0);
    }
  });

  it("correctly maps Modified Bal. to Penyesuaian Saldo category", async () => {
    const result = await parseMoneyManagerExcel(sampleFilePath);
    const modifiedBalRows = result.transactions.filter((t) => t.isModifiedBalance);

    expect(modifiedBalRows.length).toBe(40);
    for (const r of modifiedBalRows) {
      expect(r.categoryName).toBe("⚙️ Penyesuaian Saldo");
      expect(r.subcategoryName).toBe("⚙️ Penyesuaian Saldo");
      expect(["INCOME", "EXPENSE"]).toContain(r.type);
    }
  });

  it("verifies all accounts in transactions match master account list", async () => {
    const result = await parseMoneyManagerExcel(sampleFilePath);
    const validAccountNames = new Set(MASTER_ACCOUNTS.map((a) => a.name));

    for (const t of result.transactions) {
      expect(validAccountNames.has(t.sourceAccountName)).toBe(true);
      if (t.targetAccountName) {
        expect(validAccountNames.has(t.targetAccountName)).toBe(true);
      }
    }
  });

  it("rejects migration execution when file is not provided", async () => {
    const { runLegacyMigrationAction } = await import("@/actions/migration-action");
    const result = await runLegacyMigrationAction();

    expect(result.success).toBe(false);
    expect(result.totalMigrated).toBe(0);
    expect(result.message).toContain("File Excel Money Manager wajib diunggah");
  });

  it("enforces idempotency and rejects duplicate migration execution when file is provided", async () => {
    const { runLegacyMigrationAction } = await import("@/actions/migration-action");
    const fs = await import("fs");
    const buffer = fs.readFileSync(sampleFilePath);
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const formData = new FormData();
    formData.append("file", blob, "Money Manager - Excel.xlsx");

    const result = await runLegacyMigrationAction(formData);

    expect(result.success).toBe(false);
    expect(result.totalMigrated).toBe(0);
    expect(result.message).toContain("sudah pernah dimigrasikan");
  });
});
