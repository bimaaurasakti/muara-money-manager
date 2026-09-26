import { describe, it, expect } from "vitest";
import { parseBluCsv } from "@/lib/parser/file-preprocessor";

const sampleBluCsv = `Rekening / Account,:,bluAccount - 000777929188,,
Nama / Name,:,Bima Aurasakti Rochmatullah,,
Mata Uang / Currency,:,IDR (Rp),,
,,,,
Tanggal / Date,Keterangan / Remarks,Nominal / Amount,Tipe / Type,Sisa Saldo / Remaining Balance
02/08/2026,Pembayaran QRIS | MCDONALD'S SOK 24601 000885004186567 | 01054709185890262593,-38500,Pengeluaran,124263.81
05/08/2026,Dana Masuk dari BIMA AURASAKTI ROCHMATULLAH | DANA - DANA20260805DANAIDJ1010O9993138256BIMAAURASAKTIROCHMATULLAH,32771,Pemasukan,157034.81
09/08/2026,Beli Online | 900038 081392366770 | 303212332-1786238549,-50500,Pengeluaran,106534.81
09/08/2026,Cashback | BLUKKMAPPTC26,25000,Pemasukan,131534.81
09/08/2026,Dana Masuk dari BIMA AURASAKTI ROCHMATULLAH | DANA - DANA20260809DANAIDJ1010O9971478656BIMAAURASAKTIROCHMATULLAH,25000,Pemasukan,156534.81
18/08/2026,Beli Online | 900038 081392366770 | 306792164-1787035429,-48975,Pengeluaran,107559.81
18/08/2026,Dana Masuk dari Nafia Mufidah Fatchur | BCA Digital,49000,Pemasukan,156559.81
31/08/2026,Bunga | bluAccount,65.15,Pemasukan,156624.96
31/08/2026,Pajak Bunga | bluAccount | PJAK4BC70209,-13.03,Pengeluaran,156611.93
,,,,
Saldo Awal / Initial Balance,:,162763.81,,
Total Pemasukan / Total Income,:,131836.15,,
Total Pengeluaran / Total Expense,:,137988.03,,
Saldo Akhir / Ending Balance,:,156611.93,,
""
""`;

describe("Deterministic Blu BCA CSV Parser", () => {
  const knownAccounts = [
    { name: "Blu BCA (Baim)", accountNumber: "000777929188" },
    { name: "Dana (Baim)", accountNumber: "081392366770" },
  ];

  it("extracts account metadata and detects wallet correctly", () => {
    const result = parseBluCsv(sampleBluCsv, undefined, knownAccounts);
    expect(result.accountNumber).toBe("000777929188");
    expect(result.accountHolder).toBe("Bima Aurasakti Rochmatullah");
    expect(result.detectedAccountName).toBe("Blu BCA (Baim)");
  });

  it("extracts all 9 transactions with exact dates and mathematical cent precision", () => {
    const result = parseBluCsv(sampleBluCsv, "Blu BCA (Baim)", knownAccounts);
    expect(result.transactions).toHaveLength(9);

    // Row 0: QRIS McDonald's (-38500)
    const tx0 = result.transactions[0];
    expect(tx0.date).toBe("2026-08-02");
    expect(tx0.description).toContain("MCDONALD'S");
    expect(tx0.amountCents).toBe(3850000); // 38,500 * 100
    expect(tx0.type).toBe("EXPENSE");
    expect(tx0.sourceWalletName).toBe("Blu BCA (Baim)");

    // Row 1: Dana Masuk dari DANA (32771)
    const tx1 = result.transactions[1];
    expect(tx1.date).toBe("2026-08-05");
    expect(tx1.amountCents).toBe(3277100);
    expect(tx1.type).toBe("INCOME");

    // Row 7: Bunga with fractional cents (65.15)
    const tx7 = result.transactions[7];
    expect(tx7.date).toBe("2026-08-31");
    expect(tx7.description).toContain("Bunga");
    expect(tx7.amountCents).toBe(6515); // 65.15 * 100
    expect(tx7.type).toBe("INCOME");

    // Row 8: Pajak Bunga with fractional cents (-13.03)
    const tx8 = result.transactions[8];
    expect(tx8.date).toBe("2026-08-31");
    expect(tx8.description).toContain("Pajak Bunga");
    expect(tx8.amountCents).toBe(1303); // 13.03 * 100
    expect(tx8.type).toBe("EXPENSE");
  });

  it("handles empty or malformed CSV safely", () => {
    const emptyResult = parseBluCsv("", undefined, knownAccounts);
    expect(emptyResult.transactions).toHaveLength(0);
  });
});
