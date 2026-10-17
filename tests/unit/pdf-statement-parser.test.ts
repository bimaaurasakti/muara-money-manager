import { describe, it, expect } from "vitest";
import {
  parseIndonesianCurrency,
  parseBcaPdfStatement,
  parseDanaPdfStatement,
  parseBankPdfStatement,
} from "@/lib/parser/pdf-statement-parser";

describe("Deterministic PDF Statement Parser", () => {
  describe("parseIndonesianCurrency", () => {
    it("correctly converts Indonesian formatted currency with decimals to integer cents", () => {
      expect(parseIndonesianCurrency("10.000,00")).toEqual({
        amount: 10000,
        amountCents: 1000000,
      });

      expect(parseIndonesianCurrency("24.526.500,00")).toEqual({
        amount: 24526500,
        amountCents: 2452650000,
      });

      expect(parseIndonesianCurrency("Rp 1.707.400,00")).toEqual({
        amount: 1707400,
        amountCents: 170740000,
      });
    });

    it("correctly handles integers without decimals", () => {
      expect(parseIndonesianCurrency("50.000")).toEqual({
        amount: 50000,
        amountCents: 5000000,
      });

      expect(parseIndonesianCurrency("Rp. 32.771")).toEqual({
        amount: 32771,
        amountCents: 3277100,
      });
    });
  });

  describe("parseBcaPdfStatement", () => {
    const sampleBcaText = `
REKENING TAHAPAN
NO. REKENING : 0501191549
NAMA : BIMA AURASAKTI ROCHMATULLAH
PERIODE : AGUSTUS 2026
MATA UANG : IDR

TGL. KETERANGAN CB. MUTASI SALDO
01/08 BIAYA ADM 0950 10.000,00 100.000.000,00
02/08 KARTU DEBIT SPBU54.601117NGAGL 6019005055989045 0950 100.000,00 99.900.000,00
24/08 TRSF E-BANKING CR 2408/FTSCY/WS95011 LM UTI UMI ADHIYATI 0000 24.526.500,00 CR 124.426.500,00
26/08 TRSF E-BANKING DB 2608/FTFVA/WS95271 72345/DANA 081261531480 0000 13.000.000,00 111.426.500,00
31/08 TRSF E-BANKING CR 3108/PYBCA/WS95051 0000 17.074.000,00 CR 128.500.500,00
SALDO AWAL : 100.010.000,00
MUTASI CR : 41.600.500,00
MUTASI DB : 13.110.000,00
SALDO AKHIR : 128.500.500,00
`;

    it("extracts header metadata and all transactions with exact amounts and directions", () => {
      const result = parseBcaPdfStatement(sampleBcaText);

      expect(result.detectedBank).toBe("BCA");
      expect(result.accountNumber).toBe("0501191549");
      expect(result.accountHolder).toBe("BIMA AURASAKTI ROCHMATULLAH");
      expect(result.statementPeriod).toBe("AGUSTUS 2026");
      expect(result.transactions.length).toBe(5);

      // Row 1: Biaya Adm (Debit/Expense)
      const tx1 = result.transactions[0];
      expect(tx1.date).toBe("2026-08-01");
      expect(tx1.amountCents).toBe(1000000); // 10.000,00
      expect(tx1.type).toBe("EXPENSE");
      expect(tx1.description).toContain("BIAYA ADM");

      // Row 2: Kartu Debit SPBU
      const tx2 = result.transactions[1];
      expect(tx2.date).toBe("2026-08-02");
      expect(tx2.amountCents).toBe(10000000); // 100.000,00
      expect(tx2.type).toBe("EXPENSE");
      expect(tx2.description).toContain("SPBU54.601117NGAGL");

      // Row 3: Transfer In / CR (Credit/Income)
      const tx3 = result.transactions[2];
      expect(tx3.date).toBe("2026-08-24");
      expect(tx3.amountCents).toBe(2452650000); // 24.526.500,00
      expect(tx3.type).toBe("INCOME");
      expect(tx3.description).toContain("LM UTI UMI ADHIYATI");

      // Row 4: Transfer Out / DB (Debit/Expense)
      const tx4 = result.transactions[3];
      expect(tx4.date).toBe("2026-08-26");
      expect(tx4.amountCents).toBe(1300000000); // 13.000.000,00
      expect(tx4.type).toBe("EXPENSE");
      expect(tx4.description).toContain("DANA 081261531480");

      // Row 5: Payroll / CR (Credit/Income)
      const tx5 = result.transactions[4];
      expect(tx5.date).toBe("2026-08-31");
      expect(tx5.amountCents).toBe(1707400000); // 17.074.000,00
      expect(tx5.type).toBe("INCOME");
      expect(tx5.description).toContain("PYBCA");

      // Verify cleanSummaryText is populated for Gemini
      expect(result.cleanSummaryText).toContain("BANK STATEMENT (BCA):");
      expect(result.cleanSummaryText).toContain("24.526.500");
    });
  });

  describe("parseDanaPdfStatement", () => {
    const sampleDanaText = `
DANA
Laporan Transaksi / Transaction Report
Nama / Name: Bima Aurasakti
Nomor Akun / Account Number: 081392366770
Periode / Period: 01 Agu 2026 - 31 Agu 2026

02 Agu 2026 14:30 Pembayaran Google Play -Rp 50.000
05 Agu 2026 10:15 Kirim Uang ke Blu BCA -Rp 32.771
08 Agu 2026 18:00 Isi Saldo dari BCA +Rp 100.000
`;

    it("extracts DANA transactions and normalizes flow types", () => {
      const result = parseDanaPdfStatement(sampleDanaText);

      expect(result.detectedBank).toBe("DANA");
      expect(result.accountNumber).toBe("081392366770");
      expect(result.accountHolder).toBe("Bima Aurasakti");
      expect(result.transactions.length).toBe(3);

      expect(result.transactions[0].date).toBe("2026-08-02");
      expect(result.transactions[0].amountCents).toBe(5000000);
      expect(result.transactions[0].type).toBe("EXPENSE");

      expect(result.transactions[1].date).toBe("2026-08-05");
      expect(result.transactions[1].amountCents).toBe(3277100);
      expect(result.transactions[1].type).toBe("EXPENSE");

      expect(result.transactions[2].date).toBe("2026-08-08");
      expect(result.transactions[2].amountCents).toBe(10000000);
      expect(result.transactions[2].type).toBe("INCOME");
    });
  });

  describe("parseBankPdfStatement (Auto-Router)", () => {
    it("routes BCA text correctly", () => {
      const bcaSnippet = "BCA e-Statement Rekening Tahapan 01/08 BIAYA ADM 0950 10.000,00 100.000,00";
      const result = parseBankPdfStatement(bcaSnippet);
      expect(result.detectedBank).toBe("BCA");
      expect(result.transactions.length).toBe(1);
    });

    it("returns UNKNOWN for unrecognized formats without throwing errors", () => {
      const unknownText = "Laporan Keuangan PT Maju Mundur 2026";
      const result = parseBankPdfStatement(unknownText);
      expect(result.detectedBank).toBe("UNKNOWN");
      expect(result.transactions.length).toBe(0);
    });
  });
});
