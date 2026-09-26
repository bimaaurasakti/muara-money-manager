import { db } from "@/db";
import { accounts, transactions, categories } from "@/db/schema";
import { TabularCurrency } from "@/components/ui/tabular-currency";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMonthlyKPISummary } from "@/lib/data/monthly-analytics";
import { NetWorthHero } from "@/components/dashboard/net-worth-hero";
import {
  BarChart3,
  UploadCloud,
  Wallet2,
  Receipt,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  ShieldCheck,
  Percent,
} from "lucide-react";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const currentMonth = "2026-08";

  // Fetch parallel data
  const [allAccounts, summary, recentTxs] = await Promise.all([
    db.select().from(accounts),
    getMonthlyKPISummary(currentMonth),
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        amount: transactions.amount,
        type: transactions.type,
        description: transactions.description,
        accountName: accounts.name,
        categoryName: categories.name,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .orderBy(desc(transactions.date), desc(transactions.time))
      .limit(6),
  ]);

  const totalPositiveAssetsCents = allAccounts
    .filter((a) => a.currentBalance > 0)
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const totalLiabilitiesCents = allAccounts
    .filter((a) => a.currentBalance < 0)
    .reduce((sum, a) => sum + Math.abs(a.currentBalance), 0);

  const totalNetWorthCents = totalPositiveAssetsCents - totalLiabilitiesCents;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Brand Monogram & Eyebrow */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-xs font-mono mb-3 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            MUARA FINANCIAL OS • V5.3 MONOLITH
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Executive Personal Finance &amp;{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
              Cash Flow Intelligence
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/import">
            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs h-9 shadow-sm shadow-emerald-500/20">
              <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
              Unggah Dokumen Mutasi
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero Bento Grid: Net Worth + 4 Monthly KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Hero Card: Total Net Worth */}
        <NetWorthHero
          totalNetWorthCents={totalNetWorthCents}
          totalPositiveAssetsCents={totalPositiveAssetsCents}
          totalLiabilitiesCents={totalLiabilitiesCents}
          accountCount={allAccounts.length}
        />

        {/* Right 4 KPI Bento Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Income */}
          <div className="artisan-card p-4 space-y-1 hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Pemasukan Murni ({summary.yearMonth})</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <TabularCurrency cents={summary.totalIncomeCents} size="lg" color="income" />
            <div className="text-[10px] font-mono text-emerald-400">
              ▲ +{summary.incomeMomDeltaPercentage}% MoM
            </div>
          </div>

          {/* Expense */}
          <div className="artisan-card p-4 space-y-1 hover:border-rose-500/30 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Pengeluaran Riil ({summary.yearMonth})</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <TabularCurrency cents={summary.totalExpenseCents} size="lg" color="expense" />
            <div className="text-[10px] font-mono text-rose-400">
              ▼ {summary.expenseMomDeltaPercentage}% MoM
            </div>
          </div>

          {/* Net Cashflow */}
          <div className="artisan-card p-4 space-y-1 hover:border-teal-500/30 transition-all">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Surplus Kas</span>
              <Percent className="w-4 h-4 text-teal-400" />
            </div>
            <TabularCurrency
              cents={summary.netCashflowCents}
              size="lg"
              color={summary.netCashflowCents >= 0 ? "income" : "expense"}
              showSign={true}
            />
            <div className="text-[10px] font-mono text-teal-400">
              Rasio Tabungan: {summary.savingsRatePercentage}%
            </div>
          </div>

          {/* Transfer Neutrality */}
          <div className="artisan-card p-4 space-y-1 border-indigo-500/30 bg-indigo-500/[0.04] hover:border-indigo-400/50 transition-all">
            <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold">
              <span>🔄 Pindah Uang (Netral)</span>
              <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
            </div>
            <TabularCurrency cents={summary.totalTransferVolumeCents} size="lg" color="transfer" />
            <div className="text-[10px] font-mono text-indigo-300">
              {summary.transferCount}x Mutasi • 0 Inflasi Beban
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Shortcut Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/monthly"
          className="artisan-card p-5 group hover:border-emerald-500/40 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
              <BarChart3 className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Analisis Bulanan Multi-Dimensi</h3>
            <p className="text-xs text-slate-400">
              Ringkasan MoM, donut alokasi hierarkis, dan leaderboard merchant.
            </p>
          </div>
        </Link>

        <Link
          href="/import"
          className="artisan-card p-5 group hover:border-indigo-500/40 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Smart Ingestion Dual-Input</h3>
            <p className="text-xs text-slate-400">
              BCA, DANA, blu CSV, Mandiri Excel &amp; struk kasir dengan deteksi transfer contra.
            </p>
          </div>
        </Link>

        <Link
          href="/accounts"
          className="artisan-card p-5 group hover:border-amber-500/40 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform">
              <Wallet2 className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Portofolio 16 Rekening Bank</h3>
            <p className="text-xs text-slate-400">
              Tampilan kartu fisik autentik dan sinkronisasi saldo migrasi.
            </p>
          </div>
        </Link>
      </div>

      {/* Recent Activity Table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Mutasi Terkini</h3>
            <p className="text-xs text-slate-400">Catatan transaksi terakhir yang tercatat di buku besar.</p>
          </div>
          <Link href="/transactions">
            <Button size="sm" variant="ghost" className="text-xs text-emerald-400 hover:text-emerald-300">
              Lihat Semua Buku Besar ➔
            </Button>
          </Link>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Tanggal</TableHead>
              <TableHead className="w-40">Wallet</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="w-40">Kategori</TableHead>
              <TableHead className="w-32 text-right">Nominal</TableHead>
              <TableHead className="w-24 text-center">Tipe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentTxs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-xs font-mono text-slate-500">
                  Belum ada mutasi transaksi yang tercatat. Silakan lakukan impor data di halaman Smart Ingestion.
                </TableCell>
              </TableRow>
            ) : (
              recentTxs.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-xs text-slate-300">{tx.date}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-200">{tx.accountName}</TableCell>
                  <TableCell className="text-xs text-slate-100 font-medium line-clamp-1">{tx.description}</TableCell>
                  <TableCell className="text-xs text-slate-400">{tx.categoryName || "—"}</TableCell>
                  <TableCell className="text-right">
                    <TabularCurrency
                      cents={tx.amount}
                      size="sm"
                      color={tx.type === "INCOME" ? "income" : tx.type === "EXPENSE" ? "expense" : "transfer"}
                      showSign={tx.type !== "TRANSFER"}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={tx.type === "INCOME" ? "income" : tx.type === "EXPENSE" ? "expense" : "transfer"}>
                      {tx.type === "INCOME" ? "Pemasukan" : tx.type === "EXPENSE" ? "Pengeluaran" : "Transfer"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
