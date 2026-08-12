import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { CustomerDetail } from "./CustomerDetail";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const brandId = await getBrandId();

  const [
    { data: customerData },
    { data: repsData },
    { data: ordersData },
    { data: sessionsData },
    { data: brandData },
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id, email, first_name, last_name, phone, total_spent, order_count, notes, sales_rep_id, last_order_at, last_visit_at, total_visits, ai_prediction, ai_prediction_at, return_stats")
      .eq("id", id)
      .eq("brand_id", brandId)
      .single(),
    supabase
      .from("sales_reps")
      .select("id, name, color, email")
      .eq("brand_id", brandId)
      .order("name"),
    supabase
      .from("orders")
      .select("id, total, created_at, items, shopify_order_id, channel")
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("web_sessions")
      .select("id, started_at, pageviews, products_viewed, duration_seconds")
      .eq("customer_id", id)
      .order("started_at", { ascending: false })
      .limit(10),
    supabase
      .from("brands")
      .select("name")
      .eq("id", brandId)
      .single(),
  ]);

  if (!customerData) notFound();

  const customer = customerData as {
    id: string; email: string; first_name: string | null; last_name: string | null;
    phone: string | null; total_spent: number | null; order_count: number | null;
    notes: string | null; sales_rep_id: string | null;
    last_order_at: string | null; last_visit_at: string | null; total_visits: number | null;
    ai_prediction: Record<string, unknown> | null; ai_prediction_at: string | null;
    return_stats: Record<string, unknown> | null;
  };

  const salesReps = (repsData ?? []) as { id: string; name: string; color: string; email: string | null }[];

  const orders = (ordersData ?? []) as {
    id: string; total: number; created_at: string;
    items: unknown[]; shopify_order_id: string | null; channel: "in_store" | "online";
  }[];

  const sessions = (sessionsData ?? []) as {
    id: string; started_at: string; pageviews: number;
    products_viewed: unknown[]; duration_seconds: number;
  }[];

  const brandName = (brandData as { name: string } | null)?.name;

  return (
    <CustomerDetail
      customer={customer}
      salesReps={salesReps}
      orders={orders}
      sessions={sessions}
      aiPrediction={customer.ai_prediction}
      brandName={brandName}
    />
  );
}
