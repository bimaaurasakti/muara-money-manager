import { db } from "@/db";
import { transactions, accounts, categories } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { TransactionsClient } from "@/components/transactions/transactions-client";

export const dynamic = "force-dynamic";

interface TransactionsPageProps {
  searchParams?: Promise<{
    wallet?: string;
  }>;
}

export default async function TransactionsPage(props?: TransactionsPageProps) {
  const resolvedParams = props?.searchParams ? await props.searchParams : undefined;
  const initialWallet = resolvedParams?.wallet;

  const targetAccounts = alias(accounts, "target_accounts");

  const [txList, allAccounts] = await Promise.all([
    db
      .select({
        id: transactions.id,
        date: transactions.date,
        time: transactions.time,
        amount: transactions.amount,
        type: transactions.type,
        description: transactions.description,
        note: transactions.note,
        sourceType: transactions.sourceType,
        transferPairId: transactions.transferPairId,
        accountId: transactions.accountId,
        accountName: accounts.name,
        targetAccountId: transactions.targetAccountId,
        targetAccountName: targetAccounts.name,
        categoryName: categories.name,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(targetAccounts, eq(transactions.targetAccountId, targetAccounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .orderBy(desc(transactions.date), desc(transactions.time)),
    db.select().from(accounts),
  ]);

  const availableMonths = Array.from(
    new Set(txList.map((t) => t.date.slice(0, 7)).filter(Boolean))
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <TransactionsClient
        initialTransactions={txList}
        accounts={allAccounts.map((a) => a.name)}
        availableMonths={availableMonths}
        initialWallet={initialWallet}
      />
    </div>
  );
}
