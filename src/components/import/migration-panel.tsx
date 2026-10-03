"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FolderSync,
  Layers,
  TrendingDown,
  TrendingUp,
  ArrowLeftRight,
  Loader2,
} from "lucide-react";
import {
  previewMoneyManagerFileAction,
  runLegacyMigrationAction,
  MigrationPreviewResult,
  MigrationActionResult,
} from "@/actions/migration-action";
import { fromCents, formatIDR } from "@/lib/money";

export function MigrationPanel() {
  const [file, setFile] = React.useState<File | null>(null);
  const [isPreviewing, setIsPreviewing] = React.useState<boolean>(false);
  const [isMigrating, setIsMigrating] = React.useState<boolean>(false);
  const [previewResult, setPreviewResult] = React.useState<MigrationPreviewResult | null>(null);
  const [migrationResult, setMigrationResult] = React.useState<MigrationActionResult | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleFileChange = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setErrorMessage(null);
    setMigrationResult(null);
    setIsPreviewing(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await previewMoneyManagerFileAction(formData);
      if (res.success) {
        setPreviewResult(res);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Gagal memproses file Money Manager.");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExecuteMigration = async () => {
    if (!file) {
      setErrorMessage("Silakan pilih file Excel Money Manager terlebih dahulu.");
      return;
    }

    setIsMigrating(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await runLegacyMigrationAction(formData);
      if (res.success) {
        setMigrationResult(res);
      } else {
        setErrorMessage(res.message);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "Gagal mengeksekusi migrasi ke database.");
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Informative Header Banner */}
      <Card className="p-5 border-amber-500/20 bg-gradient-to-r from-amber-950/20 via-slate-900 to-slate-950">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <FolderSync className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-200">
              Menu Khusus Migrasi Eksternal (Multi-Wallet Ledger)
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Gunakan menu ini khusus untuk mengimpor file ekspor/backup dari aplikasi <strong>Money Manager</strong>. 
              Sistem akan memetakan setiap baris transaksi ke 16 rekening &amp; dompet yang ada di buku besar Anda secara otomatis berdasarkan kolom akun.
            </p>
          </div>
        </div>
      </Card>

      {/* Upload MM File Card */}
      <Card className="p-6 border-white/10 bg-slate-900/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span>Unggah File Excel Money Manager</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
              Format <code>.xlsx</code> atau <code>.xls</code> hasil ekspor/backup aplikasi Money Manager. Seluruh baris transaksi akan dianalisis dan dipetakan ke 16 rekening &amp; dompet buku besar Anda.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label className={`cursor-pointer ${isPreviewing || isMigrating ? "opacity-60 pointer-events-none" : ""}`}>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={isPreviewing || isMigrating}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />
              <span className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-colors shadow-sm">
                {isPreviewing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>
                  {isPreviewing
                    ? "Menganalisis File..."
                    : file
                    ? "Ganti File .xlsx"
                    : "Pilih File .xlsx"}
                </span>
              </span>
            </label>
            {file && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-950/80 border border-white/10 text-xs font-mono text-slate-300">
                <span className="truncate max-w-[180px] sm:max-w-[240px]">{file.name}</span>
                <span className="text-[10px] text-slate-500 shrink-0">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center gap-3 text-xs text-rose-200">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Preview & Audit Card */}
      {previewResult && previewResult.summary && (
        <Card className="p-6 space-y-6 border-emerald-500/30 bg-slate-900/90">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Audit Pratinjau Migrasi: {previewResult.fileName}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Ditemukan total <strong>{previewResult.totalRows} transaksi</strong> terpetakan ke 16 rekening.
              </p>
            </div>

            <Button
              onClick={handleExecuteMigration}
              disabled={isMigrating || !!migrationResult}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs h-10 px-5 shadow-lg shadow-emerald-500/20"
            >
              <FolderSync className={`w-4 h-4 mr-2 ${isMigrating ? "animate-spin" : ""}`} />
              <span>
                {isMigrating
                  ? "Menyimpan ke Database..."
                  : migrationResult
                  ? "Sudah Dimigrasikan"
                  : "Komit Migrasi ke Database"}
              </span>
            </Button>
          </div>

          {/* KPI Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Pengeluaran</span>
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <p className="text-lg font-bold font-mono text-rose-400">
                {previewResult.summary.expenseCount}
              </p>
              <p className="text-[10px] text-slate-500">Transaksi Belanja</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Pemasukan</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <p className="text-lg font-bold font-mono text-emerald-400">
                {previewResult.summary.incomeCount}
              </p>
              <p className="text-[10px] text-slate-500">Gaji &amp; Pendapatan</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Transfer Antar-Akun</span>
                <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <p className="text-lg font-bold font-mono text-sky-400">
                {previewResult.summary.transferCount}
              </p>
              <p className="text-[10px] text-slate-500">Netral Terhadap Saldo</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Penyesuaian Saldo</span>
                <Layers className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <p className="text-lg font-bold font-mono text-amber-400">
                {previewResult.summary.modifiedBalCount}
              </p>
              <p className="text-[10px] text-slate-500">Modified Bal. Rows</p>
            </div>
          </div>

          {/* Sample Rows Table */}
          {previewResult.sampleTransactions && previewResult.sampleTransactions.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-semibold text-slate-300">
                Sampel Data Terpetakan (5 Baris Pertama):
              </h5>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-white/10 font-mono">
                    <tr>
                      <th className="p-2.5">Tanggal</th>
                      <th className="p-2.5">Dompet Sumber</th>
                      <th className="p-2.5">Tipe</th>
                      <th className="p-2.5">Kategori</th>
                      <th className="p-2.5 text-right">Nominal</th>
                      <th className="p-2.5">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {previewResult.sampleTransactions.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="p-2.5 font-mono text-slate-300">{tx.date}</td>
                        <td className="p-2.5 font-medium text-emerald-300">{tx.sourceAccount}</td>
                        <td className="p-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              tx.type === "EXPENSE"
                                ? "bg-rose-500/10 text-rose-300"
                                : tx.type === "INCOME"
                                ? "bg-emerald-500/10 text-emerald-300"
                                : "bg-sky-500/10 text-sky-300"
                            }`}
                          >
                            {tx.type}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-300">{tx.category}</td>
                        <td className="p-2.5 text-right font-mono font-medium text-slate-200">
                          {formatIDR(fromCents(tx.amountCents))}
                        </td>
                        <td className="p-2.5 text-slate-400 max-w-[200px] truncate">
                          {tx.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success Notice after commit */}
          {migrationResult && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>
                  <strong>Berhasil!</strong> {migrationResult.message} Seluruh saldo rekening telah disinkronisasi secara atomik.
                </span>
              </div>
              <a
                href="/accounts"
                className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-semibold"
              >
                Lihat Rekening &amp; Dompet <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
