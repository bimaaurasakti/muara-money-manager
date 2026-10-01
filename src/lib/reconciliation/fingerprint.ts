import { CandidateTransaction } from "./transfer-detector";

/**
 * Sanitizes time string, handling "null", "undefined", "00:00:00", etc.
 */
export function sanitizeTimeString(time?: string | null): string {
  if (!time) return "";
  const t = time.trim();
  if (t === "null" || t === "undefined" || t === "00:00:00" || t === "00:00") {
    return "";
  }
  return t;
}

/**
 * Aggressively normalizes banking transaction descriptions:
 * 1. Removes 16-digit debit/credit card numbers.
 * 2. Removes BCA FT transaction reference codes (e.g. 2408/FTSCY/WS95011).
 * 3. Removes date prefixes and workstation IDs (e.g. 3108/ and /WS95051).
 * 4. Removes virtual account routing prefixes (e.g. 72345/ or 70001/).
 * 5. Removes standard banking channel prefixes (TRSF E-BANKING CR/DB, KARTU DEBIT).
 * 6. Strips punctuation and collapses whitespaces.
 */
export function normalizeDescription(rawDesc: string): string {
  if (!rawDesc) return "";

  let s = rawDesc.trim();

  // 1. Remove 16-digit card numbers (e.g. 6019005055989045 or 6019 0050 5598 9045)
  s = s.replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, " ");

  // 2. Remove BCA FT sequence/terminal codes (e.g. 2408/FTSCY/WS95011, 0208/FTSCY/WS95271, 2608/FTFVA/WS95271)
  s = s.replace(/\b\d{4}\/FT[A-Z0-9_-]+\/WS\d+\b/gi, " ");

  // 3. Remove date prefix (e.g. 3108/) and workstation suffix (e.g. /WS95051)
  s = s.replace(/\b\d{4}\//g, " ");
  s = s.replace(/\/WS\d+\b/gi, " ");

  // 4. Remove virtual account prefixes (e.g. 72345/ or 70001/)
  s = s.replace(/\b\d{4,6}\//g, " ");

  // 5. Remove standard banking channel prefixes
  s = s.replace(/\bTRSF\s+E[- ]?BANKING\s+(CR|DB)\b/gi, " ");
  s = s.replace(/\bKARTU\s+DEBIT\b/gi, " ");
  s = s.replace(/\bSWITCHING\s+(CR|DB)\b/gi, " ");

  // 6. Clean punctuation & normalize spacing
  s = s
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Fallback if regex stripped everything
  return s || rawDesc.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Determines net cash flow direction (INFLOW vs OUTFLOW).
 * Unifies differences between TRANSFER and INCOME on inward mutations.
 */
export function getFlowDirection(type: string, description: string = ""): "INFLOW" | "OUTFLOW" {
  const upperType = (type || "").toUpperCase();
  if (upperType === "INCOME") return "INFLOW";
  if (upperType === "EXPENSE") return "OUTFLOW";

  // For TRANSFER: inspect banking indicator
  const desc = (description || "").toUpperCase();
  if (desc.includes(" CR") || desc.includes("DANA MASUK") || desc.includes("TRANSFER MASUK") || desc.includes("DARI ")) {
    return "INFLOW";
  }
  if (desc.includes(" DB") || desc.includes("DANA KELUAR") || desc.includes("TRANSFER KELUAR") || desc.includes("KE ")) {
    return "OUTFLOW";
  }

  return "OUTFLOW";
}

export interface TransactionFingerprintParams {
  accountId: string;
  date: string;
  amountCents: number;
  type: string;
  description: string;
  time?: string | null;
}

/**
 * Builds a deterministic fingerprint key for a transaction based on
 * Account + Date + Amount + Cash Flow Direction + Normalized Description (+ Specific Time if available).
 */
export function buildTransactionFingerprint(params: TransactionFingerprintParams): string {
  const normDesc = normalizeDescription(params.description);
  const time = sanitizeTimeString(params.time);
  const direction = getFlowDirection(params.type, params.description);

  if (time) {
    return `${params.accountId}|${params.date}|${params.amountCents}|${direction}|${time}|${normDesc}`;
  }

  return `${params.accountId}|${params.date}|${params.amountCents}|${direction}|${normDesc}`;
}

export interface ExistingDbTransaction {
  accountId: string;
  date: string;
  amount: number;
  type: string;
  description: string;
  time?: string | null;
}

/**
 * Computes token similarity between two normalized descriptions.
 */
function computeDescriptionSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;

  const tokensA = new Set(a.split(/\s+/).filter((t) => t.length > 1));
  const tokensB = new Set(b.split(/\s+/).filter((t) => t.length > 1));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let common = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) common++;
  }

  const minTokens = Math.min(tokensA.size, tokensB.size);
  return minTokens > 0 ? common / minTokens : 0;
}

/**
 * Frequency-aware 2-tier duplicate marker:
 * Tier 1: Exact composite fingerprint match.
 * Tier 2: Core similarity fallback (Account + Date + Amount + Direction with >= 60% token overlap).
 */
export function markDuplicateCandidates(
  candidates: CandidateTransaction[],
  existingTxs: ExistingDbTransaction[],
  walletNameToIdMap: Map<string, string>
): CandidateTransaction[] {
  // Pool of available existing DB transactions for matching
  const availableDbTxs: (ExistingDbTransaction & {
    key: string;
    normDesc: string;
    direction: "INFLOW" | "OUTFLOW";
    matched: boolean;
  })[] = existingTxs.map((dbTx) => {
    const key = buildTransactionFingerprint({
      accountId: dbTx.accountId,
      date: dbTx.date,
      amountCents: dbTx.amount,
      type: dbTx.type,
      description: dbTx.description,
      time: dbTx.time,
    });
    return {
      ...dbTx,
      key,
      normDesc: normalizeDescription(dbTx.description),
      direction: getFlowDirection(dbTx.type, dbTx.description),
      matched: false,
    };
  });

  return candidates.map((candidate) => {
    const accountId = walletNameToIdMap.get(candidate.sourceWalletName.toLowerCase()) || "";
    const candNormDesc = normalizeDescription(candidate.description);
    const candDirection = getFlowDirection(candidate.type, candidate.description);
    const candTime = sanitizeTimeString(candidate.time);

    const candKey = buildTransactionFingerprint({
      accountId,
      date: candidate.date,
      amountCents: candidate.amountCents,
      type: candidate.type,
      description: candidate.description,
      time: candidate.time,
    });

    // Tier 1: Exact Key Match
    const exactMatch = availableDbTxs.find((d) => !d.matched && d.key === candKey);
    if (exactMatch) {
      exactMatch.matched = true;
      return {
        ...candidate,
        isDuplicate: true,
        duplicateReason: "Mutasi identik sudah tercatat di buku besar database (Exact Fingerprint Match).",
      };
    }

    // Tier 2: Fuzzy / Core Similarity Match
    // (Same Account + Date + Amount + Cash Flow Direction, plus Description Similarity >= 0.6)
    const fuzzyMatch = availableDbTxs.find((d) => {
      if (d.matched) return false;
      if (d.accountId !== accountId) return false;
      if (d.date !== candidate.date) return false;
      if (d.amount !== candidate.amountCents) return false;
      if (d.direction !== candDirection) return false;

      // If both have specific timestamps, they must match
      const dTime = sanitizeTimeString(d.time);
      if (candTime && dTime && candTime !== dTime) return false;

      // Check description similarity
      const sim = computeDescriptionSimilarity(candNormDesc, d.normDesc);
      return sim >= 0.6;
    });

    if (fuzzyMatch) {
      fuzzyMatch.matched = true;
      return {
        ...candidate,
        isDuplicate: true,
        duplicateReason: "Mutasi identik sudah tercatat di buku besar database (Smart Core Similarity Match).",
      };
    }

    if (candidate.isDuplicate) {
      return {
        ...candidate,
        isDuplicate: true,
        duplicateReason: candidate.duplicateReason || "Duplikat semantik terdeteksi oleh AI.",
      };
    }

    return {
      ...candidate,
      isDuplicate: false,
    };
  });
}
