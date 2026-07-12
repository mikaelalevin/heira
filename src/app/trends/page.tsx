import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { AppShell } from "@/components/layout/AppShell";
import { RevenueBarChart, WeekdayBarChart, TopItemsList } from "./TrendsCharts";
import { deriveProductReturns } from "@/lib/productReturns";

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const inkSoft = "#5A4232";
const border = "#DDD0B5";
const warm = "#F2E8D0";
const card = "#FFFFFF";

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "Maj",
  "06": "Jun", "07": "Jul", "08": "Aug", "09": "Sep", "10": "Okt",
  "11": "Nov", "12": "Dec",
};
const WEEKDAY_ORDER = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

export default async function TrendsPage() {
  const supabase = await createClient();
  const brandId = await getBrandId();

  const { data: customersData } = await supabase
    .from("customers")
    .select("id, created_at, total_spent, order_count, last_order_at")
    .eq("brand_id", brandId);

  const customers = (customersData ?? []) as { id: string; created_at: string; total_spent: number | null; order_count: number | null; last_order_at: string | null }[];
  const customerIds = customers.map((c) => c.id);

  const { data: ordersData } = customerIds.length > 0
    ? await supabase
        .from("orders")
        .select("total, created_at, items")
        .in("customer_id", customerIds)
        .order("created_at", { ascending: true })
        .limit(1000)
    : { data: [] };

  const orders = (ordersData ?? []) as { total: number; created_at: string; items: unknown[] }[];

  // Monthly revenue
  const monthlyMap: Record<string, number> = {};
  const weekdayMap: Record<string, number> = { Mån: 0, Tis: 0, Ons: 0, Tor: 0, Fre: 0, Lör: 0, Sön: 0 };
  const itemsMap: Record<string, number> = {};
  const weekdays = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];

  for (const order of orders) {
    const d = new Date(order.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyMap[key] = (monthlyMap[key] ?? 0) + order.total;
    const dayName = weekdays[d.getDay()];
    weekdayMap[dayName] = (weekdayMap[dayName] ?? 0) + order.total;

    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (typeof item === "object" && item !== null) {
          const it = item as Record<string, unknown>;
          const name = String(it.name ?? it.title ?? "");
          const qty = Number(it.quantity ?? it.qty ?? 1);
          if (name) itemsMap[name] = (itemsMap[name] ?? 0) + qty;
        }
      }
    }
  }

  // Fill in missing months between first and last
  const allKeys = Object.keys(monthlyMap).sort();
  const monthData: { month: string; revenue: number }[] = [];
  if (allKeys.length > 0) {
    const [startYear, startMonth] = allKeys[0].split("-").map(Number);
    const [endYear, endMonth] = allKeys[allKeys.length - 1].split("-").map(Number);
    let y = startYear, m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      const label = `${MONTH_LABELS[String(m).padStart(2, "0")]} ${y !== new Date().getFullYear() ? String(y).slice(2) : ""}`.trim();
      monthData.push({ month: label, revenue: monthlyMap[key] ?? 0 });
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }

  const weekdayData = WEEKDAY_ORDER.map((day) => ({ day, revenue: weekdayMap[day] ?? 0 }));

  const topItems = Object.entries(itemsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));
  const maxItemCount = topItems[0]?.count ?? 1;
  const mostReturnedProducts = deriveProductReturns(itemsMap).slice(0, 5);

  // KPIs
  const totalRevenue = customers.reduce((s, c) => s + (c.total_spent ?? 0), 0);
  const totalOrders = orders.length;
  const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const bestMonth = monthData.reduce((best, m) => m.revenue > best.revenue ? m : best, { month: "–", revenue: 0 });
  const bestDay = weekdayData.reduce((best, d) => d.revenue > best.revenue ? d : best, { day: "–", revenue: 0 });

  // Growth: first vs last month revenue
  const firstMonthRevenue = monthData[0]?.revenue ?? 0;
  const lastMonthRevenue = monthData[monthData.length - 1]?.revenue ?? 0;
  const growthPct = firstMonthRevenue > 0
    ? Math.round(((lastMonthRevenue - firstMonthRevenue) / firstMonthRevenue) * 100)
    : 0;

  // Churn risk: no order in 90 days
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const churnRisk = customers.filter((c) => c.last_order_at && c.last_order_at < ninetyDaysAgo).length;
  const activeCustomers = customers.filter((c) => c.last_order_at && c.last_order_at >= ninetyDaysAgo).length;

  return (
    <AppShell>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 34, letterSpacing: "-0.01em", color: ink }}>
            Försäljning
          </h1>
          <p className="mt-1.5 text-[14px]" style={{ color: inkMuted }}>
            Försäljning och kundbeteende de senaste {monthData.length} månaderna
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total omsättning", value: totalRevenue.toLocaleString("sv") + " kr", sub: `${totalOrders} ordrar totalt` },
            { label: "Snitt ordervärde", value: avgOrder.toLocaleString("sv") + " kr", sub: "Per transaktion" },
            { label: "Bästa månad", value: bestMonth.month, sub: bestMonth.revenue.toLocaleString("sv") + " kr" },
            { label: "Bästa köpdag", value: ({ Mån: "Måndag", Tis: "Tisdag", Ons: "Onsdag", Tor: "Torsdag", Fre: "Fredag", Lör: "Lördag", Sön: "Söndag" } as Record<string,string>)[bestDay.day] ?? bestDay.day, sub: bestDay.revenue.toLocaleString("sv") + " kr" },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-2xl p-5" style={{ background: card, border: `1px solid ${border}` }}>
              <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium mb-2" style={{ color: inkMuted }}>{kpi.label}</div>
              <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 26, color: ink, lineHeight: 1 }}>{kpi.value}</div>
              <div className="mt-2 text-[11.5px]" style={{ color: inkMuted }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Main revenue chart */}
        <div className="rounded-2xl p-6 mb-5" style={{ background: card, border: `1px solid ${border}` }}>
          <div className="flex items-start justify-between mb-5">
            <div>
              <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, color: ink }}>Omsättning per månad</div>
              <div className="text-[13px] mt-0.5" style={{ color: inkMuted }}>Totala intäkter per månad</div>
            </div>
            {growthPct > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "#DDE7D7" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3E6B2F" strokeWidth="2.5"><path d="M7 17l10-10M7 7h10v10"/></svg>
                <span className="text-[12px] font-semibold" style={{ color: "#3E6B2F" }}>+{growthPct}% sen start</span>
              </div>
            )}
          </div>
          <RevenueBarChart data={monthData} />
        </div>

        {/* Two columns */}
        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* Weekday chart */}
          <div className="rounded-2xl p-6" style={{ background: card, border: `1px solid ${border}` }}>
            <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, color: ink, marginBottom: 4 }}>Omsättning per veckodag</div>
            <div className="text-[13px] mb-4" style={{ color: inkMuted }}>
              {bestDay.day !== "–" ? `${({ Mån: "Måndagar", Tis: "Tisdagar", Ons: "Onsdagar", Tor: "Torsdagar", Fre: "Fredagar", Lör: "Lördagar", Sön: "Söndagar" } as Record<string, string>)[bestDay.day] ?? bestDay.day} är starkaste köpdagen` : ""}
            </div>
            <WeekdayBarChart data={weekdayData} />
          </div>

          {/* Top products */}
          <div className="rounded-2xl p-6" style={{ background: card, border: `1px solid ${border}` }}>
            <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, color: ink, marginBottom: 4 }}>Mest sålda produkter</div>
            <div className="text-[13px] mb-5" style={{ color: inkMuted }}>Baserat på antal sålda enheter</div>
            {topItems.length > 0 ? (
              <TopItemsList items={topItems} maxCount={maxItemCount} />
            ) : (
              <p className="text-[13px]" style={{ color: inkMuted }}>Ingen produktdata ännu.</p>
            )}
          </div>
        </div>

        {/* Mest returnerade produkter */}
        {mostReturnedProducts.length > 0 && (
          <div className="rounded-2xl p-6 mb-5" style={{ background: card, border: `1px solid ${border}` }}>
            <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, color: ink, marginBottom: 4 }}>
              Mest returnerade produkter
            </div>
            <div className="text-[13px] mb-5" style={{ color: inkMuted }}>
              Uppskattad returrate per produkt, med vanligaste anledningarna
            </div>
            <div className="flex flex-col">
              {mostReturnedProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-4 py-3.5" style={{ borderTop: i === 0 ? "none" : `1px solid ${border}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium truncate" style={{ color: ink }}>{p.name}</div>
                    <div className="text-[12px] mt-1" style={{ color: inkMuted }}>
                      {p.reasons.map((r) => `${r.label} (${r.count})`).join(" · ")}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 16, color: ink }}>
                      {p.returnsCount} returer
                    </div>
                    <div className="text-[11.5px] mt-0.5" style={{ color: inkMuted }}>
                      {Math.round(p.returnRate * 100)}% av {p.unitsSold} sålda
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI insight + customer health */}
        <div className="grid grid-cols-2 gap-5">
          {/* AI insight */}
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
            <div className="px-6 py-4 flex items-center gap-2.5" style={{ background: "linear-gradient(135deg, #1A1614 0%, #3D2B22 100%)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" style={{ opacity: 0.7 }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span className="text-[10.5px] uppercase tracking-[0.12em] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                HEIRA · Trendinsikt
              </span>
            </div>
            <div className="px-6 py-5" style={{ background: card }}>
              <p className="text-[14px] leading-relaxed mb-4" style={{ color: inkSoft }}>
                {growthPct > 0
                  ? `Omsättningen har ökat med ${growthPct}% sedan start — drivet av återkommande kunder med kortare köpcykler. `
                  : ""}
                {bestDay.day !== "–"
                  ? `${({ Mån: "Måndagar", Tis: "Tisdagar", Ons: "Onsdagar", Tor: "Torsdagar", Fre: "Fredagar", Lör: "Lördagar", Sön: "Söndagar" } as Record<string,string>)[bestDay.day] ?? bestDay.day} är er starkaste köpdag med ${bestDay.revenue.toLocaleString("sv")} kr i intäkter — optimalt att schemalägga kampanjer dit. `
                  : ""}
                {churnRisk > 0
                  ? `${churnRisk} kunder har inte handlat på 90+ dagar och behöver en win-back-insats.`
                  : ""}
              </p>
              <a href="/campaigns"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium"
                style={{ background: ink, color: "#FAF5EB", textDecoration: "none", fontFamily: "inherit" }}>
                Skapa kampanj baserat på insikt →
              </a>
            </div>
          </div>

          {/* Customer health */}
          <div className="rounded-2xl p-6" style={{ background: card, border: `1px solid ${border}` }}>
            <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, color: ink, marginBottom: 4 }}>Kundhälsa</div>
            <div className="text-[13px] mb-5" style={{ color: inkMuted }}>Aktivitet senaste 90 dagarna</div>

            <div className="flex flex-col gap-4">
              {[
                { label: "Aktiva kunder", count: activeCustomers, total: customers.length, color: "#6B7A63" },
                { label: "Churn-risk", count: churnRisk, total: customers.length, color: "#C45224" },
                { label: "Totalt", count: customers.length, total: customers.length, color: ink },
              ].map((row) => (
                <div key={row.label}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[13px]" style={{ color: ink }}>{row.label}</span>
                    <span className="text-[13px] font-semibold" style={{ fontFamily: "var(--font-fraunces), serif", color: ink }}>{row.count}</span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 5, background: warm }}>
                    <div style={{ height: "100%", width: `${customers.length > 0 ? (row.count / customers.length) * 100 : 0}%`, background: row.color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
