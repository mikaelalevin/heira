import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { Sidebar } from "./Sidebar";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const brandId = await getBrandId();

  const { data: brandsData } = await supabase
    .from("brands")
    .select("id, name")
    .eq("id", brandId)
    .limit(1);

  const brandData = (brandsData?.[0] ?? null) as { id: string; name: string } | null;

  const { data: repsData } = brandData
    ? await supabase
        .from("sales_reps")
        .select("id, name, color")
        .eq("brand_id", brandData.id)
        .order("name")
    : { data: [] };

  const salesReps = (repsData ?? []) as { id: string; name: string; color: string }[];

  const initials = user?.email
    ? user.email.split("@")[0].slice(0, 2).toUpperCase()
    : "–";

  return (
    <div className="flex min-h-screen" style={{ background: "#FAF5EB" }}>
      <Sidebar
        brandName={brandData?.name ?? "HEIRA"}
        userInitials={initials}
        userEmail={user?.email ?? ""}
        salesReps={salesReps}
      />
      <main className="flex-1 min-w-0 pt-[52px] md:pt-0 px-4 py-6 md:px-12 md:py-8 pb-16" style={{ maxWidth: 1400 }}>
        {children}
      </main>
    </div>
  );
}
