import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { computeSegmentStats } from "@/lib/segments";
import { CampaignBuilder } from "./CampaignBuilder";

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const { segment } = await searchParams;
  const supabase = await createClient();
  const brandId = await getBrandId();

  const [{ data: brandData }, { data: customersData }, { data: repsData }] =
    await Promise.all([
      supabase.from("brands").select("name").eq("id", brandId).single(),
      supabase
        .from("customers")
        .select("email, total_spent, order_count, last_order_at, return_stats")
        .eq("brand_id", brandId),
      supabase
        .from("sales_reps")
        .select("id, name, email, color")
        .eq("brand_id", brandId)
        .order("name"),
    ]);

  const brandName = (brandData as { name: string } | null)?.name ?? "varumärket";
  const customers = (customersData ?? []) as {
    email: string;
    total_spent: number | null;
    order_count: number | null;
    last_order_at: string | null;
    return_stats: { return_rate: number; returns_count: number } | null;
  }[];
  const salesReps = (repsData ?? []) as {
    id: string;
    name: string;
    email: string | null;
    color: string;
  }[];

  const segments = computeSegmentStats(customers);

  return (
    <CampaignBuilder
      brandName={brandName}
      segments={segments}
      salesReps={salesReps}
      initialSegmentType={segment}
    />
  );
}
