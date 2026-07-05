import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

interface CustomerRow {
  id: string;
  total_spent: number | null;
  order_count: number | null;
  last_order_at: string | null;
}

interface OrderRow {
  created_at: string;
  items: unknown;
}

interface SegmentFilter {
  min_orders?: number;
  max_orders?: number;
  min_spent?: number;
  max_spent?: number;
  days_since_last_order_max?: number;
  days_since_last_order_min?: number;
}

function applyFilter(customers: CustomerRow[], filter: SegmentFilter): CustomerRow[] {
  const now = Date.now();
  return customers.filter((c) => {
    const orders = c.order_count ?? 0;
    const spent = c.total_spent ?? 0;
    const daysSinceLast = c.last_order_at
      ? Math.round((now - new Date(c.last_order_at).getTime()) / 86_400_000)
      : null;

    if (filter.min_orders !== undefined && orders < filter.min_orders) return false;
    if (filter.max_orders !== undefined && orders > filter.max_orders) return false;
    if (filter.min_spent !== undefined && spent < filter.min_spent) return false;
    if (filter.max_spent !== undefined && spent > filter.max_spent) return false;
    if (filter.days_since_last_order_max !== undefined) {
      if (daysSinceLast === null || daysSinceLast > filter.days_since_last_order_max) return false;
    }
    if (filter.days_since_last_order_min !== undefined) {
      if (daysSinceLast === null || daysSinceLast < filter.days_since_last_order_min) return false;
    }
    return true;
  });
}

function buildSummary(customers: CustomerRow[], orders: OrderRow[]) {
  const n = customers.length;
  const now = Date.now();

  const spents = customers.map((c) => c.total_spent ?? 0).sort((a, b) => a - b);
  const avg_ltv = Math.round(spents.reduce((s, x) => s + x, 0) / n);

  const daysList = customers
    .filter((c) => c.last_order_at)
    .map((c) => Math.round((now - new Date(c.last_order_at!).getTime()) / 86_400_000));

  const orderCounts = customers.map((c) => c.order_count ?? 0);
  const avg_orders = Math.round((orderCounts.reduce((s, x) => s + x, 0) / n) * 10) / 10;

  const monthCounts: Record<number, number> = {};
  for (const o of orders) {
    const m = new Date(o.created_at).getMonth() + 1;
    monthCounts[m] = (monthCounts[m] ?? 0) + 1;
  }

  const categoryCounts: Record<string, number> = {};
  for (const o of orders) {
    if (!Array.isArray(o.items)) continue;
    for (const item of o.items as Record<string, unknown>[]) {
      const cat = String(item.category ?? item.product_type ?? "").trim();
      if (cat) categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;
    }
  }
  const top_categories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c]) => c)
    .filter(Boolean);

  return {
    total_customers: n,
    total_orders: orders.length,
    returning_rate_pct: Math.round(
      (customers.filter((c) => (c.order_count ?? 0) > 1).length / n) * 100
    ),
    ltv: {
      avg: avg_ltv,
      min: spents[0],
      max: spents[n - 1],
      median: spents[Math.floor(n / 2)],
      p75: spents[Math.floor(n * 0.75)],
    },
    order_frequency: {
      avg: avg_orders,
      one_time: customers.filter((c) => (c.order_count ?? 0) === 1).length,
      two_to_five: customers.filter((c) => {
        const o = c.order_count ?? 0;
        return o >= 2 && o <= 5;
      }).length,
      six_plus: customers.filter((c) => (c.order_count ?? 0) >= 6).length,
    },
    days_since_last_order: {
      avg: daysList.length
        ? Math.round(daysList.reduce((s, d) => s + d, 0) / daysList.length)
        : null,
      under_30: daysList.filter((d) => d <= 30).length,
      days_30_to_90: daysList.filter((d) => d > 30 && d <= 90).length,
      over_90: daysList.filter((d) => d > 90).length,
    },
    top_categories,
    orders_by_month: monthCounts,
  };
}

export async function POST() {
  const supabase = await createClient();
  const brandId = await getBrandId();

  const { data: brandData } = await supabase
    .from("brands")
    .select("name")
    .eq("id", brandId)
    .single();
  const brandName = (brandData as { name: string } | null)?.name ?? "varumärket";

  const { data: customersData } = await supabase
    .from("customers")
    .select("id, total_spent, order_count, last_order_at")
    .eq("brand_id", brandId);

  const customers = (customersData ?? []) as CustomerRow[];
  if (customers.length === 0) {
    return Response.json({ error: "Inga kunder att analysera" }, { status: 400 });
  }

  const customerIds = customers.map((c) => c.id);
  const { data: ordersData } = await supabase
    .from("orders")
    .select("created_at, items")
    .in("customer_id", customerIds);

  const orders = (ordersData ?? []) as OrderRow[];
  const summary = buildSummary(customers, orders);

  const prompt = `Du är expert på kundanalys för skandinaviska mode- och beauty-varumärken.

Analysera kundbasen för "${brandName}" och skapa 6–8 segment unika för just denna brand.

KUNDDATA:
${JSON.stringify(summary, null, 2)}

REGLER:
- Namnge segmenten kreativt på svenska — INTE generiska etiketter som "VIP-kunder" eller "Inaktiva kunder"
- Fånga vad datan faktiskt visar: säsongsmönster, köpbeteende, lojalitet, återvändande mönster
- Exempel på bra namn: "Söndagsromantikerna", "Vinterköparna", "De Nyckfulla", "Trofast sedan dag ett"
- description: 1–2 meningar, mänsklig ton som om du känner dessa kunder
- mood: exakt ett av: rose, ink, sand, gold, sage, plum, dust, night
- filter: JSON med dessa möjliga nycklar: min_orders, max_orders, min_spent, max_spent, days_since_last_order_max, days_since_last_order_min
- ai_suggestion: konkret, specifik åtgärd med tidsram — inte generell

Svara ENBART med giltig JSON-array, inga kommentarer:
[{"name":"...","description":"...","mood":"...","filter":{...},"ai_suggestion":"..."}]`;

  let segmentDefs: {
    name: string;
    description: string;
    mood: string;
    filter: SegmentFilter;
    ai_suggestion: string;
  }[];

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("Kunde inte tolka AI-svar");
    segmentDefs = JSON.parse(jsonMatch[0]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Okänt fel";
    return Response.json({ error: `AI-analys misslyckades: ${msg}` }, { status: 500 });
  }

  const now = Date.now();
  const ninetyDaysAgo = new Date(now - 90 * 86_400_000).toISOString();

  // Delete existing segments (memberships cascade)
  await supabase.from("segments").delete().eq("brand_id", brandId);

  const results = [];

  for (const def of segmentDefs) {
    const filtered = applyFilter(customers, def.filter ?? {});
    const count = filtered.length;
    const avgLtv =
      count > 0
        ? Math.round(filtered.reduce((s, c) => s + (c.total_spent ?? 0), 0) / count)
        : 0;
    const activeCount = filtered.filter(
      (c) => c.last_order_at && c.last_order_at >= ninetyDaysAgo
    ).length;

    const { data: inserted } = await supabase
      .from("segments")
      .insert({
        brand_id: brandId,
        name: def.name,
        description: def.description,
        mood_gradient: def.mood ?? "sand",
        customer_count: count,
        avg_ltv: avgLtv,
        ai_suggestion: def.ai_suggestion,
        criteria_json: def.filter ?? {},
      })
      .select("id")
      .single();

    const segmentId = (inserted as { id: string } | null)?.id;
    if (!segmentId) continue;

    if (filtered.length > 0) {
      await supabase.from("segment_memberships").insert(
        filtered.map((c) => ({
          segment_id: segmentId,
          customer_id: c.id,
          probability_to_purchase: 0,
        }))
      );
    }

    results.push({
      id: segmentId,
      name: def.name,
      description: def.description,
      mood: def.mood,
      customer_count: count,
      avg_ltv: avgLtv,
      active_count: activeCount,
      ai_suggestion: def.ai_suggestion,
    });
  }

  return Response.json({ segments: results, analyzed_customers: customers.length });
}
