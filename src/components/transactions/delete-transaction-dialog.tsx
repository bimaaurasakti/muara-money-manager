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
import { deleteTransactionAction } from "@/actions/transaction-crud-actions";
import { computeTransactionFingerprint } from "@/lib/concurrency/transaction-fingerprint";
import { AlertTriangle, Trash2, AlertCircle } from "lucide-react";

export interface DeleteTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any | null;
  onSuccess?: () => void;
}

export function DeleteTransactionDialog({
  open,
  onOpenChange,
  transaction,
  onSuccess,
}: DeleteTransactionDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState("");

  React.useEffect(() => {
    if (!open) setErrorMessage("");
  }, [open]);

  if (!transaction) return null;

  const fingerprint = computeTransactionFingerprint({
    accountId: transaction.accountId || "",
    targetAccountId: transaction.targetAccountId || null,
    categoryId: transaction.categoryId || null,
    subcategoryId: transaction.subcategoryId || null,
    amount: transaction.amount || 0,
    type: transaction.type || "EXPENSE",
    date: transaction.date || "",
    time: transaction.time || null,
    description: transaction.description || "",
    note: transaction.note || null,
  });

  const handleDelete = async () => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const res = await deleteTransactionAction(transaction.id, fingerprint);
      if (!res.success) {
        setErrorMessage(res.message);
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err?.message || "Terjadi kesalahan saat menghapus transaksi.");
    }
  };

  const formattedAmount = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Math.round((transaction.amount || 0) / 100));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-2">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-bold text-white">
            Hapus Transaksi Ini?
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-xs">
            Tindakan ini akan menghapus riwayat mutasi dari buku besar dan mengembalikan saldo rekening terkait secara otomatis.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-3.5 rounded-xl border border-white/10 bg-slate-900/60 space-y-2 text-xs">
          <div className="flex justify-between items-center text-slate-400">
            <span>Tanggal &amp; Waktu:</span>
            <span className="font-mono text-white">
              {transaction.date} {transaction.time || ""}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Keterangan:</span>
            <span className="font-bold text-white max-w-[200px] truncate" title={transaction.description}>
              {transaction.description}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Rekening:</span>
            <span className="text-white">
              {transaction.accountName || "Rekening"}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-white/10">
            <span>Nominal:</span>
            <span className="font-bold font-mono text-sm text-rose-400">
              {formattedAmount}
            </span>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end gap-2 pt-2">
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
            type="button"
            size="sm"
            disabled={isSubmitting}
            onClick={handleDelete}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {isSubmitting ? "Menghapus..." : "Hapus Mutasi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
