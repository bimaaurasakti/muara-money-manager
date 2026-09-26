import { parseMoneyManagerExcel } from "../src/lib/migration/money-manager-importer";
import path from "path";
import fs from "fs";

async function run() {
  console.log("==================================================");
  console.log("🔍 RUNNING AUTOMATED VERIFICATION: FINAL PARITY");
  console.log("==================================================");

  let filePath = "C:\\Users\\user\\Downloads\\MONEY MANAGER.xlsx";
  if (!fs.existsSync(filePath)) {
    filePath = path.resolve(process.cwd(), "data-example/Money Manager - Excel.xlsx");
  }
  console.log(`Using file: ${filePath}`);

  const buffer = fs.readFileSync(filePath);
  const result = await parseMoneyManagerExcel(buffer);

  console.log(`\nParsed total transactions: ${result.totalRows}`);
  console.log(`Summary:`, result.summary);

  // Check Saham on 23 May 2026
  const sahamTx = result.transactions.filter(
    (t) => t.sourceAccountName === "Saham" && t.date.includes("2026-05-23")
  );
  console.log("\nSaham transactions on 2026-05-23:");
  for (const t of sahamTx) {
    console.log(`  - Type: ${t.type}, Amount: Rp ${(t.amountCents / 100).toLocaleString("id-ID")}, Category: ${t.categoryName}, Desc: ${t.description}`);
    if (t.isModifiedBalance) {
      if (t.type === "EXPENSE" && t.amountCents === 23847400) {
        console.log("  ✅ PASS: Saham 23 May 2026 difference is properly classified as EXPENSE (Rp 238.474,00)");
      } else {
        console.error("  ❌ FAIL: Saham 23 May 2026 is NOT EXPENSE or amount incorrect!");
        process.exit(1);
      }
    }
  }

  // Calculate balances per account
  const balances: Record<string, number> = {};

  // Initial balance for Blu (Monthly Pocket)
  balances["Blu (Monthly Pocket)"] = 52299939;

  for (const t of result.transactions) {
    if (!balances[t.sourceAccountName]) {
      balances[t.sourceAccountName] = 0;
    }

    if (t.type === "INCOME") {
      balances[t.sourceAccountName] += t.amountCents;
    } else if (t.type === "EXPENSE") {
      balances[t.sourceAccountName] -= t.amountCents;
    } else if (t.type === "TRANSFER") {
      balances[t.sourceAccountName] -= t.amountCents;
      if (t.targetAccountName) {
        if (!balances[t.targetAccountName]) {
          balances[t.targetAccountName] = 0;
        }
        balances[t.targetAccountName] += t.amountCents;
      }
    }
  }

  console.log("\n================ ACCOUNT BALANCES ================");
  let assetsCents = 0;
  let liabilitiesCents = 0;

  const sortedAccounts = Object.keys(balances).sort();
  for (const acc of sortedAccounts) {
    const balCents = balances[acc];
    const balRp = balCents / 100;
    console.log(`${acc.padEnd(28)}: Rp ${balRp.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    if (balCents > 0) {
      assetsCents += balCents;
    } else {
      liabilitiesCents += Math.abs(balCents);
    }
  }

  const netCents = assetsCents - liabilitiesCents;

  const assetsRp = assetsCents / 100;
  const liabilitiesRp = liabilitiesCents / 100;
  const netRp = netCents / 100;

  console.log("\n================ FINANCIAL METRICS ================");
  console.log(`Assets (Saldo Positif)    : Rp ${assetsRp.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Liabilities (Saldo Minus) : Rp ${liabilitiesRp.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Total (Net Worth)         : Rp ${netRp.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

  // Assertions
  const TARGET_ASSETS = 120240658.02;
  const TARGET_LIABILITIES = 17305475.00;
  const TARGET_TOTAL = 102935183.02;

  const diffAssets = Math.abs(assetsRp - TARGET_ASSETS);
  const diffLiab = Math.abs(liabilitiesRp - TARGET_LIABILITIES);
  const diffTotal = Math.abs(netRp - TARGET_TOTAL);

  console.log("\n================ PARITY CHECK ================");
  console.log(`Target Assets      : 120.240.658,02 | Actual: ${assetsRp.toFixed(2)} | Diff: ${diffAssets.toFixed(4)}`);
  console.log(`Target Liabilities :  17.305.475,00 | Actual: ${liabilitiesRp.toFixed(2)} | Diff: ${diffLiab.toFixed(4)}`);
  console.log(`Target Total       : 102.935.183,02 | Actual: ${netRp.toFixed(2)} | Diff: ${diffTotal.toFixed(4)}`);

  if (diffAssets < 0.01 && diffLiab < 0.01 && diffTotal < 0.01) {
    console.log("\n🎉 ALL TESTS PASSED! 100.00% EXACT PARITY ACHIEVED!");
  } else {
    console.error("\n❌ DISCREPANCY DETECTED!");
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
