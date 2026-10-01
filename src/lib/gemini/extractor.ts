import { GoogleGenAI, Type } from "@google/genai";
import { buildIngestionSystemPrompt, ExistingReferenceTransaction } from "./prompts";
import { deduplicateDanaTransactions } from "../parser/file-preprocessor";
import { toCents } from "../money";

export interface ExtractedTransaction {
  date: string; // YYYY-MM-DD
  time: string | null;
  description: string;
  note: string | null;
  amount: number; // floating Rupiah
  amountCents: number; // integer cents
  type: "EXPENSE" | "INCOME" | "TRANSFER";
  category: string;
  subcategory: string | null;
  sourceWalletName: string;
  targetWalletName: string | null;
  confidence: number;
  isDuplicate?: boolean;
  duplicateReason?: string | null;
  matchedExistingTxId?: string | null;
}

export interface ExtractionResult {
  detectedAccountName: string;
  statementPeriod: string;
  transactions: ExtractedTransaction[];
}

export const transactionSchema = {
  type: Type.OBJECT,
  properties: {
    detectedAccountName: {
      type: Type.STRING,
      description: "Name of the detected bank or wallet account from document headers.",
    },
    statementPeriod: {
      type: Type.STRING,
      description: "Statement period if available, e.g., 'Agustus 2026'.",
    },
    transactions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "Date in YYYY-MM-DD format." },
          time: { type: Type.STRING, description: "Time in HH:mm:ss format if available." },
          description: { type: Type.STRING, description: "Merchant, store, or transaction description." },
          note: { type: Type.STRING, description: "Additional notes or purpose." },
          amount: { type: Type.NUMBER, description: "Absolute transaction amount in IDR (always positive number)." },
          type: {
            type: Type.STRING,
            enum: ["EXPENSE", "INCOME", "TRANSFER"],
            description: "Transaction flow type.",
          },
          category: { type: Type.STRING, description: "Category name." },
          subcategory: { type: Type.STRING, description: "Subcategory name." },
          targetWalletName: {
            type: Type.STRING,
            description: "Destination wallet name if type is TRANSFER.",
          },
          confidence: {
            type: Type.INTEGER,
            description: "Extraction confidence score between 0 and 100.",
          },
          isDuplicate: {
            type: Type.BOOLEAN,
            description: "True if this transaction matches an existing transaction from the database reference history.",
          },
          duplicateReason: {
            type: Type.STRING,
            description: "Reason or explanation why this transaction is considered a duplicate.",
          },
          matchedExistingTxId: {
            type: Type.STRING,
            description: "ID of the matched existing database transaction.",
          },
        },
        required: ["date", "description", "amount", "type", "category"],
      },
    },
  },
  required: ["transactions"],
};

/**
 * Extracts financial transactions using Google Gemini 2.5 Flash with structured JSON output.
 */
export async function extractTransactionsWithGemini(params: {
  contents: any[]; // inlineData parts or text strings
  selectedWalletName?: string;
  knownAccounts?: { name: string; accountNumber?: string | null }[];
  existingTransactions?: ExistingReferenceTransaction[];
}): Promise<ExtractionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const fallbackEnv = process.env.GEMINI_FALLBACK_MODELS
    ? process.env.GEMINI_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean)
    : [
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-flash-latest",
      ];

  // Deduplicate and maintain priority order
  const candidateModels = Array.from(new Set([primaryModel, ...fallbackEnv]));

  const systemPrompt = buildIngestionSystemPrompt(
    params.selectedWalletName,
    params.knownAccounts,
    params.existingTransactions
  );

  let lastError: any = null;

  for (let mIdx = 0; mIdx < candidateModels.length; mIdx++) {
    const currentModel = candidateModels[mIdx];
    let modelAttempts = 0;
    const maxModelAttempts = 2;

    while (modelAttempts < maxModelAttempts) {
      modelAttempts++;
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: [
            { role: "user", parts: [{ text: systemPrompt }, ...params.contents] },
          ],
          config: {
            temperature: 0,
            responseMimeType: "application/json",
            responseJsonSchema: transactionSchema,
          },
        });

        const responseText = response.text || "{}";
        const parsed = JSON.parse(responseText);

        const detectedAccountName =
          params.selectedWalletName || parsed.detectedAccountName || "Unknown Account";
        const statementPeriod = parsed.statementPeriod || "";

        const rawTxs = Array.isArray(parsed.transactions) ? parsed.transactions : [];

        const transactions: ExtractedTransaction[] = rawTxs.map((t: any) => {
          const rawTime = typeof t.time === "string" ? t.time.trim() : null;
          const cleanTime =
            !rawTime ||
            rawTime === "null" ||
            rawTime === "undefined" ||
            rawTime === "00:00:00" ||
            rawTime === "00:00"
              ? null
              : rawTime;

          return {
            date: t.date || new Date().toISOString().split("T")[0],
            time: cleanTime,
            description: t.description || "Transaksi Tanpa Judul",
            note: t.note || null,
            amount: Math.abs(Number(t.amount) || 0),
            amountCents: toCents(Math.abs(Number(t.amount) || 0)),
            type: (t.type as any) || "EXPENSE",
            category: t.category || "⚠️ Tidak Terduga",
            subcategory: t.subcategory || null,
            sourceWalletName: detectedAccountName,
            targetWalletName: t.targetWalletName || null,
            confidence: typeof t.confidence === "number" ? t.confidence : 95,
            isDuplicate: Boolean(t.isDuplicate),
            duplicateReason: t.duplicateReason || null,
            matchedExistingTxId: t.matchedExistingTxId || null,
          };
        });

        // Apply server-level deduplication for DANA split payments
        const deduplicated = deduplicateDanaTransactions(transactions);

        return {
          detectedAccountName,
          statementPeriod,
          transactions: deduplicated,
        };
      } catch (error: any) {
        lastError = error;

        const is503HighDemand =
          error?.status === 503 ||
          error?.code === 503 ||
          error?.message?.includes("503") ||
          error?.message?.includes("high demand") ||
          error?.message?.includes("UNAVAILABLE");

        const is404NotFound =
          error?.status === 404 ||
          error?.code === 404 ||
          error?.message?.includes("404") ||
          error?.message?.includes("not found");

        const is429RateLimit =
          error?.status === 429 ||
          error?.code === 429 ||
          error?.message?.includes("429") ||
          error?.message?.includes("RESOURCE_EXHAUSTED");

        const isQuotaLimitZero =
          is429RateLimit &&
          (error?.message?.includes("limit: 0") ||
            error?.message?.includes("Quota exceeded for metric"));

        if (is503HighDemand || is404NotFound || isQuotaLimitZero) {
          const nextModel = candidateModels[mIdx + 1];
          const reason = is503HighDemand
            ? "503 High Demand"
            : is404NotFound
            ? "404 Not Found"
            : "429 Quota Limit 0 (Model Unsupported / No Free Quota)";
          if (nextModel) {
            console.warn(
              `[Gemini Extractor] Model "${currentModel}" unavailable (${reason}). Switching immediately to fallback model: "${nextModel}"`
            );
          }
          // Break inner loop to immediately jump to next candidate model
          break;
        } else if (is429RateLimit) {
          if (modelAttempts < maxModelAttempts) {
            const delayMs = Math.pow(2, modelAttempts) * 1000;
            await new Promise((res) => setTimeout(res, delayMs));
          } else {
            const nextModel = candidateModels[mIdx + 1];
            if (nextModel) {
              console.warn(
                `[Gemini Extractor] Model "${currentModel}" rate limited (429). Switching to fallback model: "${nextModel}"`
              );
            }
            break;
          }
        } else {
          // Other unexpected error (e.g. schema error)
          const nextModel = candidateModels[mIdx + 1];
          if (nextModel) {
            console.warn(
              `[Gemini Extractor] Error pada "${currentModel}": ${error?.message || error}. Mencoba fallback: "${nextModel}"`
            );
            break;
          }
          throw error;
        }
      }
    }
  }

  throw (
    lastError ||
    new Error("Semua model Gemini dalam urutan kaskade gagal mengekstrak dokumen.")
  );
}
