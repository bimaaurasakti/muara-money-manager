const fs = require("fs");
const path = require("path");
const { createClient } = require("@libsql/client");
require("dotenv").config({ path: ".env.local" });

// Import the compiled/transpiled functions or mock parseBluCsv
function parseBluCsvLine(line) {
  // Simple CSV parser for the line
  const parts = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === "," && !inQ) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  parts.push(cur);
  return parts;
}

async function main() {
  const csvPath = "C:\\Users\\user\\Downloads\\Muara Money Manager\\Blu BCA - Augustus.csv";
  const csvContent = fs.readFileSync(csvPath, "utf8");
  const lines = csvContent.split(/\r?\n/);

  console.log("=== STEP 1: PARSING BLU BCA CSV ROW 7 ===");
  const row7 = lines[6]; // 0-indexed line 6 is line 7
  console.log("Raw row 7:", row7);
  const cols = parseBluCsvLine(row7);
  const rawDate = cols[0]; // 05/08/2026
  const [d, m, y] = rawDate.split("/");
  const isoDate = `${y}-${m}-${d}`;
  const nominal = Math.abs(parseFloat(cols[2].replace(/,/g, "")));
  const amountCents = Math.round(nominal * 100);
  const description = cols[1];

  const candidate = {
    id: "cand-blu-aug5",
    sourceWalletName: "Blu BCA (Baim)",
    amountCents,
    type: "INCOME",
    date: isoDate,
    time: null,
    description,
  };
  console.log("Parsed Candidate:", JSON.stringify(candidate, null, 2));

  console.log("\n=== STEP 2: QUERYING DB WITH NEW SYMMETRIC QUERY ===");
  const url = process.env.TURSO_DATABASE_URL || "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
  const client = createClient({ url, authToken });

  // Fetch accounts
  const accRes = await client.execute("SELECT id, name FROM accounts");
  const accountMap = new Map();
  const idToNameMap = new Map();
  accRes.rows.forEach((r) => {
    accountMap.set(r.name.toLowerCase(), r.id);
    idToNameMap.set(r.id, r.name);
  });

  const bluAccId = accountMap.get("blu bca (baim)");
  console.log("Blu BCA Account ID:", bluAccId);

  // New symmetric query (accountId OR targetAccountId)
  const query = `
    SELECT id, account_id, target_account_id, date, time, amount, type, description
    FROM transactions
    WHERE (account_id = ? OR target_account_id = ?)
      AND date >= '2026-08-01' AND date <= '2026-08-31'
  `;
  const dbTxsRes = await client.execute({ sql: query, args: [bluAccId, bluAccId] });
  console.log(`Fetched ${dbTxsRes.rows.length} reference transactions for Blu BCA (inbound & outbound)`);

  const matchingDbTx = dbTxsRes.rows.find((t) => t.date === "2026-08-05" && Number(t.amount) === amountCents);
  console.log("Found transfer in DB for 2026-08-05:", JSON.stringify(matchingDbTx, null, 2));

  console.log("\n=== STEP 3: TESTING TIER 3 CONTRA-LEG MATCH LOGIC ===");
  const { markDuplicateCandidates } = require("../src/lib/reconciliation/fingerprint");

  const existingTxs = dbTxsRes.rows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    targetAccountId: r.target_account_id,
    date: r.date,
    time: r.time,
    amount: Number(r.amount),
    type: r.type,
    description: r.description,
  }));

  const marked = markDuplicateCandidates([candidate], existingTxs, accountMap);
  console.log("RESULT OF markDuplicateCandidates:", JSON.stringify(marked, null, 2));

  if (marked[0].isDuplicate && marked[0].type === "TRANSFER") {
    console.log("\n SUCCESS: Transaction is now recognized as a duplicate of the existing Money Manager transfer!");
    console.log("Reason:", marked[0].duplicateReason);
  } else {
    console.log("\n FAILED: Transaction was not recognized.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error during verification:", err);
  process.exit(1);
});
