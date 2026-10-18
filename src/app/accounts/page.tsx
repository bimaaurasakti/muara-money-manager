import { db } from "@/db";
import { accounts } from "@/db/schema";
import { AccountsClient } from "@/components/accounts/accounts-client";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const allAccounts = await db.select().from(accounts);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      <AccountsClient initialAccounts={allAccounts} />
    </div>
  );
}
