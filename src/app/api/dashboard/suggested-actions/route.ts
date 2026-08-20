import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { filterSegment } from "@/lib/segments";
import { RETURN_TYPE_LABELS } from "@/lib/returns";

export const dynamic = "force-dynamic";

type Category = "second-thoughts" | "imminent-prediction" | "thank-you" | "win-back";

interface AiPrediction {
  product: string;
  daysUntil: number;
  generatedAt: string;
}

interface ReturnStats {
  return_rate: number;
  returns_count: number;
  most_returned_type: string;
  last_return_at: string;
}

interface CustomerRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  total_spent: number | null;
  order_count: number | null;
  last_order_at: string | null;
  ai_prediction: AiPrediction | null;
  return_stats: ReturnStats | null;
}

interface OrderRow {
  id: string;
  customer_id: string;
  created_at: string;
  items: unknown[];
  channel: "in_store" | "online";
}

interface SuggestedAction {
  id: string;
  category: Category;
  priority: number;
  customer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    return_rate?: number;
  };
  context: string;
  cta_label: string;
  cta_action: "generate-message" | "generate-styling-offer";
}

const PRIORITY: Record<Category, number> = {
  "second-thoughts": 1,
  "imminent-prediction": 2,
  "thank-you": 3,
  "win-back": 4,
};

function itemName(items: unknown): string | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const first = items[0];
  if (typeof first === "object" && first !== null) {
    const it = first as Record<string, unknown>;
    const name = it.name ?? it.title ?? it.product_name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  }
  return null;
}

function daysAgo(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function dagarText(n: number): string {
  return `${n} ${n === 1 ? "dag" : "dagar"}`;
}

export async function GET() {
  const supabase = await createClient();
  const brandId = await getBrandId();
  if (!brandId) return Response.json({ actions: [], total: 0 });

  const { data: customersData } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, total_spent, order_count, last_order_at, ai_prediction, return_stats")
    .eq("brand_id", brandId);

  const customers = (customersData ?? []) as CustomerRow[];
  const customerIds = customers.map((c) => c.id);

  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();

  const { data: ordersData } = customerIds.length > 0
    ? await supabase
        .from("orders")
        .select("id, customer_id, created_at, items, channel")
        .in("customer_id", customerIds)
        .gte("created_at", fourteenDaysAgo)
        .order("created_at", { ascending: false })
    : { data: [] };

  const orders = (ordersData ?? []) as OrderRow[];
  const latestOrderByCustomer = new Map<string, OrderRow>();
  for (const o of orders) {
    if (!latestOrderByCustomer.has(o.customer_id)) latestOrderByCustomer.set(o.customer_id, o);
  }

  const actions: SuggestedAction[] = [];

  // 1. Second Thoughts har returnerat — högst prio
  // Triggar på ett faktiskt returtillfälle (last_return_at), inte på ett nytt köp —
  // return_stats är en aggregerad kundstat och kan inte kopplas till en specifik order.
  const secondThoughts = customers
    .filter(
      (c) =>
        c.return_stats &&
        c.return_stats.return_rate >= 0.45 &&
        c.return_stats.last_return_at &&
        c.return_stats.last_return_at >= fourteenDaysAgo
    )
    .sort((a, b) => b.return_stats!.return_rate - a.return_stats!.return_rate)
    .slice(0, 2);

  for (const c of secondThoughts) {
    const rs = c.return_stats!;
    const typeLabel = RETURN_TYPE_LABELS[rs.most_returned_type] ?? rs.most_returned_type ?? "ett plagg";
    const da = daysAgo(rs.last_return_at);
    actions.push({
      id: `second-thoughts-${c.id}`,
      category: "second-thoughts",
      priority: PRIORITY["second-thoughts"],
      customer: {
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        return_rate: rs.return_rate,
      },
      context: `Returnerade ${typeLabel} för ${dagarText(da)} sedan — returnerar ofta, kanske dags för en stylingtimme istället för fler köp.`,
      cta_label: "Boka stylingsamtal",
      cta_action: "generate-styling-offer",
    });
  }

  // 2. Prediktion är nära
  const imminent = customers
    .filter((c) => c.ai_prediction && typeof c.ai_prediction.daysUntil === "number" && !!c.ai_prediction.generatedAt)
    .map((c) => {
      const pred = c.ai_prediction!;
      const genDate = new Date(pred.generatedAt);
      genDate.setDate(genDate.getDate() + pred.daysUntil);
      const actualDaysUntil = Math.round((genDate.getTime() - Date.now()) / 86_400_000);
      return { c, pred, actualDaysUntil };
    })
    .filter((x) => x.actualDaysUntil > 0 && x.actualDaysUntil <= 7)
    .sort((a, b) => a.actualDaysUntil - b.actualDaysUntil)
    .slice(0, 2);

  for (const { c, pred, actualDaysUntil } of imminent) {
    actions.push({
      id: `imminent-prediction-${c.id}`,
      category: "imminent-prediction",
      priority: PRIORITY["imminent-prediction"],
      customer: { id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email },
      context: `Väntas köpa ${pred.product} inom ${dagarText(actualDaysUntil)} — ett nudge-mail nu kan påskynda köpet.`,
      cta_label: "Skicka nudge",
      cta_action: "generate-message",
    });
  }

  // 3. Tack-mail väntar — köp i butik för 2–7 dagar sedan
  const thankYou = customers
    .filter((c) => {
      const order = latestOrderByCustomer.get(c.id);
      if (!order || order.channel !== "in_store") return false;
      const da = daysAgo(order.created_at);
      return da >= 2 && da <= 7;
    })
    .map((c) => ({ c, order: latestOrderByCustomer.get(c.id)! }))
    .sort((a, b) => daysAgo(b.order.created_at) - daysAgo(a.order.created_at))
    .slice(0, 2);

  for (const { c, order } of thankYou) {
    const name = itemName(order.items) ?? "ett plagg";
    const da = daysAgo(order.created_at);
    actions.push({
      id: `thank-you-${c.id}`,
      category: "thank-you",
      priority: PRIORITY["thank-you"],
      customer: { id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email },
      context: `Handlade ${name} för ${dagarText(da)} sedan i butiken — inget tack-mail skickat än.`,
      cta_label: "Skapa tack-mail",
      cta_action: "generate-message",
    });
  }

  // 4. Inaktiva kunder — återanvänder filterSegment
  const segmentCustomers = customers.map((c) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    total_spent: c.total_spent,
    order_count: c.order_count,
    last_order_at: c.last_order_at,
    return_stats: c.return_stats,
  }));

  const winBack = (filterSegment("inaktiva", segmentCustomers) as typeof segmentCustomers)
    .sort((a, b) => new Date(a.last_order_at ?? 0).getTime() - new Date(b.last_order_at ?? 0).getTime())
    .slice(0, 2);

  for (const c of winBack) {
    const da = c.last_order_at ? daysAgo(c.last_order_at) : null;
    actions.push({
      id: `win-back-${c.id}`,
      category: "win-back",
      priority: PRIORITY["win-back"],
      customer: { id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email },
      context: da !== null
        ? `Har inte handlat på ${dagarText(da)}. Kanske dags för en påminnelse?`
        : "Har varit inaktiv en tid. Kanske dags för en påminnelse?",
      cta_label: "Skicka win-back",
      cta_action: "generate-message",
    });
  }

  actions.sort((a, b) => a.priority - b.priority);
  const limited = actions.slice(0, 8);

  return Response.json({ actions: limited, total: limited.length });
}
