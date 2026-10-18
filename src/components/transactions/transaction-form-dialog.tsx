"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTransactionAction,
  updateTransactionAction,
  TransactionMutationInput,
} from "@/actions/transaction-crud-actions";
import { computeTransactionFingerprint } from "@/lib/concurrency/transaction-fingerprint";
import { AlertCircle, RefreshCw, Clock, ArrowRightLeft, TrendingDown, TrendingUp } from "lucide-react";

export interface AccountOption {
  id: string;
  name: string;
}

export interface SubcategoryOption {
  id: string;
  name: string;
}

export interface CategoryOption {
  id: string;
  name: string;
  type: string; // 'EXPENSE' | 'INCOME' | 'BOTH'
  subcategories?: SubcategoryOption[];
}

export interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: any | null;
  accounts: AccountOption[];
  categories: CategoryOption[];
  onSuccess?: () => void;
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  mode,
  initialData,
  accounts,
  categories,
  onSuccess,
}: TransactionFormDialogProps) {
  const [type, setType] = React.useState<"EXPENSE" | "INCOME" | "TRANSFER">("EXPENSE");
  const [accountId, setAccountId] = React.useState<string>("");
  const [targetAccountId, setTargetAccountId] = React.useState<string>("");
  const [date, setDate] = React.useState<string>("");
  const [time, setTime] = React.useState<string>("");
  const [amountStr, setAmountStr] = React.useState<string>("");
  const [categoryId, setCategoryId] = React.useState<string>("");
  const [subcategoryId, setSubcategoryId] = React.useState<string>("");
  const [description, setDescription] = React.useState<string>("");
  const [note, setNote] = React.useState<string>("");

  const [currentFingerprint, setCurrentFingerprint] = React.useState<string>("");
  const [conflictState, setConflictState] = React.useState<{
    conflict: "MODIFIED" | "DELETED";
    message: string;
    freshTransaction?: any;
    freshFingerprint?: string;
  } | null>(null);

  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);

  // Helper to format current time HH:mm:ss
  const getCurrentTimeString = () => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, "0");
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const getTodayDateString = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  // Populate or reset form when dialog opens or initialData changes
  React.useEffect(() => {
    if (!open) {
      setConflictState(null);
      setErrorMessage("");
      return;
    }

    if (mode === "edit" && initialData) {
      setType(initialData.type || "EXPENSE");
      setAccountId(initialData.accountId || "");
      setTargetAccountId(initialData.targetAccountId || "");
      setDate(initialData.date || getTodayDateString());
      setTime(initialData.time || getCurrentTimeString());
      setAmountStr(initialData.amount ? String(Math.round(initialData.amount / 100)) : "");

      // Match category by ID or name
      const matchedCat = categories.find(
        (c) => c.id === initialData.categoryId || c.name === initialData.categoryName
      );
      setCategoryId(matchedCat?.id || initialData.categoryId || "");
      setSubcategoryId(initialData.subcategoryId || "");
      setDescription(initialData.description || "");
      setNote(initialData.note || "");

      const fp = computeTransactionFingerprint({
        accountId: initialData.accountId || "",
        targetAccountId: initialData.targetAccountId || null,
        categoryId: matchedCat?.id || initialData.categoryId || null,
        subcategoryId: initialData.subcategoryId || null,
        amount: initialData.amount || 0,
        type: initialData.type || "EXPENSE",
        date: initialData.date || "",
        time: initialData.time || null,
        description: initialData.description || "",
        note: initialData.note || null,
      });
      setCurrentFingerprint(fp);
    } else {
      // Create mode
      setType("EXPENSE");
      setAccountId(accounts[0]?.id || "");
      setTargetAccountId(accounts[1]?.id || "");
      setDate(getTodayDateString());
      setTime(getCurrentTimeString());
      setAmountStr("");
      setCategoryId("");
      setSubcategoryId("");
      setDescription("");
      setNote("");
      setCurrentFingerprint("");
    }
    setConflictState(null);
    setErrorMessage("");
  }, [open, mode, initialData, accounts, categories]);

  // Filter categories by type
  const availableCategories = React.useMemo(() => {
    if (type === "TRANSFER") {
      return categories.filter((c) => c.name === "🔄 Pindah Uang");
    }
    return categories.filter((c) => c.type === type || c.type === "BOTH");
  }, [type, categories]);

  // Available subcategories for selected category
  const selectedCategoryObj = categories.find((c) => c.id === categoryId);
  const availableSubcategories = selectedCategoryObj?.subcategories || [];

  // Auto set category when type changes
  const handleTypeChange = (newType: "EXPENSE" | "INCOME" | "TRANSFER") => {
    setType(newType);
    if (newType === "TRANSFER") {
      const transferCat = categories.find((c) => c.name === "🔄 Pindah Uang");
      if (transferCat) setCategoryId(transferCat.id);
    } else {
      if (categoryId && categories.find((c) => c.id === categoryId)?.name === "🔄 Pindah Uang") {
        setCategoryId("");
      }
    }
  };

  const handleApplyFreshData = () => {
    if (!conflictState?.freshTransaction) return;
    const fresh = conflictState.freshTransaction;
    setType(fresh.type || "EXPENSE");
    setAccountId(fresh.accountId || "");
    setTargetAccountId(fresh.targetAccountId || "");
    setDate(fresh.date || getTodayDateString());
    setTime(fresh.time || getCurrentTimeString());
    setAmountStr(fresh.amount ? String(Math.round(fresh.amount / 100)) : "");

    const matchedCat = categories.find(
      (c) => c.id === fresh.categoryId || c.name === fresh.categoryName
    );
    setCategoryId(matchedCat?.id || fresh.categoryId || "");
    setSubcategoryId(fresh.subcategoryId || "");
    setDescription(fresh.description || "");
    setNote(fresh.note || "");

    if (conflictState.freshFingerprint) {
      setCurrentFingerprint(conflictState.freshFingerprint);
    }
    setConflictState(null);
    setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setConflictState(null);

    const cleanAmount = parseInt(amountStr.replace(/[^0-9]/g, ""), 10);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      setErrorMessage("Nominal transaksi harus lebih dari Rp 0.");
      return;
    }

    if (!accountId) {
      setErrorMessage("Rekening sumber wajib dipilih.");
      return;
    }

    if (type === "TRANSFER" && !targetAccountId) {
      setErrorMessage("Rekening tujuan transfer wajib dipilih.");
      return;
    }

    if (type === "TRANSFER" && accountId === targetAccountId) {
      setErrorMessage("Rekening sumber dan tujuan transfer tidak boleh sama.");
      return;
    }

    if (!date) {
      setErrorMessage("Tanggal transaksi wajib diisi.");
      return;
    }

    if (!description.trim()) {
      setErrorMessage("Keterangan transaksi wajib diisi.");
      return;
    }

    setIsSubmitting(true);

    const payload: TransactionMutationInput = {
      accountId,
      targetAccountId: type === "TRANSFER" ? targetAccountId : null,
      categoryId: categoryId || null,
      subcategoryId: subcategoryId || null,
      amount: cleanAmount * 100, // convert to cents
      type,
      date,
      time: time?.trim() || "00:00:00",
      description: description.trim(),
      note: note.trim() || null,
    };

    try {
      if (mode === "create") {
        const res = await createTransactionAction(payload);
        if (!res.success) {
          setErrorMessage(res.message);
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await updateTransactionAction(initialData.id, currentFingerprint, payload);
        if (!res.success) {
          if (res.conflict) {
            setConflictState({
              conflict: res.conflict,
              message: res.message,
              freshTransaction: res.freshTransaction,
              freshFingerprint: res.freshFingerprint,
            });
            setIsSubmitting(false);
            return;
          }
          setErrorMessage(res.message);
          setIsSubmitting(false);
          return;
        }
      }

      setIsSubmitting(false);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || "Terjadi kesalahan sistem saat menyimpan mutasi.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            {mode === "create" ? "Tambah Transaksi Baru" : "Edit Mutasi Transaksi"}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            {mode === "create"
              ? "Catat mutasi manual, transfer antar rekening, atau penyesuaian saldo."
              : "Perbarui informasi transaksi dengan proteksi anti-tabrakan data."}
          </DialogDescription>
        </DialogHeader>

        {/* OCC Conflict Warning Banner */}
        {conflictState && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">{conflictState.message}</p>
                {conflictState.conflict === "MODIFIED" && (
                  <p className="text-[11px] text-amber-300/80 mt-0.5">
                    Perubahan Anda belum disimpan agar tidak menimpa data yang baru saja diperbarui.
                  </p>
                )}
              </div>
            </div>
            {conflictState.conflict === "MODIFIED" && conflictState.freshTransaction && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleApplyFreshData}
                className="w-full border-amber-500/40 text-amber-200 hover:bg-amber-500/20 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Muat Data Terbaru
              </Button>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Type Segmented Control */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => handleTypeChange("EXPENSE")}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                type === "EXPENSE"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-950/50"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("INCOME")}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                type === "INCOME"
                  ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-950/50"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Pemasukan
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange("TRANSFER")}
              className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                type === "TRANSFER"
                  ? "bg-sky-500 text-white shadow-md shadow-sky-950/50"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Pindah Uang
            </button>
          </div>

          {/* Wallet Accounts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="accountId" className="block text-[11px] font-semibold text-slate-300 mb-1">
                Rekening Sumber <span className="text-rose-400">*</span>
              </label>
              <select
                id="accountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                required
              >
                <option value="" disabled>Pilih Rekening</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            {type === "TRANSFER" && (
              <div>
                <label htmlFor="targetAccountId" className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Rekening Tujuan <span className="text-rose-400">*</span>
                </label>
                <select
                  id="targetAccountId"
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                  required
                >
                  <option value="" disabled>Pilih Rekening Tujuan</option>
                  {accounts
                    .filter((acc) => acc.id !== accountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Date & Precise Time (HH:mm:ss) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="date" className="block text-[11px] font-semibold text-slate-300 mb-1">
                Tanggal <span className="text-rose-400">*</span>
              </label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-slate-900 border-white/15 text-xs text-white"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="time" className="block text-[11px] font-semibold text-slate-300">
                  Jam, Menit, Detik <span className="text-slate-500 font-mono text-[10px]">(HH:mm:ss)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setTime(getCurrentTimeString())}
                  className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Clock className="w-3 h-3" /> Sekarang
                </button>
              </div>
              <Input
                id="time"
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="14:30:00"
                className="bg-slate-900 border-white/15 text-xs font-mono text-white"
              />
            </div>
          </div>

          {/* Amount (Nominal) */}
          <div>
            <label htmlFor="amount" className="block text-[11px] font-semibold text-slate-300 mb-1">
              Nominal (Rupiah) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
              <Input
                id="amount"
                type="text"
                value={amountStr ? Number(amountStr).toLocaleString("id-ID") : ""}
                onChange={(e) => setAmountStr(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="50.000"
                className="pl-9 bg-slate-900 border-white/15 text-sm font-bold font-mono text-white"
                required
              />
            </div>
          </div>

          {/* Category & Subcategory */}
          {type !== "TRANSFER" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="categoryId" className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Kategori
                </label>
                <select
                  id="categoryId"
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategoryId("");
                  }}
                  className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">Tanpa Kategori</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="subcategoryId" className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Subkategori
                </label>
                <select
                  id="subcategoryId"
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  disabled={availableSubcategories.length === 0}
                  className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
                >
                  <option value="">Pilih Subkategori (Opsional)</option>
                  {availableSubcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Description & Note */}
          <div>
            <label htmlFor="description" className="block text-[11px] font-semibold text-slate-300 mb-1">
              Keterangan / Merchant <span className="text-rose-400">*</span>
            </label>
            <Input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Beli Kopi, Makan Siang, atau Penyesuaian Saldo"
              className="bg-slate-900 border-white/15 text-xs text-white"
              required
            />
          </div>

          <div>
            <label htmlFor="note" className="block text-[11px] font-semibold text-slate-300 mb-1">
              Catatan Tambahan (Opsional)
            </label>
            <Input
              id="note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Jajan bersama teman"
              className="bg-slate-900 border-white/15 text-xs text-white"
            />
          </div>

          <DialogFooter className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="border-white/10 text-slate-300 hover:text-white"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
            >
              {isSubmitting
                ? "Menyimpan..."
                : mode === "create"
                ? "Simpan Transaksi"
                : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
