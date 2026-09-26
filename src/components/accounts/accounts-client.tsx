"use client";

import * as React from "react";
import { Account } from "@/db/schema";
import { TabularCurrency } from "@/components/ui/tabular-currency";
import { PrivacyToggle } from "@/components/ui/privacy-toggle";
import { usePrivacyStore } from "@/store/use-privacy-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Wallet2,
  Building2,
  Smartphone,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import Link from "next/link";

export interface AccountsClientProps {
  initialAccounts: Account[];
}

function EmvChipSvg() {
  return (
    <svg className="w-9 h-7 rounded bg-amber-200/20 border border-amber-300/40 p-1" viewBox="0 0 36 28">
      <rect x="2" y="2" width="32" height="24" rx="3" fill="#D97706" opacity="0.4" />
      <path d="M 2 10 H 34 M 2 18 H 34 M 14 2 V 26 M 22 2 V 26" stroke="#FBBF24" strokeWidth="1" />
    </svg>
  );
}

export function AccountsClient({ initialAccounts }: AccountsClientProps) {
  const [accountList, setAccountList] = React.useState<Account[]>(initialAccounts);
  const isBalanceHidden = usePrivacyStore((s) => s.isBalanceHidden);

  const totalPositiveAssetsCents = accountList
    .filter((acc) => acc.currentBalance > 0)
    .reduce((sum, acc) => sum + acc.currentBalance, 0);

  const totalLiabilitiesCents = accountList
    .filter((acc) => acc.currentBalance < 0)
    .reduce((sum, acc) => sum + Math.abs(acc.currentBalance), 0);

  const totalNetWorthCents = totalPositiveAssetsCents - totalLiabilitiesCents;

  const getCardTheme = (acc: Account) => {
    if (acc.currentBalance < 0) {
      return "border-rose-500/40 bg-gradient-to-br from-slate-900 via-rose-950/25 to-slate-950";
    }
    const name = acc.name.toLowerCase();
    if (name.includes("mandiri")) {
      return "border-amber-500/40 bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-950";
    }
    if (name.includes("dana")) {
      return "border-cyan-500/40 bg-gradient-to-br from-slate-900 via-cyan-950/20 to-slate-950";
    }
    if (name.includes("blu")) {
      return "border-sky-500/40 bg-gradient-to-br from-slate-900 via-sky-950/20 to-slate-950";
    }
    if (name.includes("bca")) {
      return "border-blue-500/40 bg-gradient-to-br from-slate-900 via-blue-950/20 to-slate-950";
    }
    if (acc.type === "INVESTMENT") {
      return "border-purple-500/40 bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-950";
    }
    return "border-emerald-500/30 bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-950";
  };

  return (
    <div className="space-y-8">
      {/* Top Header & Net Worth Bento */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Portofolio Rekening &amp; Dompet
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-sans mt-1">
            Manajemen saldo real-time dan buku besar {accountList.length} kantong keuangan pengguna.
          </p>
        </div>
      </div>

      {/* Net Worth Hero Bento: 3-Tier Metrics */}
      <Card className="p-6 relative overflow-hidden bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border-white/15">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>TOTAL KEKAYAAN BERSIH (NET WORTH)</span>
                <PrivacyToggle size="sm" />
              </div>
              <TabularCurrency
                cents={totalNetWorthCents}
                size="2xl"
                color="income"
                isMasked={isBalanceHidden}
              />
              <p className="text-xs text-slate-400">
                Konsolidasi saldo berjalan {accountList.length} rekening bank, e-wallet, dan aset investasi.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/import">
                <Button size="sm" className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs">
                  + Tambah Mutasi
                </Button>
              </Link>
            </div>
          </div>

          {/* 3-Tier Metric Sub-Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-white/[0.08]">
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
              <div>
                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  TOTAL ASET BRUTO (SALDO POSITIF)
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Rekening, kas, dan investasi dengan saldo di atas nol
                </div>
              </div>
              <TabularCurrency
                cents={totalPositiveAssetsCents}
                size="md"
                color="income"
                isMasked={isBalanceHidden}
              />
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
              <div>
                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  TOTAL LIABILITAS / SALDO MINUS
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Akun penampung dengan saldo defisit
                </div>
              </div>
              <TabularCurrency
                cents={totalLiabilitiesCents ? -totalLiabilitiesCents : 0}
                size="md"
                color={totalLiabilitiesCents ? "expense" : "muted"}
                isMasked={isBalanceHidden}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 16 Accounts Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {accountList.map((acc) => {
          const themeClass = getCardTheme(acc);
          const maskedNumber = acc.accountNumber ? `•••• ${acc.accountNumber.slice(-4)}` : "Akun Terverifikasi";

          return (
            <Link
              key={acc.id}
              href={`/transactions?wallet=${encodeURIComponent(acc.name)}`}
              className={`p-5 rounded-2xl border backdrop-blur-xl transition-all duration-200 hover:translate-y-[-3px] hover:shadow-2xl active:scale-[0.98] flex flex-col justify-between h-48 relative overflow-hidden group cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-400 focus:outline-none ${themeClass}`}
              title={`Buka riwayat transaksi untuk ${acc.name}`}
              aria-label={`Buka riwayat transaksi untuk ${acc.name}`}
            >
              {/* Card Top: Chip & Type + Affordance Icon */}
              <div className="flex items-center justify-between">
                <EmvChipSvg />
                <div className="flex items-center gap-1.5">
                  {acc.currentBalance < 0 && (
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      Minus
                    </span>
                  )}
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white border border-white/10">
                    {acc.type}
                  </span>
                  <div className="w-6 h-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30 transition-all duration-200">
                    <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>
              </div>

              {/* Card Middle: Account Name & Number */}
              <div className="space-y-1 my-auto">
                <h3 className="font-bold text-slate-100 text-sm tracking-tight truncate group-hover:text-emerald-300 transition-colors" title={acc.name}>
                  {acc.name}
                </h3>
                <div className="font-mono text-[11px] text-slate-400">
                  {maskedNumber}
                </div>
              </div>

              {/* Card Bottom: Balance & Currency */}
              <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500 uppercase group-hover:text-slate-400 transition-colors">Saldo</span>
                <TabularCurrency
                  cents={acc.currentBalance}
                  size="sm"
                  color={acc.currentBalance < 0 ? "expense" : "default"}
                  isMasked={isBalanceHidden}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
