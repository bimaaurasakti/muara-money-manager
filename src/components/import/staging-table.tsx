"use client";

import * as React from "react";
import { useStagingStore } from "@/store/use-staging-store";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TabularCurrency } from "@/components/ui/tabular-currency";
import { ContraPairTether } from "@/components/ui/contra-pair-tether";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, CheckCircle2, RotateCcw, Building2, HelpCircle, ArrowDown, ArrowUp } from "lucide-react";

export interface StagingTableProps {
  availableWallets?: string[];
  onCommit: () => Promise<void>;
  isCommitting?: boolean;
}

export function StagingTable({
  availableWallets = [],
  onCommit,
  isCommitting = false,
}: StagingTableProps) {
  const {
    transactions,
    selectedRowIds,
    toggleSelectRow,
    selectAll,
    clearSelection,
    removeRow,
    removeSelectedRows,
    bulkReassignWallet,
    unpairTransfer,
    confirmTransferPair,
    reset,
  } = useStagingStore();

  const [bulkWallet, setBulkWallet] = React.useState<string>("");
  const [ambiguousRowId, setAmbiguousRowId] = React.useState<string | null>(null);
  const [sortOrder, setSortOrder] = React.useState<"desc" | "asc">("desc");

  const sortedTransactions = React.useMemo(() => {
    return [...transactions].sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      if (dateA !== dateB) {
        return sortOrder === "desc" ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
      }
      const timeA = a.time || "";
      const timeB = b.time || "";
      return sortOrder === "desc" ? timeB.localeCompare(timeA) : timeA.localeCompare(timeB);
    });
  }, [transactions, sortOrder]);

  const duplicateCount = React.useMemo(() => {
    return transactions.filter((t) => t.isDuplicate).length;
  }, [transactions]);

  const selectableTransactions = React.useMemo(() => {
    return transactions.filter((t) => !t.isDuplicate);
  }, [transactions]);

  const isAllSelected =
    selectableTransactions.length > 0 &&
    selectableTransactions.every((t) => selectedRowIds.includes(t.id));

  const handleBulkReassign = () => {
    if (!bulkWallet) return;
    bulkReassignWallet(bulkWallet);
    setBulkWallet("");
  };

  const activeAmbiguousRow = transactions.find((t) => t.id === ambiguousRowId);
  const candidatePartners = activeAmbiguousRow?.candidatePairIds
    ? transactions.filter((t) => activeAmbiguousRow.candidatePairIds?.includes(t.id))
    : [];

  if (transactions.length === 0) {
    return null;
  }

  // Calculate totals
  const totalIncomeCents = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((acc, t) => acc + t.amountCents, 0);

  const totalExpenseCents = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((acc, t) => acc + t.amountCents, 0);

  const totalTransferCents = transactions
    .filter((t) => t.type === "TRANSFER")
    .reduce((acc, t) => acc + t.amountCents, 0) / 2; // single-sided volume

  return (
    <div className="space-y-4">
      {/* Top Action & Bulk Toolbar */}
      <div className="artisan-card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-sans text-slate-300 flex flex-wrap items-center gap-2">
            <span>
              <strong className="font-mono font-bold text-emerald-400">{transactions.length}</strong> Transaksi Terbaca
            </span>
            {duplicateCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono">
                {duplicateCount} Duplikat Terdeteksi
              </span>
            )}
            {selectedRowIds.length > 0 && (
              <span className="text-slate-400">
                (<strong className="font-mono text-white">{selectedRowIds.length}</strong> siap disimpan)
              </span>
            )}
          </div>

          {selectedRowIds.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={bulkWallet} onValueChange={setBulkWallet}>
                <SelectTrigger className="h-8 w-44 text-xs bg-slate-900 border-white/15">
                  <SelectValue placeholder="Pindah ke Wallet..." />
                </SelectTrigger>
                <SelectContent>
                  {availableWallets.map((w) => (
                    <SelectItem key={w} value={w} className="text-xs">
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkReassign}
                disabled={!bulkWallet}
                className="text-xs h-8"
              >
                Terapkan
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={removeSelectedRows}
                className="text-xs h-8 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus ({selectedRowIds.length})</span>
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            className="text-xs text-slate-400 hover:text-rose-400"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset Batch
          </Button>

          <Button
            onClick={onCommit}
            disabled={isCommitting || selectedRowIds.length === 0}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold shadow-lg shadow-emerald-500/20 text-xs sm:text-sm h-9 px-5 transition-all"
            title={selectedRowIds.length === 0 ? "Tidak ada transaksi baru yang dipilih untuk disimpan" : undefined}
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {isCommitting
              ? "Menyimpan ke Turso..."
              : selectedRowIds.length === 0
              ? "0 Transaksi Baru Dipilih"
              : `Simpan & Sinkronkan (${selectedRowIds.length} Transaksi)`}
          </Button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="artisan-card p-3 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-sans">Pemasukan Riil:</span>
          <TabularCurrency cents={totalIncomeCents} color="income" size="sm" />
        </div>
        <div className="artisan-card p-3 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-sans">Pengeluaran Riil:</span>
          <TabularCurrency cents={totalExpenseCents} color="expense" size="sm" />
        </div>
        <div className="artisan-card p-3 flex items-center justify-between border-indigo-500/20 bg-indigo-500/[0.04]">
          <span className="text-xs text-indigo-300 font-sans flex items-center gap-1">
            🔄 Pindah Uang (Netral):
          </span>
          <TabularCurrency cents={totalTransferCents} color="transfer" size="sm" />
        </div>
      </div>

      {/* Main Staging Table */}
      <div className="artisan-card p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={(e) => (e.target.checked ? selectAll() : clearSelection())}
                  className="rounded border-white/20 bg-slate-900 text-emerald-500 focus:ring-emerald-400/50 cursor-pointer"
                  title="Pilih seluruh transaksi baru"
                />
              </TableHead>
              <TableHead className="w-32 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                  className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white font-mono text-xs font-semibold group cursor-pointer transition-colors"
                  title={`Urutkan tanggal (${sortOrder === "desc" ? "Terbaru ➔ Terlama" : "Terlama ➔ Terbaru"})`}
                >
                  <span>Tanggal</span>
                  {sortOrder === "desc" ? (
                    <ArrowDown className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  ) : (
                    <ArrowUp className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                  )}
                </button>
              </TableHead>
              <TableHead className="w-36 px-3 py-2.5">Lokasi Wallet</TableHead>
              <TableHead className="px-3 py-2.5">Keterangan Mutasi</TableHead>
              <TableHead className="w-32 px-3 py-2.5 text-right">Nominal</TableHead>
              <TableHead className="w-24 px-3 py-2.5 text-center">Tipe</TableHead>
              <TableHead className="w-56 px-3 py-2.5">Status Transfer</TableHead>
              <TableHead className="w-10 px-3 py-2.5 text-center"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTransactions.map((tx) => {
              const isSelected = selectedRowIds.includes(tx.id);
              return (
                <TableRow
                  key={tx.id}
                  className={`group transition-colors ${
                    isSelected
                      ? "bg-emerald-500/[0.05]"
                      : tx.isDuplicate
                      ? "bg-amber-500/[0.02]"
                      : ""
                  }`}
                >
                  <TableCell className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectRow(tx.id)}
                      className="rounded border-white/20 bg-slate-900 text-emerald-500 focus:ring-emerald-400/50 cursor-pointer"
                    />
                  </TableCell>

                  <TableCell className="px-3 py-2.5 font-mono text-xs text-slate-300 whitespace-nowrap">
                    <div>{tx.date}</div>
                    {tx.time && <div className="text-[10px] text-slate-500">{tx.time}</div>}
                  </TableCell>

                  <TableCell className="px-3 py-2.5 whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono text-slate-200">
                      <Building2 className="w-3 h-3 text-slate-400" />
                      <span>{tx.sourceWalletName}</span>
                    </div>
                  </TableCell>

                  <TableCell className="px-3 py-2.5">
                    <div className="space-y-1">
                      <div className="font-medium text-slate-200 text-xs sm:text-sm line-clamp-1">
                        {tx.description}
                      </div>
                      {tx.isDuplicate && (
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-mono text-[10px]">
                          <span>⚠️ Sudah Ada di Buku Besar (Duplikat)</span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="px-3 py-2.5 text-right whitespace-nowrap">
                    <TabularCurrency
                      cents={tx.amountCents}
                      size="sm"
                      color={
                        tx.type === "INCOME"
                          ? "income"
                          : tx.type === "EXPENSE"
                          ? "expense"
                          : "transfer"
                      }
                      showSign={tx.type !== "TRANSFER"}
                    />
                  </TableCell>

                  <TableCell className="px-3 py-2.5 text-center whitespace-nowrap">
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
                  </TableCell>

                  <TableCell className="px-3 py-2.5 whitespace-nowrap">
                    {tx.type === "TRANSFER" && tx.transferPairId && (
                      <ContraPairTether
                        pairId={tx.transferPairId}
                        targetWalletName={tx.targetWalletName}
                        confidence={tx.pairConfidence}
                        onUnpair={() => unpairTransfer(tx.id)}
                      />
                    )}
                    {tx.pairConfidence === "AMBIGUOUS" && (
                      <ContraPairTether
                        confidence="AMBIGUOUS"
                        candidateCount={tx.candidatePairIds?.length || 0}
                        onSelectCandidate={() => setAmbiguousRowId(tx.id)}
                      />
                    )}
                  </TableCell>

                  <TableCell className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(tx.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      title="Hapus baris"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Modal Dialog for Ambiguous Contra Candidate Selection */}
      <Dialog open={Boolean(ambiguousRowId)} onOpenChange={(o) => !o && setAmbiguousRowId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <HelpCircle className="w-5 h-5" />
              Pilih Pasangan Transfer Rekanan
            </DialogTitle>
            <DialogDescription>
              Ditemukan beberapa transaksi dengan tanggal dan nominal identik. Pilih transaksi mana yang merupakan pasangan pemindahan dana ini:
            </DialogDescription>
          </DialogHeader>

          {activeAmbiguousRow && (
            <div className="space-y-3 py-2">
              <div className="artisan-card p-3 bg-slate-900/90">
                <div className="text-xs text-slate-400 font-mono">Transaksi Saat Ini:</div>
                <div className="font-semibold text-white text-sm mt-1">{activeAmbiguousRow.description}</div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className="font-mono text-emerald-400">{activeAmbiguousRow.sourceWalletName}</span>
                  <TabularCurrency cents={activeAmbiguousRow.amountCents} size="sm" />
                </div>
              </div>

              <div className="text-xs font-semibold text-slate-300">Pilih Pasangan Rekanan:</div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {candidatePartners.map((cand) => (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => {
                      confirmTransferPair(activeAmbiguousRow.id, cand.id);
                      setAmbiguousRowId(null);
                    }}
                    className="w-full text-left artisan-card p-3 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all"
                  >
                    <div className="font-medium text-slate-100 text-xs line-clamp-1">{cand.description}</div>
                    <div className="flex items-center justify-between mt-1.5 text-xs">
                      <span className="font-mono text-indigo-300">{cand.sourceWalletName}</span>
                      <span className="font-mono text-slate-400 text-[10px]">{cand.time || cand.date}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
