"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandMenu } from "./command-menu";
import { Button } from "@/components/ui/button";
import { UploadCloud, Calendar } from "lucide-react";

export function TopBar() {
  const pathname = usePathname();

  const getPageTitle = () => {
    if (pathname === "/") return "Executive Overview";
    if (pathname.startsWith("/monthly")) return "Multi-Dimensional Monthly Analytics";
    if (pathname.startsWith("/import")) return "Smart Ingestion Engine";
    if (pathname.startsWith("/accounts")) return "Account Portfolios";
    if (pathname.startsWith("/transactions")) return "General Ledger";
    return "Muara Financial OS";
  };

  return (
    <header className="h-16 sticky top-0 z-30 bg-[#030712]/80 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
          {getPageTitle()}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <CommandMenu />

        <Link href="/import">
          <Button size="sm" className="h-8 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/20">
            <UploadCloud className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Unggah Dokumen</span>
          </Button>
        </Link>
      </div>
    </header>
  );
}
