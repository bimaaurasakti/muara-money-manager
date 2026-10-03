const { createClient } = require("@libsql/client");
require("dotenv").config({ path: ".env.local" });

async function main() {
  const url = process.env.TURSO_DATABASE_URL || "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
  console.log("Connecting to:", url);

  const client = createClient({ url, authToken });

  const res = await client.execute({
    sql: "SELECT id, date, time, account_id, target_account_id, amount, type, description, note FROM transactions WHERE date = '2026-08-05' AND (amount = 3277100 OR amount = 32771)",
    args: []
  });

  console.log("Found rows:", JSON.stringify(res.rows, null, 2));

  const accountsRes = await client.execute({
    sql: "SELECT id, name FROM accounts",
    args: []
  });
  console.log("Accounts:", JSON.stringify(accountsRes.rows, null, 2));
}

main().catch(console.error);
