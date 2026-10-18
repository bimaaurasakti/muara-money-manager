import {
  getMonthlyKPISummary,
  getDailyTimeline,
  getInterWalletTransfers,
  getCategoryBreakdown,
  getTitleBreakdown,
} from "@/lib/data/monthly-analytics";
import { MonthlyDashboardClient } from "@/components/monthly/monthly-dashboard-client";

export const dynamic = "force-dynamic";

export default async function MonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const resolvedParams = await searchParams;
  const currentMonth = resolvedParams?.month || "2026-08";

  const [summary, timeline, transfers, categories, titles] = await Promise.all([
    getMonthlyKPISummary(currentMonth),
    getDailyTimeline(currentMonth),
    getInterWalletTransfers(currentMonth),
    getCategoryBreakdown(currentMonth),
    getTitleBreakdown(currentMonth),
  ]);

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      <MonthlyDashboardClient
        summary={summary}
        timeline={timeline}
        transfers={transfers}
        categories={categories}
        titles={titles}
      />
    </div>
  );
}
