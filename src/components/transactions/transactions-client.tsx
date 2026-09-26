"use client";

import * as React from "react";
import { TabularCurrency } from "@/components/ui/tabular-currency";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContraPairTether } from "@/components/ui/contra-pair-tether";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  Receipt,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

export interface TransactionRow {
  id: string;
  date: string;
  time: string | null;
  amount: number;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  description: string;
  note: string | null;
  sourceType: string;
  transferPairId: string | null;
  accountId?: string;
  accountName: string;
  targetAccountId?: string | null;
  targetAccountName?: string | null;
  categoryName: string | null;
}

export interface TransactionsClientProps {
  initialTransactions: TransactionRow[];
  accounts: string[];
  availableMonths?: string[];
  initialWallet?: string;
}

function formatMonthTitle(ym: string) {
  if (ym === "ALL") return "Semua Periode";
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const date = new Date(Date.UTC(y, m - 1, 1));
  return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

export function TransactionsClient({
  initialTransactions,
  accounts,
  availableMonths,
  initialWallet,
}: TransactionsClientProps) {
  const matchedWallet = React.useMemo(() => {
    if (!initialWallet || initialWallet === "ALL") return "ALL";
    const found = accounts.find((a) => a.toLowerCase() === initialWallet.toLowerCase());
    return found || initialWallet;
  }, [accounts, initialWallet]);

  const nowYM = React.useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }, []);

  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedWallet, setSelectedWallet] = React.useState(matchedWallet);
  const [selectedType, setSelectedType] = React.useState("ALL");
  const [selectedMonth, setSelectedMonth] = React.useState(nowYM);

  React.useEffect(() => {
    if (initialWallet) {
      const found = accounts.find((a) => a.toLowerCase() === initialWallet.toLowerCase());
      setSelectedWallet(found || initialWallet);
    }
  }, [initialWallet, accounts]);

  const months = React.useMemo(() => {
    const base =
      availableMonths && availableMonths.length > 0
        ? [...availableMonths]
        : Array.from(
            new Set(initialTransactions.map((t) => t.date.slice(0, 7)).filter(Boolean))
          );
    if (!base.includes(nowYM)) {
      base.push(nowYM);
    }
    return base.sort().reverse();
  }, [availableMonths, initialTransactions, nowYM]);

  const currentMonthIdx = months.indexOf(selectedMonth);

  const handlePrevMonth = () => {
    if (selectedMonth === "ALL") {
      if (months.length > 0) setSelectedMonth(months[0]);
    } else {
      // months is descending: index + 1 is older month (chronological previous)
      if (currentMonthIdx < months.length - 1) {
        setSelectedMonth(months[currentMonthIdx + 1]);
      }
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === "ALL") {
      // When at ALL, chevron next remains disabled
    } else {
      // months is descending: index - 1 is newer month (chronological next)
      if (currentMonthIdx > 0) {
        setSelectedMonth(months[currentMonthIdx - 1]);
      }
    }
  };

  const isPrevDisabled =
    selectedMonth !== "ALL" && currentMonthIdx === months.length - 1;
  const isNextDisabled =
    selectedMonth === "ALL" || currentMonthIdx === 0;

  const filtered = initialTransactions.filter((t) => {
    const matchesSearch =
      t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.note && t.note.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.categoryName && t.categoryName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.targetAccountName && t.targetAccountName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesWallet =
      selectedWallet === "ALL" ||
      t.accountName.toLowerCase() === selectedWallet.toLowerCase() ||
      (t.type === "TRANSFER" && t.targetAccountName?.toLowerCase() === selectedWallet.toLowerCase());

    const isTransferInForSelected =
      selectedWallet !== "ALL" &&
      t.type === "TRANSFER" &&
      t.targetAccountName?.toLowerCase() === selectedWallet.toLowerCase();

    const isTransferOutForSelected =
      selectedWallet !== "ALL" &&
      t.type === "TRANSFER" &&
      t.accountName.toLowerCase() === selectedWallet.toLowerCase();

    let matchesType = true;
    if (selectedType === "ALL") {
      matchesType = true;
    } else if (selectedType === "TRANSFER") {
      matchesType = t.type === "TRANSFER";
    } else if (selectedType === "INCOME") {
      matchesType = t.type === "INCOME" || isTransferInForSelected;
    } else if (selectedType === "EXPENSE") {
      matchesType = t.type === "EXPENSE" || isTransferOutForSelected;
    }

    const matchesMonth =
      selectedMonth === "ALL" || t.date.startsWith(selectedMonth);

    return matchesSearch && matchesWallet && matchesType && matchesMonth;
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Search Bar */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Buku Besar Transaksi (General Ledger)
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 font-sans mt-1">
          Daftar seluruh mutasi perbankan, e-wallet, dan arsip data historis.
        </p>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari transaksi, merchant, catatan..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Controls: Month Navigator + Wallet + Type */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Month Navigator Bar */}
            <div className="flex items-center rounded-xl bg-slate-900 border border-white/10 p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={isPrevDisabled}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                title="Bulan Lebih Lampau"
                aria-label="Bulan Lebih Lampau"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-7 border-0 bg-transparent px-2 font-mono font-bold text-xs text-white focus:ring-0 shadow-none gap-1.5 hover:bg-white/5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <SelectValue placeholder="Pilih Periode">
                    {formatMonthTitle(selectedMonth)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-64 bg-slate-900 border-white/10">
                  <SelectItem value="ALL" className="font-semibold text-emerald-400">
                    🗓️ Semua Periode ({initialTransactions.length} Mutasi)
                  </SelectItem>
                  {months.map((ym) => (
                    <SelectItem key={ym} value={ym} className="font-mono text-xs">
                      {formatMonthTitle(ym)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <button
                type="button"
                onClick={handleNextMonth}
                disabled={isNextDisabled}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
                title="Bulan Lebih Baru"
                aria-label="Bulan Lebih Baru"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Wallet Filter */}
            <Select value={selectedWallet} onValueChange={setSelectedWallet}>
              <SelectTrigger className="w-[160px] h-9 text-xs">
                <SelectValue placeholder="Semua Rekening" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Rekening / Wallet</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc} value={acc}>
                    {acc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="Semua Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua Tipe</SelectItem>
                <SelectItem value="EXPENSE">💸 Pengeluaran</SelectItem>
                <SelectItem value="INCOME">💰 Pemasukan</SelectItem>
                <SelectItem value="TRANSFER">🔄 Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Active Filter Badges & Summary Strip */}
        <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Menampilkan <strong className="text-white">{filtered.length}</strong> dari {initialTransactions.length} transaksi
            </span>
            {selectedMonth !== "ALL" && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatMonthTitle(selectedMonth)}
              </span>
            )}
            {selectedWallet !== "ALL" && (
              <span className="px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px]">
                {selectedWallet}
              </span>
            )}
            {selectedType !== "ALL" && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[11px]">
                {selectedType}
              </span>
            )}
          </div>

          {(selectedMonth !== nowYM || selectedWallet !== "ALL" || selectedType !== "ALL" || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setSelectedMonth(nowYM);
                setSelectedWallet("ALL");
                setSelectedType("ALL");
                setSearchTerm("");
              }}
              className="text-xs text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </Card>

      {/* Ledger Table */}
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Tanggal</TableHead>
              <TableHead className="w-36">Rekening / Wallet</TableHead>
              <TableHead>Keterangan Mutasi</TableHead>
              <TableHead className="w-44">Kategori</TableHead>
              <TableHead className="w-32 text-right">Nominal</TableHead>
              <TableHead className="w-24 text-center">Tipe</TableHead>
              <TableHead className="w-40">Status Transfer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-xs font-mono text-slate-500">
                  Tidak ada transaksi yang sesuai dengan filter pencarian.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tx) => {
                const isTransfer = tx.type === "TRANSFER";
                const isTargetWallet =
                  selectedWallet !== "ALL" &&
                  tx.targetAccountName?.toLowerCase() === selectedWallet.toLowerCase();
                const isSourceWallet =
                  selectedWallet !== "ALL" &&
                  tx.accountName?.toLowerCase() === selectedWallet.toLowerCase();

                const isTransferIn = isTransfer && isTargetWallet;
                const isTransferOut = isTransfer && isSourceWallet;

                // Amount & Sign & Color
                const displayAmount = isTransferOut ? -tx.amount : tx.amount;
                const displayColor = isTransferIn
                  ? "income"
                  : isTransferOut
                  ? "expense"
                  : tx.type === "INCOME"
                  ? "income"
                  : tx.type === "EXPENSE"
                  ? "expense"
                  : "transfer";

                const showSign = isTransfer ? (isTransferIn || isTransferOut) : true;

                // Account column display
                const accountDisplay =
                  isTransfer && selectedWallet === "ALL" ? (
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="text-slate-200">{tx.accountName}</span>
                      <span className="text-slate-500">➔</span>
                      <span className="text-indigo-400 font-semibold">
                        {tx.targetAccountName || tx.categoryName || "Target"}
                      </span>
                    </div>
                  ) : isTransferIn ? (
                    <div>
                      <div className="font-mono text-xs text-emerald-400 font-semibold">
                        {tx.targetAccountName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        dari {tx.accountName}
                      </div>
                    </div>
                  ) : isTransferOut ? (
                    <div>
                      <div className="font-mono text-xs text-rose-400 font-semibold">
                        {tx.accountName}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        ke {tx.targetAccountName || tx.categoryName}
                      </div>
                    </div>
                  ) : (
                    <div className="font-mono text-xs text-slate-200">{tx.accountName}</div>
                  );

                // Description display
                const descriptionDisplay = isTransferIn ? (
                  tx.description && tx.description !== "🔄 Pindah Uang"
                    ? tx.description
                    : `Transfer masuk dari ${tx.accountName}`
                ) : isTransferOut ? (
                  tx.description && tx.description !== "🔄 Pindah Uang"
                    ? tx.description
                    : `Transfer keluar ke ${tx.targetAccountName || "Akun Tujuan"}`
                ) : (
                  tx.description
                );

                // Badge display
                const badge = isTransferIn ? (
                  <Badge variant="income" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    Transfer Masuk
                  </Badge>
                ) : isTransferOut ? (
                  <Badge variant="expense" className="bg-rose-500/10 text-rose-400 border-rose-500/20">
                    Transfer Keluar
                  </Badge>
                ) : (
                  <Badge
                    variant={
                      tx.type === "INCOME"
                        ? "income"
                        : tx.type === "EXPENSE"
                        ? "expense"
                        : "transfer"
                    }
                  >
                    {tx.type === "INCOME"
                      ? "Pemasukan"
                      : tx.type === "EXPENSE"
                      ? "Pengeluaran"
                      : "Transfer"}
                  </Badge>
                );

                return (
                  <TableRow key={tx.id + (isTransferIn ? "-in" : "")} className="hover:bg-white/[0.02]">
                    <TableCell className="font-mono text-xs text-slate-300">
                      <div>{tx.date}</div>
                      {tx.time && <div className="text-[10px] text-slate-500">{tx.time}</div>}
                    </TableCell>

                    <TableCell>{accountDisplay}</TableCell>

                    <TableCell>
                      <div className="font-medium text-slate-100 text-xs sm:text-sm line-clamp-1">
                        {descriptionDisplay}
                      </div>
                      {tx.note && <div className="text-[11px] text-slate-500">{tx.note}</div>}
                    </TableCell>

                    <TableCell className="text-xs text-slate-400">
                      {tx.categoryName || "—"}
                    </TableCell>

                    <TableCell className="text-right">
                      <TabularCurrency
                        cents={displayAmount}
                        size="sm"
                        color={displayColor}
                        showSign={showSign}
                      />
                    </TableCell>

                    <TableCell className="text-center">{badge}</TableCell>

                    <TableCell>
                      {isTransfer && (
                        <ContraPairTether
                          pairId={tx.transferPairId}
                          targetWalletName={
                            isTransferIn
                              ? `dari ${tx.accountName}`
                              : tx.targetAccountName ||
                                (tx.categoryName === "🔄 Pindah Uang" ? null : tx.categoryName)
                          }
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
