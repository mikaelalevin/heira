import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { SegmentsClient } from "./SegmentsClient";

interface Segment {
  id: string;
  name: string;
  description: string;
  mood_gradient: string;
  customer_count: number;
  avg_ltv: number;
  ai_suggestion: string;
}

export default async function SegmentsPage() {
  const supabase = await createClient();
  const brandId = await getBrandId();

  const [{ data: segmentsData }, { count: customerCount }] = await Promise.all([
    supabase
      .from("segments")
      .select("id, name, description, mood_gradient, customer_count, avg_ltv, ai_suggestion")
      .eq("brand_id", brandId)
      .order("customer_count", { ascending: false }),
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("brand_id", brandId),
  ]);

  const segments = (segmentsData ?? []) as Segment[];

  return <SegmentsClient segments={segments} customerCount={customerCount ?? 0} />;
}
