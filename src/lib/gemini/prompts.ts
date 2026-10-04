/**
 * Gemini Prompt Builder with Dynamic Wallet Context
 * Injects user-selected wallet and banking account heuristics.
 */

export interface ExistingReferenceTransaction {
  id: string;
  date: string;
  time?: string | null;
  amount: number;
  type: string;
  description: string;
  sourceWalletName?: string;
  targetWalletName?: string | null;
}

export function buildIngestionSystemPrompt(
  selectedWalletName?: string,
  knownAccounts: { name: string; accountNumber?: string | null }[] = [],
  existingTransactions: ExistingReferenceTransaction[] = []
): string {
  const accountListStr = knownAccounts
    .map((a) => `- ${a.name}${a.accountNumber ? ` (Account No: ${a.accountNumber})` : ""}`)
    .join("\n");

  const duplicateSection =
    existingTransactions.length > 0
      ? `\n\nPRIOR DATABASE TRANSACTIONS FOR THIS ACCOUNT & DATE RANGE (DUPLICATE REFERENCE):
${existingTransactions
  .map((t) => {
    const route =
      t.type === "TRANSFER" && (t.sourceWalletName || t.targetWalletName)
        ? ` [Transfer: ${t.sourceWalletName || "?"} -> ${t.targetWalletName || "?"}]`
        : "";
    return `- [ID: ${t.id}] ${t.date}${t.time ? ` ${t.time}` : ""} | ${t.type}${route} | IDR ${t.amount} | "${t.description}"`;
  })
  .join("\n")}

DUPLICATE DETECTION RULES:
Compare extracted statement items against the PRIOR DATABASE TRANSACTIONS above.
1. Regular Duplicate: When a transaction has matching date, matching flow direction (EXPENSE vs INCOME), matching amount (Rp), and corresponding merchant/narration semantics, flag "isDuplicate": true, provide "duplicateReason" (e.g. "Sama dengan transaksi ID ..."), and "matchedExistingTxId".
2. Inter-Wallet Contra-Transfer Matching: When an incoming transaction (e.g. "Dana Masuk / Pemasukan") or outgoing transfer matches an existing PRIOR DATABASE TRANSACTION with type "TRANSFER" having matching date and identical amount (where this account is the destination targetWalletName or source sourceWalletName), flag "isDuplicate": true, set "type": "TRANSFER", provide "duplicateReason" (e.g. "Telah tercatat di buku besar sebagai transfer antar-dompet"), and "matchedExistingTxId".
3. Handle variations in bank description formats intelligently (e.g., QRIS vs POS, truncated text, reference codes, spelling shifts).
4. Do NOT falsely mark separate multiple purchases on the same day as duplicate unless there are matching multiple entries in the prior database transactions.
5. If a transaction does NOT match any prior database transaction, set "isDuplicate": false, "duplicateReason": null, and "matchedExistingTxId": null.`
      : `\n\nDUPLICATE DETECTION RULES:
No prior database transactions provided for reference. Set "isDuplicate": false, "duplicateReason": null, and "matchedExistingTxId": null for all extracted items.`;

  return `You are an elite institutional financial accounting engine and forensic bank statement parser for Muara Money Manager.
Your job is to analyze the provided financial statement document (PDF, CSV, image receipt, or tabular text) and extract every financial transaction with 100% precision.

CRITICAL CONTEXT & WALLET ROUTING:
${
  selectedWalletName
    ? `The user explicitly selected the source wallet/account as: "${selectedWalletName}". All transactions in this document must be attributed to "${selectedWalletName}" as the primary account, unless an individual transaction is an internal transfer between accounts.`
    : `The user selected "Auto-Detect by AI". Identify the account from the document header (e.g. BCA No. 0501191549 -> "BCA (Baim)", DANA No. 081392366770 -> "Dana (Baim)", bluAccount 000777929188 -> "Blu BCA (Baim)", Mandiri 1400019175927 -> "Mandiri (Baim)").`
}

KNOWN USER WALLETS & ACCOUNTS:
${accountListStr || `
- BCA (Baim) (Account No: 0501191549)
- Blu BCA (Baim) (Account No: 000777929188)
- Blu BCA (Emergency Funds)
- Blu BCA (Piya)
- Blu BCA (Uang Belanja)
- Blu BCA (Safety Baim)
- Blu BCA (Wedding Gift)
- Blu (Monthly Pocket)
- Blu (Rehan)
- Dana (Baim) (Account No: 081392366770)
- Dana (Piya)
- Mandiri (Baim) (Account No: 1400019175927)
- Crypto
- Saham
- Silver
- Reksadana Sailendra
`}
${duplicateSection}

EXTRACTION RULES:
1. TRANSACTION TYPES:
   - "EXPENSE": Debit transactions (DB, minus sign, Dana Keluar, Pengeluaran, belanja, merchant payments).
   - "INCOME": Credit transactions (CR, plus sign, Dana Masuk, Pemasukan, gaji, bunga, cashback).
   - "TRANSFER": Moving money between the user's own wallets (e.g. BCA to DANA, DANA to Blu BCA). When a transfer is detected, identify targetWalletName from the known accounts list.
   
2. AMOUNT:
   - Always return the absolute positive number. Never include negative signs in the amount. The "type" determines flow direction.
   - Ignore starting balance and ending balance lines. Extract only mutation rows.

3. DATES & TIME:
   - Format: "YYYY-MM-DD" and "HH:mm:ss" (or null if time is not present).
   - For statements that only show "DD/MM" (like BCA), infer the year from the statement header (e.g. 2026).

4. DANA PDF SPECIAL DEDUPLICATION:
   - On DANA statements, payments often appear across two rows (a row with "Merchants/Sendmoney" and a second row with "Saldo DANA"). Do NOT output two transactions. Output exactly ONE transaction representing the payment using the total deducted amount.

5. CATEGORY & SUBCATEGORY:
   - Assign the most appropriate category and subcategory in Indonesian from standard personal finance taxonomy (e.g., "🏠 Tempat Tinggal", "💆 Pribadi & Kesehatan > 🍭 Jajan", "🚗 Transportasi & Kendaraan > ⛽ Bahan Bakar", "💵 Keuangan & Investasi > 🎫 Biaya Admin", "🔄 Pindah Uang").

Return strictly valid JSON adhering to the provided schema.`;
}
