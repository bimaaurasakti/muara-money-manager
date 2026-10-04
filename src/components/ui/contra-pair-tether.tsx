import * as React from "react";
import { ArrowRightLeft, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContraPairTetherProps {
  pairId?: string | null;
  targetWalletName?: string | null;
  confidence?: "HIGH" | "AMBIGUOUS" | "NONE";
  candidateCount?: number;
  onUnpair?: () => void;
  onSelectCandidate?: () => void;
  className?: string;
}

export function ContraPairTether({
  pairId,
  targetWalletName,
  confidence = "HIGH",
  candidateCount = 0,
  onUnpair,
  onSelectCandidate,
  className,
}: ContraPairTetherProps) {
  if (!pairId && confidence !== "AMBIGUOUS") {
    return null;
  }

  if (confidence === "AMBIGUOUS") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono backdrop-blur-md cursor-pointer hover:bg-amber-500/20 transition-all",
          className
        )}
        onClick={onSelectCandidate}
        title="Ditemukan lebih dari 1 kandidat transfer berlawanan. Klik untuk memilih pasangan."
      >
        <AlertCircle className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
        <span className="font-semibold">⚠️ {candidateCount} Rekanan Ditemukan</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono backdrop-blur-md group hover:border-indigo-400/50 transition-all max-w-full",
        className
      )}
      title={`Terhubung dengan transfer internal ke ${targetWalletName || "Akun Lain"}`}
    >
      <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-180 transition-transform duration-300 shrink-0" />
      <span className="font-medium truncate max-w-[200px]">
        Pindah Uang ➔ <span className="font-bold text-white">{targetWalletName || "Akun Tujuan"}</span>
      </span>
      {onUnpair && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUnpair();
          }}
          className="ml-1 p-0.5 rounded text-indigo-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
          title="Batalkan pasangan transfer (jadikan pengeluaran biasa)"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
