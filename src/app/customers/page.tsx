import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { CustomersTable } from "./CustomersTable";

export default async function CustomersPage() {
  const supabase = await createClient();
  const brandId = await getBrandId();

  const [{ data: repsData }, { data: customersData, count }, { data: segmentsData }] = await Promise.all([
    supabase
      .from("sales_reps")
      .select("id, name, color")
      .eq("brand_id", brandId)
      .order("name"),
    supabase
      .from("customers")
      .select("id, email, first_name, last_name, total_spent, order_count, sales_rep_id, phone, last_order_at, created_at, ai_prediction", { count: "exact" })
      .eq("brand_id", brandId)
      .order("total_spent", { ascending: false })
      .limit(100),
    supabase
      .from("segments")
      .select("id, name")
      .eq("brand_id", brandId)
      .order("name"),
  ]);

  const salesReps = (repsData ?? []) as { id: string; name: string; color: string }[];
  const segments = (segmentsData ?? []) as { id: string; name: string }[];
  const customers = (customersData ?? []) as {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    total_spent: number | null;
    order_count: number | null;
    sales_rep_id: string | null;
    phone: string | null;
    last_order_at: string | null;
    created_at: string | null;
    ai_prediction: Record<string, unknown> | null;
  }[];

  const customerIds = customers.map((c) => c.id);
  const { data: membershipsData } = customerIds.length > 0
    ? await supabase
        .from("segment_memberships")
        .select("customer_id, segment_id")
        .in("customer_id", customerIds)
    : { data: [] };

  const memberships = (membershipsData ?? []) as { customer_id: string; segment_id: string }[];
  const membershipMap: Record<string, string[]> = {};
  for (const m of memberships) {
    if (!membershipMap[m.customer_id]) membershipMap[m.customer_id] = [];
    membershipMap[m.customer_id].push(m.segment_id);
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-9">
        <div>
          <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 34, letterSpacing: "-0.01em", color: "#1A1614" }}>
            Kunder
          </h1>
        </div>
        <div className="flex gap-2.5">
          <a
            href="/onboarding"
            className="px-4 py-[9px] rounded-lg text-[13px] font-medium"
            style={{ background: "transparent", color: "#1A1614", border: "1px solid #DDD0B5", fontFamily: "inherit", textDecoration: "none" }}
          >
            Importera CSV
          </a>
          <a
            href="/customers/ny"
            className="px-4 py-[9px] rounded-lg text-[13px] font-medium"
            style={{ background: "#1A1614", color: "#FAF5EB", textDecoration: "none", fontFamily: "inherit" }}
          >
            + Lägg till kund
          </a>
        </div>
      </div>

      <CustomersTable
        realCustomers={customers}
        salesReps={salesReps}
        segments={segments}
        initialMemberships={membershipMap}
        totalCount={count ?? 0}
      />
    </div>
  );
}
