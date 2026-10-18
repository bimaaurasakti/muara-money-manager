import { db } from "@/db";
import { transactions, accounts, categories, subcategories } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import { TransactionsClient } from "@/components/transactions/transactions-client";

export const dynamic = "force-dynamic";

interface TransactionsPageProps {
  searchParams?: Promise<{
    wallet?: string;
    sort?: string;
  }>;
}

export default async function TransactionsPage(props?: TransactionsPageProps) {
  const resolvedParams = props?.searchParams ? await props.searchParams : undefined;
  const initialWallet = resolvedParams?.wallet;
  const initialSort = resolvedParams?.sort;

  const targetAccounts = alias(accounts, "target_accounts");

  const [txList, allAccounts, allCategories, allSubcategories] = await Promise.all([
    db
      .select({
        id: transactions.id,
        inputOrder: sql<number>`transactions.rowid`.mapWith(Number),
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
    db.select().from(categories),
    db.select().from(subcategories),
  ]);

  const categoriesData = allCategories.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    subcategories: allSubcategories
      .filter((s) => s.categoryId === c.id)
      .map((s) => ({ id: s.id, name: s.name })),
  }));

  const availableMonths = Array.from(
    new Set(txList.map((t) => t.date.slice(0, 7)).filter(Boolean))
  );

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      <TransactionsClient
        initialTransactions={txList}
        accounts={allAccounts.map((a) => a.name)}
        accountsMetadata={allAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          initialBalance: a.initialBalance,
          currentBalance: a.currentBalance,
        }))}
        categoriesData={categoriesData}
        availableMonths={availableMonths}
        initialWallet={initialWallet}
        initialSort={initialSort}
      />
    </div>
  );
}
