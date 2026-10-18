"use client";

import * as React from "react";
import { TabularCurrency } from "@/components/ui/tabular-currency";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { PrivacyToggle } from "@/components/ui/privacy-toggle";
import { usePrivacyStore } from "@/store/use-privacy-store";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  TransactionFormDialog,
  CategoryOption,
} from "@/components/transactions/transaction-form-dialog";
import { DeleteTransactionDialog } from "@/components/transactions/delete-transaction-dialog";

export interface TransactionRow {
  id: string;
  inputOrder?: number;
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
  sourceBalance?: number;
  targetBalance?: number | null;
}

export interface AccountMetadata {
  id: string;
  name: string;
  initialBalance: number;
  currentBalance?: number;
}

export type SortField = "date" | "row";
export type SortDirection = "asc" | "desc";

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export function parseSortParam(sortParam?: string | null): SortConfig {
  if (sortParam === "row-asc") return { field: "row", direction: "asc" };
  if (sortParam === "row-desc") return { field: "row", direction: "desc" };
  if (sortParam === "date-asc" || sortParam === "asc") return { field: "date", direction: "asc" };
  return { field: "date", direction: "desc" };
}

export function serializeSortParam(config: SortConfig): string | null {
  if (config.field === "date" && config.direction === "desc") return null;
  if (config.field === "date") return "date-asc";
  if (config.field === "row") return config.direction === "asc" ? "row-asc" : "row-desc";
  return null;
}

export function calculateRunningBalances(
  transactions: TransactionRow[],
  accountsMetadata?: AccountMetadata[]
): Map<string, { sourceBalance: number; targetBalance: number | null }> {
  const balanceTracker = new Map<string, number>();

  if (accountsMetadata && accountsMetadata.length > 0) {
    for (const acc of accountsMetadata) {
      const initial = acc.initialBalance || 0;
      balanceTracker.set(acc.id, initial);
      balanceTracker.set(acc.name.toLowerCase(), initial);
    }
  }

  const getBal = (id?: string | null, name?: string | null): number => {
    if (id && balanceTracker.has(id)) return balanceTracker.get(id)!;
    if (name && balanceTracker.has(name.toLowerCase())) return balanceTracker.get(name.toLowerCase())!;
    return 0;
  };

  const setBal = (id: string | null | undefined, name: string | null | undefined, newBal: number) => {
    if (id) balanceTracker.set(id, newBal);
    if (name) balanceTracker.set(name.toLowerCase(), newBal);
  };

  const chronological = [...transactions].sort((a, b) => {
    const dateComp = (a.date || "").localeCompare(b.date || "");
    if (dateComp !== 0) return dateComp;
    const timeComp = (a.time || "").localeCompare(b.time || "");
    if (timeComp !== 0) return timeComp;
    const orderA = a.inputOrder ?? 0;
    const orderB = b.inputOrder ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return (a.id || "").localeCompare(b.id || "");
  });

  const resultMap = new Map<string, { sourceBalance: number; targetBalance: number | null }>();

  for (const tx of chronological) {
    const currentSourceBal = getBal(tx.accountId, tx.accountName);

    if (tx.type === "INCOME") {
      const newSourceBal = currentSourceBal + tx.amount;
      setBal(tx.accountId, tx.accountName, newSourceBal);
      resultMap.set(tx.id, { sourceBalance: newSourceBal, targetBalance: null });
    } else if (tx.type === "EXPENSE") {
      const newSourceBal = currentSourceBal - tx.amount;
      setBal(tx.accountId, tx.accountName, newSourceBal);
      resultMap.set(tx.id, { sourceBalance: newSourceBal, targetBalance: null });
    } else if (tx.type === "TRANSFER") {
      const newSourceBal = currentSourceBal - tx.amount;
      setBal(tx.accountId, tx.accountName, newSourceBal);

      let newTargetBal: number | null = null;
      if (tx.targetAccountId || tx.targetAccountName) {
        const currentTargetBal = getBal(tx.targetAccountId, tx.targetAccountName);
        newTargetBal = currentTargetBal + tx.amount;
        setBal(tx.targetAccountId, tx.targetAccountName, newTargetBal);
      }

      resultMap.set(tx.id, { sourceBalance: newSourceBal, targetBalance: newTargetBal });
    }
  }

  return resultMap;
}

export interface PeriodBalanceSummary {
  startBalance: number;
  endBalance: number;
  startDateStr: string;
  endDateStr: string;
  periodLabel: string;
}

export function calculatePeriodBalances(
  transactions: TransactionRow[],
  accountsMetadata?: AccountMetadata[],
  selectedWallet: string = "ALL",
  selectedMonth: string = "ALL"
): PeriodBalanceSummary {
  const isAllWallets = !selectedWallet || selectedWallet === "ALL";
  const normalizedWallet = selectedWallet?.toLowerCase();

  let initialBalanceBase = 0;
  if (accountsMetadata && accountsMetadata.length > 0) {
    if (isAllWallets) {
      initialBalanceBase = accountsMetadata.reduce((sum, a) => sum + (a.initialBalance || 0), 0);
    } else {
      const found = accountsMetadata.find(
        (a) => a.id === selectedWallet || a.name.toLowerCase() === normalizedWallet
      );
      initialBalanceBase = found?.initialBalance || 0;
    }
  }

  const isTxInWallet = (tx: TransactionRow) => {
    if (isAllWallets) return true;
    const isSource =
      tx.accountId === selectedWallet || tx.accountName.toLowerCase() === normalizedWallet;
    const isTarget =
      tx.type === "TRANSFER" &&
      (tx.targetAccountId === selectedWallet ||
        tx.targetAccountName?.toLowerCase() === normalizedWallet);
    return isSource || isTarget;
  };

  const getTxDelta = (tx: TransactionRow) => {
    if (isAllWallets) {
      if (tx.type === "INCOME") return tx.amount;
      if (tx.type === "EXPENSE") return -tx.amount;
      return 0;
    }

    const isSource =
      tx.accountId === selectedWallet || tx.accountName.toLowerCase() === normalizedWallet;
    const isTarget =
      tx.type === "TRANSFER" &&
      (tx.targetAccountId === selectedWallet ||
        tx.targetAccountName?.toLowerCase() === normalizedWallet);

    if (isSource && isTarget) return 0;
    if (isTarget) return tx.amount;
    if (tx.type === "INCOME") return tx.amount;
    if (tx.type === "EXPENSE" || tx.type === "TRANSFER") return -tx.amount;
    return 0;
  };

  const isAllMonths = !selectedMonth || selectedMonth === "ALL";
  const periodStart = isAllMonths ? "" : `${selectedMonth}-01`;

  let startBalance = initialBalanceBase;
  let endBalance = initialBalanceBase;

  let startDateStr = "";
  let endDateStr = "";

  if (!isAllMonths) {
    const [y, m] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const lastDayStr = String(lastDay).padStart(2, "0");
    startDateStr = `${selectedMonth}-01`;
    endDateStr = `${selectedMonth}-${lastDayStr}`;
  }

  for (const tx of transactions) {
    if (!isTxInWallet(tx)) continue;
    const delta = getTxDelta(tx);

    if (isAllMonths) {
      endBalance += delta;
      if (!startDateStr || tx.date < startDateStr) startDateStr = tx.date;
      if (!endDateStr || tx.date > endDateStr) endDateStr = tx.date;
    } else {
      if (tx.date < periodStart) {
        startBalance += delta;
        endBalance += delta;
      } else if (tx.date.startsWith(selectedMonth)) {
        endBalance += delta;
      }
    }
  }

  const periodLabel = isAllMonths ? "Semua Periode" : formatMonthTitle(selectedMonth);

  return {
    startBalance,
    endBalance,
    startDateStr: startDateStr || (isAllMonths ? "Awal" : `${selectedMonth}-01`),
    endDateStr: endDateStr || (isAllMonths ? "Akhir" : `${selectedMonth}-28`),
    periodLabel,
  };
}

export interface TransactionsClientProps {
  initialTransactions: TransactionRow[];
  accounts: string[] | AccountMetadata[];
  accountsMetadata?: AccountMetadata[];
  categoriesData?: CategoryOption[];
  availableMonths?: string[];
  initialWallet?: string;
  initialSort?: string;
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
  accountsMetadata,
  categoriesData,
  availableMonths,
  initialWallet,
  initialSort,
}: TransactionsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isBalanceHidden = usePrivacyStore((s) => s.isBalanceHidden);

  const accountNames = React.useMemo(() => {
    return accounts.map((a) => (typeof a === "string" ? a : a.name));
  }, [accounts]);

  const effectiveAccountsMetadata = React.useMemo<AccountMetadata[]>(() => {
    if (accountsMetadata && accountsMetadata.length > 0) return accountsMetadata;
    return accounts
      .filter((a): a is AccountMetadata => typeof a !== "string")
      .map((a) => ({
        id: a.id,
        name: a.name,
        initialBalance: a.initialBalance,
        currentBalance: a.currentBalance,
      }));
  }, [accounts, accountsMetadata]);

  const runningBalancesMap = React.useMemo(() => {
    return calculateRunningBalances(initialTransactions, effectiveAccountsMetadata);
  }, [initialTransactions, effectiveAccountsMetadata]);

  const matchedWallet = React.useMemo(() => {
    if (!initialWallet || initialWallet === "ALL") return "ALL";
    const found = accountNames.find((a) => a.toLowerCase() === initialWallet.toLowerCase());
    return found || initialWallet;
  }, [accountNames, initialWallet]);

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
  const [sortConfig, setSortConfig] = React.useState<SortConfig>(() =>
    parseSortParam(initialSort)
  );

  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [editingTransaction, setEditingTransaction] = React.useState<TransactionRow | null>(null);
  const [deletingTransaction, setDeletingTransaction] = React.useState<TransactionRow | null>(null);

  const periodSummary = React.useMemo(() => {
    return calculatePeriodBalances(
      initialTransactions,
      effectiveAccountsMetadata,
      selectedWallet,
      selectedMonth
    );
  }, [initialTransactions, effectiveAccountsMetadata, selectedWallet, selectedMonth]);

  React.useEffect(() => {
    if (initialWallet) {
      const found = accountNames.find((a) => a.toLowerCase() === initialWallet.toLowerCase());
      setSelectedWallet(found || initialWallet);
    }
  }, [initialWallet, accountNames]);

  React.useEffect(() => {
    if (initialSort) {
      setSortConfig(parseSortParam(initialSort));
    }
  }, [initialSort]);

  const updateSort = (newConfig: SortConfig) => {
    setSortConfig(newConfig);
    try {
      const current = new URLSearchParams(Array.from(searchParams?.entries() || []));
      const serialized = serializeSortParam(newConfig);
      if (!serialized) {
        current.delete("sort");
      } else {
        current.set("sort", serialized);
      }
      const search = current.toString();
      const query = search ? `?${search}` : "";
      router.replace(`${pathname}${query}`, { scroll: false });
    } catch {
      // Graceful fallback for non-browser or test runner environments
    }
  };

  const handleSortDateToggle = () => {
    if (sortConfig.field !== "date") {
      updateSort({ field: "date", direction: "desc" });
    } else {
      updateSort({
        field: "date",
        direction: sortConfig.direction === "desc" ? "asc" : "desc",
      });
    }
  };

  const handleSortRowToggle = () => {
    if (sortConfig.field !== "row") {
      updateSort({ field: "row", direction: "asc" });
    } else {
      updateSort({
        field: "row",
        direction: sortConfig.direction === "asc" ? "desc" : "asc",
      });
    }
  };

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

  const relativeRowNumberMap = React.useMemo(() => {
    const inputOrdered = [...filtered].sort((a, b) => {
      if (a.inputOrder !== undefined && b.inputOrder !== undefined) {
        return a.inputOrder - b.inputOrder;
      }
      const dateComp = (a.date || "").localeCompare(b.date || "");
      if (dateComp !== 0) return dateComp;
      return (a.time || "").localeCompare(b.time || "");
    });

    const map = new Map<string, number>();
    inputOrdered.forEach((t, idx) => {
      map.set(t.id, idx + 1);
    });
    return map;
  }, [filtered]);

  const sortedTransactions = React.useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortConfig.field === "row") {
        const numA = relativeRowNumberMap.get(a.id) ?? (a.inputOrder || 0);
        const numB = relativeRowNumberMap.get(b.id) ?? (b.inputOrder || 0);
        return sortConfig.direction === "asc" ? numA - numB : numB - numA;
      }

      const dateA = a.date || "";
      const dateB = b.date || "";
      if (dateA !== dateB) {
        return sortConfig.direction === "desc"
          ? dateB.localeCompare(dateA)
          : dateA.localeCompare(dateB);
      }
      const timeA = a.time || "";
      const timeB = b.time || "";
      if (timeA !== timeB) {
        return sortConfig.direction === "desc"
          ? timeB.localeCompare(timeA)
          : timeA.localeCompare(timeB);
      }
      const orderA = a.inputOrder || 0;
      const orderB = b.inputOrder || 0;
      return sortConfig.direction === "desc" ? orderB - orderA : orderA - orderB;
    });
  }, [filtered, sortConfig, relativeRowNumberMap]);

  const showPeriodSummaryRows = !searchTerm && selectedType === "ALL";
  const isDescOrder = sortConfig.direction === "desc";

  const renderSaldoAwalRow = () => (
    <TableRow
      key="period-starting-balance"
      data-summary-row="true"
      aria-label="Saldo Awal Periode"
      className="bg-sky-500/[0.04] border-b border-sky-500/20 hover:bg-sky-500/[0.07] transition-colors"
    >
      <TableCell className="font-mono text-xs text-center font-semibold text-sky-400">
        🏁
      </TableCell>
      <TableCell className="font-mono text-xs text-sky-300 font-semibold">
        <div>{periodSummary.startDateStr}</div>
        <div className="text-[10px] text-sky-400/70 font-mono">Awal Periode</div>
      </TableCell>
      <TableCell>
        <div className="font-mono text-xs text-sky-200 font-semibold">
          {selectedWallet === "ALL" ? "Konsolidasi Portofolio" : selectedWallet}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-semibold text-sky-100 text-xs sm:text-sm">
          Saldo Awal Periode {periodSummary.periodLabel}
        </div>
        <div className="text-[11px] text-sky-400/70">
          Posisi kas pembuka sebelum transaksi periode ini
        </div>
      </TableCell>
      <TableCell className="text-xs text-slate-400 font-mono">
        Ikhtisar Saldo
      </TableCell>
      <TableCell className="text-right text-xs text-slate-500 font-mono">
        —
      </TableCell>
      <TableCell className="text-right font-semibold">
        <TabularCurrency
          cents={periodSummary.startBalance}
          size="sm"
          color="default"
          isMasked={isBalanceHidden}
        />
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="bg-sky-500/10 text-sky-400 border-sky-500/30 text-[11px]">
          Saldo Awal
        </Badge>
      </TableCell>
      <TableCell className="text-slate-500 text-xs text-center font-mono">
        —
      </TableCell>
      <TableCell className="text-slate-500 text-xs text-center font-mono">
        —
      </TableCell>
    </TableRow>
  );

  const renderSaldoAkhirRow = () => (
    <TableRow
      key="period-ending-balance"
      data-summary-row="true"
      aria-label="Saldo Akhir Periode"
      className="bg-emerald-500/[0.04] border-b border-emerald-500/20 hover:bg-emerald-500/[0.07] transition-colors"
    >
      <TableCell className="font-mono text-xs text-center font-semibold text-emerald-400">
        🚩
      </TableCell>
      <TableCell className="font-mono text-xs text-emerald-300 font-semibold">
        <div>{periodSummary.endDateStr}</div>
        <div className="text-[10px] text-emerald-400/70 font-mono">Akhir Periode</div>
      </TableCell>
      <TableCell>
        <div className="font-mono text-xs text-emerald-200 font-semibold">
          {selectedWallet === "ALL" ? "Konsolidasi Portofolio" : selectedWallet}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-semibold text-emerald-100 text-xs sm:text-sm">
          Saldo Akhir Periode {periodSummary.periodLabel}
        </div>
        <div className="text-[11px] text-emerald-400/70">
          Posisi kas penutup setelah seluruh mutasi periode ini
        </div>
      </TableCell>
      <TableCell className="text-xs text-slate-400 font-mono">
        Ikhtisar Saldo
      </TableCell>
      <TableCell className="text-right text-xs text-slate-500 font-mono">
        —
      </TableCell>
      <TableCell className="text-right font-semibold">
        <TabularCurrency
          cents={periodSummary.endBalance}
          size="sm"
          color="income"
          isMasked={isBalanceHidden}
        />
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px]">
          Saldo Akhir
        </Badge>
      </TableCell>
      <TableCell className="text-slate-500 text-xs text-center font-mono">
        —
      </TableCell>
      <TableCell className="text-slate-500 text-xs text-center font-mono">
        —
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      {/* Page Title & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Buku Besar Transaksi (General Ledger)
            </h1>
            <PrivacyToggle size="sm" />
          </div>
          <p className="text-xs sm:text-sm text-slate-400 font-sans mt-1">
            Daftar seluruh mutasi perbankan, e-wallet, dan arsip data historis.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/40"
        >
          <Plus className="w-3.5 h-3.5" />
          Tambah Transaksi
        </Button>
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
                {accountNames.map((acc) => (
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
            {sortConfig.field === "row" && sortConfig.direction === "asc" && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] flex items-center gap-1 font-mono">
                <ArrowUp className="w-3 h-3" />
                No. Input: 1 ➔ N
              </span>
            )}
            {sortConfig.field === "row" && sortConfig.direction === "desc" && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] flex items-center gap-1 font-mono">
                <ArrowDown className="w-3 h-3" />
                No. Input: N ➔ 1
              </span>
            )}
            {sortConfig.field === "date" && sortConfig.direction === "asc" && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] flex items-center gap-1">
                <ArrowUp className="w-3 h-3" />
                Terlama ➔ Terbaru
              </span>
            )}
          </div>

          {(selectedMonth !== nowYM || selectedWallet !== "ALL" || selectedType !== "ALL" || searchTerm || sortConfig.field !== "date" || sortConfig.direction !== "desc") && (
            <button
              type="button"
              onClick={() => {
                setSelectedMonth(nowYM);
                setSelectedWallet("ALL");
                setSelectedType("ALL");
                setSearchTerm("");
                updateSort({ field: "date", direction: "desc" });
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
              <TableHead className="w-16 text-center">
                <button
                  type="button"
                  onClick={handleSortRowToggle}
                  className="inline-flex items-center justify-center gap-1 text-slate-300 hover:text-white font-mono text-xs font-semibold group cursor-pointer transition-colors"
                  title={`Urutkan nomor urut input (${sortConfig.field === "row" && sortConfig.direction === "asc" ? "1 ➔ N" : "N ➔ 1"})`}
                  aria-label="Urutkan nomor urut input"
                >
                  <span>No.</span>
                  {sortConfig.field === "row" ? (
                    sortConfig.direction === "asc" ? (
                      <ArrowUp className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </TableHead>
              <TableHead className="w-28">
                <button
                  type="button"
                  onClick={handleSortDateToggle}
                  className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white font-mono text-xs font-semibold group cursor-pointer transition-colors"
                  title={`Urutkan tanggal (${sortConfig.field === "date" && sortConfig.direction === "desc" ? "Terbaru ➔ Terlama" : "Terlama ➔ Terbaru"})`}
                  aria-label={`Urutkan tanggal (${sortConfig.field === "date" && sortConfig.direction === "desc" ? "Terbaru ➔ Terlama" : "Terlama ➔ Terbaru"})`}
                >
                  <span>Tanggal</span>
                  {sortConfig.field === "date" ? (
                    sortConfig.direction === "desc" ? (
                      <ArrowDown className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    ) : (
                      <ArrowUp className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              </TableHead>
              <TableHead className="w-36">Rekening / Wallet</TableHead>
              <TableHead>Keterangan Mutasi</TableHead>
              <TableHead className="w-44">Kategori</TableHead>
              <TableHead className="w-32 text-right">Nominal</TableHead>
              <TableHead className="w-36 text-right">Saldo</TableHead>
              <TableHead className="w-24 text-center">Tipe</TableHead>
              <TableHead className="w-40">Status Transfer</TableHead>
              <TableHead className="w-20 text-center">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTransactions.length === 0 && !showPeriodSummaryRows ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-xs font-mono text-slate-500">
                  Tidak ada transaksi yang sesuai dengan filter pencarian.
                </TableCell>
              </TableRow>
            ) : (
              <>
                {showPeriodSummaryRows && (isDescOrder ? renderSaldoAkhirRow() : renderSaldoAwalRow())}
                {sortedTransactions.length === 0 && showPeriodSummaryRows && (
                  <TableRow>
                    <TableCell colSpan={10} className="h-20 text-center text-xs font-mono text-slate-500">
                      Tidak ada transaksi yang sesuai dengan filter pencarian.
                    </TableCell>
                  </TableRow>
                )}
                {sortedTransactions.map((tx) => {
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

                const rowNumber = relativeRowNumberMap.get(tx.id) ?? tx.inputOrder;

                const txBalances = runningBalancesMap.get(tx.id);
                const sourceBal = tx.sourceBalance ?? txBalances?.sourceBalance ?? 0;
                const targetBal = tx.targetBalance ?? txBalances?.targetBalance ?? null;

                const displayBal = isTransferIn && targetBal !== null ? targetBal : sourceBal;
                const showTargetSubtitle =
                  isTransfer && selectedWallet === "ALL" && targetBal !== null;

                return (
                  <TableRow key={tx.id + (isTransferIn ? "-in" : "")} className="hover:bg-white/[0.02]">
                    <TableCell className="font-mono text-xs text-slate-400 text-center font-semibold">
                      {rowNumber ? `#${rowNumber}` : "—"}
                    </TableCell>
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
                        isMasked={isBalanceHidden}
                      />
                    </TableCell>

                    <TableCell className="text-right">
                      <TabularCurrency
                        cents={displayBal}
                        size="sm"
                        color="default"
                        isMasked={isBalanceHidden}
                      />
                      {showTargetSubtitle && (
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Target:{" "}
                          <TabularCurrency
                            cents={targetBal}
                            size="sm"
                            color="muted"
                            isMasked={isBalanceHidden}
                          />
                        </div>
                      )}
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

                    <TableCell className="text-center py-2 px-1">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingTransaction(tx)}
                          title={`Edit Transaksi ${tx.description}`}
                          aria-label={`Edit Transaksi ${tx.description}`}
                          className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTransaction(tx)}
                          title={`Hapus Transaksi ${tx.description}`}
                          aria-label={`Hapus Transaksi ${tx.description}`}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {showPeriodSummaryRows && (isDescOrder ? renderSaldoAwalRow() : renderSaldoAkhirRow())}
            </>
          )}
        </TableBody>
        </Table>
      </Card>

      <TransactionFormDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        mode="create"
        accounts={effectiveAccountsMetadata.map((a) => ({ id: a.id, name: a.name }))}
        categories={categoriesData || []}
        onSuccess={() => router.refresh()}
      />

      {editingTransaction && (
        <TransactionFormDialog
          open={!!editingTransaction}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
          mode="edit"
          initialData={editingTransaction}
          accounts={effectiveAccountsMetadata.map((a) => ({ id: a.id, name: a.name }))}
          categories={categoriesData || []}
          onSuccess={() => {
            setEditingTransaction(null);
            router.refresh();
          }}
        />
      )}

      {deletingTransaction && (
        <DeleteTransactionDialog
          open={!!deletingTransaction}
          onOpenChange={(open) => !open && setDeletingTransaction(null)}
          transaction={deletingTransaction}
          onSuccess={() => {
            setDeletingTransaction(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
