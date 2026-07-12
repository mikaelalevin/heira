import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { Greeting } from "./Greeting";
import { parseReturnStats, returnRateColor } from "@/lib/returns";

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const inkSoft = "#5A4232";
const border = "#DDD0B5";
const bg = "#FAF5EB";
const warm = "#F2E8D0";
const card = "#FFFFFF";

interface AiPrediction {
  product: string;
  date: string;
  daysUntil: number;
  confidence: number;
  reason: string;
  generatedAt: string;
}

const AVATAR_COLORS = ["#D9896A", "#A8B5A0", "#C9A961", "#B47A75", "#6B4F5B", "#6B7A63"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const brandId = await getBrandId();

  const { data: brandsData } = await supabase
    .from("brands")
    .select("name, id")
    .eq("id", brandId)
    .limit(1);

  const brand = (brandsData?.[0] ?? null) as { id: string; name: string } | null;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString();

  const { data: customersData } = await supabase
    .from("customers")
    .select("id, total_spent, order_count, last_order_at, created_at, first_name, last_name, email, ai_prediction, return_stats")
    .eq("brand_id", brandId);

  const customers = (customersData ?? []) as {
    id: string; total_spent: number | null; order_count: number | null;
    last_order_at: string | null; created_at: string;
    first_name: string | null; last_name: string | null; email: string;
    ai_prediction: AiPrediction | null;
    return_stats: Record<string, unknown> | null;
  }[];

  const aiSignals = customers
    .filter((c) => c.ai_prediction && typeof c.ai_prediction.daysUntil === "number")
    .map((c) => {
      const pred = c.ai_prediction!;
      const genDate = new Date(pred.generatedAt);
      genDate.setDate(genDate.getDate() + pred.daysUntil);
      const actualDaysUntil = Math.max(0, Math.round((genDate.getTime() - Date.now()) / 86_400_000));
      return { ...c, prediction: pred, actualDaysUntil };
    })
    .sort((a, b) => a.actualDaysUntil - b.actualDaysUntil)
    .slice(0, 4);
  const customerIds = customers.map((c) => c.id);

  const [
    { data: thisWeekOrders },
    { data: lastWeekOrders },
    { data: recentOrdersData },
  ] = await Promise.all([
    customerIds.length > 0
      ? supabase.from("orders").select("total, created_at").in("customer_id", customerIds).gte("created_at", sevenDaysAgo)
      : { data: [] },
    customerIds.length > 0
      ? supabase.from("orders").select("total").in("customer_id", customerIds).gte("created_at", fourteenDaysAgo).lt("created_at", sevenDaysAgo)
      : { data: [] },
    supabase
      .from("orders")
      .select("id, total, created_at, items, customer_id, customers!inner(first_name, last_name, email, brand_id)")
      .eq("customers.brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const totalRevenue = customers.reduce((s, c) => s + (c.total_spent ?? 0), 0);
  const totalCustomers = customers.length;
  const newThisMonth = customers.filter((c) => c.created_at >= thirtyDaysAgo).length;
  const churnRisk = customers.filter((c) => c.last_order_at && c.last_order_at < ninetyDaysAgo).length;
  const totalOrders = customers.reduce((s, c) => s + (c.order_count ?? 0), 0);
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const returnRates = customers
    .map((c) => parseReturnStats(c.return_stats)?.return_rate)
    .filter((r): r is number => typeof r === "number");
  const avgReturnRate = returnRates.length > 0
    ? returnRates.reduce((s, r) => s + r, 0) / returnRates.length
    : null;
  const returnValuePerOrder = avgReturnRate !== null ? Math.round(avgReturnRate * avgOrderValue) : 0;

  const thisWeekRevenue = ((thisWeekOrders ?? []) as { total: number }[]).reduce((s, o) => s + o.total, 0);
  const lastWeekRevenue = ((lastWeekOrders ?? []) as { total: number }[]).reduce((s, o) => s + o.total, 0);
  const thisWeekOrderCount = (thisWeekOrders ?? []).length;
  const weekChange = lastWeekRevenue > 0
    ? Math.round(((thisWeekRevenue - lastWeekRevenue) / lastWeekRevenue) * 100)
    : null;

  const recentOrders = ((recentOrdersData ?? []) as unknown[]).map((o) => o as {
    id: string; total: number; created_at: string; items: unknown[];
    customer_id: string;
    customers: { first_name: string | null; last_name: string | null; email: string };
  });

  return (
    <div className="animate-fade-in">
      <Greeting brandName={brand?.name} />

      {/* Hero — denna vecka */}
      <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>

        {/* Omsättning denna vecka — stor */}
        <div className="col-span-2 rounded-2xl p-6" style={{ background: ink }}>
          <div className="text-[10.5px] uppercase tracking-[0.1em] font-semibold mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
            Omsättning · Senaste 7 dagarna
          </div>
          <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 42, color: "white", lineHeight: 1, letterSpacing: "-0.02em" }}>
            {thisWeekRevenue > 0 ? thisWeekRevenue.toLocaleString("sv") + " kr" : "–"}
          </div>
          <div className="flex items-center gap-2 mt-3">
            {weekChange !== null ? (
              <span className="flex items-center gap-1 text-[12px] font-semibold px-2 py-1 rounded-lg"
                style={{ background: weekChange >= 0 ? "rgba(107,122,99,0.3)" : "rgba(196,82,36,0.3)", color: weekChange >= 0 ? "#A8C9A0" : "#E8937A" }}>
                {weekChange >= 0 ? "↑" : "↓"} {Math.abs(weekChange)}% vs förra veckan
              </span>
            ) : (
              <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>Ingen data föregående vecka</span>
            )}
            <span className="text-[12px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {thisWeekOrderCount} order{thisWeekOrderCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Total omsättning */}
        <div className="rounded-2xl p-5" style={{ background: card, border: `1px solid ${border}` }}>
          <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium mb-2" style={{ color: inkMuted }}>Total omsättning</div>
          <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 26, color: ink, lineHeight: 1 }}>
            {totalRevenue > 0 ? totalRevenue.toLocaleString("sv") + " kr" : "–"}
          </div>
          <div className="mt-2 text-[11.5px]" style={{ color: inkMuted }}>{totalOrders} ordrar totalt</div>
        </div>

        {/* Snitt ordervärde */}
        <div className="rounded-2xl p-5" style={{ background: card, border: `1px solid ${border}` }}>
          <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium mb-2" style={{ color: inkMuted }}>Snitt ordervärde</div>
          <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 26, color: ink, lineHeight: 1 }}>
            {avgOrderValue > 0 ? avgOrderValue.toLocaleString("sv") + " kr" : "–"}
          </div>
          <div className="mt-2 text-[11.5px]" style={{ color: inkMuted }}>Per transaktion</div>
        </div>
      </div>

      {/* Kund-rad */}
      <div className={`grid gap-4 mb-6 ${avgReturnRate !== null ? "grid-cols-4" : "grid-cols-3"}`}>
        <div className="rounded-2xl p-5" style={{ background: card, border: `1px solid ${border}` }}>
          <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium mb-2" style={{ color: inkMuted }}>Kunder totalt</div>
          <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 26, color: ink, lineHeight: 1 }}>{totalCustomers.toLocaleString("sv")}</div>
          <div className="mt-2 text-[11.5px]" style={{ color: newThisMonth > 0 ? "#6B7A63" : inkMuted }}>
            {newThisMonth > 0 ? `+${newThisMonth} senaste 30 dagarna` : "Inga nya senaste månaden"}
          </div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: card, border: `1px solid ${border}` }}>
          <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium mb-2" style={{ color: inkMuted }}>Aktiva kunder</div>
          <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 26, color: ink, lineHeight: 1 }}>
            {customers.filter((c) => c.last_order_at && c.last_order_at >= ninetyDaysAgo).length.toLocaleString("sv")}
          </div>
          <div className="mt-2 text-[11.5px]" style={{ color: inkMuted }}>Köpt senaste 90 dagarna</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: churnRisk > 0 ? "#FDF0EC" : card, border: `1px solid ${churnRisk > 0 ? "#E8B4A4" : border}` }}>
          <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium mb-2" style={{ color: churnRisk > 0 ? "#C45224" : inkMuted }}>Churn-risk</div>
          <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 26, color: churnRisk > 0 ? "#C45224" : ink, lineHeight: 1 }}>{churnRisk}</div>
          <div className="mt-2 text-[11.5px]" style={{ color: churnRisk > 0 ? "#C45224" : inkMuted }}>
            {churnRisk > 0
              ? <a href="/customers" style={{ color: "inherit" }}>Se kunder i riskzon →</a>
              : "Inga kunder i riskzon"}
          </div>
        </div>
        {avgReturnRate !== null && (
          <div className="rounded-2xl p-5" style={{ background: card, border: `1px solid ${border}` }}>
            <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium mb-2" style={{ color: inkMuted }}>Returrate (30d)</div>
            <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 26, color: returnRateColor(avgReturnRate), lineHeight: 1 }}>
              {Math.round(avgReturnRate * 100)}%
            </div>
            <div className="mt-2 text-[11.5px]" style={{ color: inkMuted }}>
              % av intäkten som återgår — ~{returnValuePerOrder.toLocaleString("sv")} kr/order
            </div>
          </div>
        )}
      </div>

      {/* Senaste ordrar */}
      {recentOrders.length > 0 && (
        <div className="rounded-2xl mb-5" style={{ background: card, border: `1px solid ${border}` }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${border}` }}>
            <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 18, color: ink }}>
              Senaste ordrar
            </h2>
            <a href="/customers" className="text-[12px] font-medium" style={{ color: inkMuted, textDecoration: "none" }}>
              Visa alla kunder →
            </a>
          </div>
          <div>
            {recentOrders.map((order, i) => {
              const c = order.customers;
              const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email;
              const initials = [c.first_name, c.last_name].filter(Boolean).map((n) => n![0]).join("").toUpperCase() || c.email.slice(0, 2).toUpperCase();
              const items = Array.isArray(order.items) ? order.items : [];
              const firstItem = items[0] as Record<string, unknown> | undefined;
              const itemName = firstItem ? String(firstItem.name ?? firstItem.title ?? "") : "";
              const extraCount = items.length > 1 ? items.length - 1 : 0;
              const date = new Date(order.created_at).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
              const isThisWeek = order.created_at >= sevenDaysAgo;

              return (
                <a key={order.id} href={`/customers/${order.customer_id}`}
                  className="flex items-center gap-4 px-6 py-4"
                  style={{ borderBottom: i < recentOrders.length - 1 ? `1px solid ${border}` : "none", textDecoration: "none", display: "flex" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #D9896A, #C07858)" }}>
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-semibold" style={{ color: ink }}>{name}</div>
                    <div className="text-[12px] mt-0.5 truncate" style={{ color: inkMuted }}>
                      {itemName}{extraCount > 0 ? ` +${extraCount} till` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {isThisWeek && (
                      <span className="text-[10px] uppercase tracking-[0.08em] font-semibold px-2 py-0.5 rounded-full" style={{ background: warm, color: inkSoft }}>
                        Denna vecka
                      </span>
                    )}
                    <div className="text-right">
                      <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 15, color: ink }}>
                        {order.total.toLocaleString("sv")} kr
                      </div>
                      <div className="text-[11.5px] mt-0.5" style={{ color: inkMuted }}>{date}</div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* AI-insikt */}
      {churnRisk > 0 && (
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: card, border: `1px solid ${border}` }}>
          <div className="px-6 py-4 flex items-center gap-2.5" style={{ background: "linear-gradient(135deg, #1A1614 0%, #3D2B22 100%)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" style={{ opacity: 0.7 }}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <span className="text-[10.5px] uppercase tracking-[0.12em] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
              HEIRA · Insikt
            </span>
          </div>
          <div className="px-6 py-5 flex items-center justify-between gap-6">
            <p className="text-[14px] leading-relaxed" style={{ color: inkSoft }}>
              <strong style={{ color: ink }}>{churnRisk} kunder</strong> har inte handlat på över 90 dagar. Med ett snitt ordervärde på {avgOrderValue.toLocaleString("sv")} kr kan en riktad win-back-kampanj ge upp till <strong style={{ color: ink }}>{(churnRisk * avgOrderValue).toLocaleString("sv")} kr</strong> i återvunnen omsättning.
            </p>
            <a href="/campaigns"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium flex-shrink-0"
              style={{ background: ink, color: bg, textDecoration: "none", fontFamily: "inherit" }}>
              Skapa win-back →
            </a>
          </div>
        </div>
      )}

      {/* AI-signaler */}
      {aiSignals.length > 0 && (
        <div className="rounded-2xl overflow-hidden mb-5" style={{ border: `1px solid ${border}` }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ background: ink }}>
            <div className="flex items-center gap-2.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" style={{ opacity: 0.65 }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span className="text-[10.5px] uppercase tracking-[0.12em] font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>
                AI-signaler · Förutsagda köp
              </span>
            </div>
            <a href="/ai-recommendations" className="text-[11.5px] font-medium" style={{ color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>
              Visa alla →
            </a>
          </div>
          {aiSignals.map((c, i) => {
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const displayName = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email;
            const initials = c.first_name && c.last_name
              ? (c.first_name[0] + c.last_name[0]).toUpperCase()
              : (c.first_name?.[0] ?? c.email[0]).toUpperCase();
            const urgent = c.actualDaysUntil <= 7;
            const urgentColor = urgent ? "#3E6B2F" : inkMuted;
            return (
              <a key={c.id} href={`/customers/${c.id}`}
                className="flex items-center gap-4 px-6 py-4"
                style={{ borderBottom: i < aiSignals.length - 1 ? `1px solid ${border}` : "none", background: card, textDecoration: "none", display: "flex" }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, fontSize: 13 }}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold" style={{ color: ink }}>{displayName}</div>
                  {c.prediction.reason && (
                    <div className="text-[11.5px] mt-0.5 truncate" style={{ color: inkMuted, fontStyle: "italic" }}>
                      {c.prediction.reason}
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 14, color: ink }}>{c.prediction.product}</div>
                  <div className="text-[11px] mt-0.5 font-medium" style={{ color: urgentColor }}>
                    {c.actualDaysUntil === 0 ? "Idag" : `om ${c.actualDaysUntil} dag${c.actualDaysUntil === 1 ? "" : "ar"}`}
                    {urgent && (
                      <span className="ml-1.5 inline-flex w-1.5 h-1.5 rounded-full bg-green-600" style={{ verticalAlign: "middle" }} />
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4" style={{ width: 52 }}>
                  <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: warm }}>
                    <div style={{ height: "100%", width: `${c.prediction.confidence}%`, background: "#6B4F5B", borderRadius: 2 }} />
                  </div>
                  <div className="text-right mt-1 text-[10.5px] font-semibold" style={{ color: "#6B4F5B" }}>{c.prediction.confidence}%</div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Snabba vägar */}
      <div>
        <h2 className="mb-4" style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 20, color: ink, letterSpacing: "-0.01em" }}>
          Snabba vägar
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/customers", label: "Kunder", sub: `${totalCustomers} kunder`, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2"/></svg> },
            { href: "/trends", label: "Försäljning", sub: "Omsättning & beteende", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg> },
            { href: "/campaigns", label: "Kampanjer", sub: "Skapa kampanj", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></svg> },
            { href: "/ai-recommendations", label: "AI-prediktioner", sub: "Nästa köp per kund", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg> },
          ].map((link) => (
            <a key={link.href} href={link.href} className="flex flex-col gap-3 rounded-2xl p-5 transition-all"
              style={{ background: card, border: `1px solid ${border}`, textDecoration: "none" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: warm, color: ink }}>
                {link.icon}
              </div>
              <div>
                <div className="font-semibold text-[13.5px]" style={{ color: ink }}>{link.label}</div>
                <div className="text-[12px] mt-0.5" style={{ color: inkMuted }}>{link.sub}</div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
