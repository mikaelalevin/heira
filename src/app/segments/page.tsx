import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { computeSegmentStats, RODEBJER_SEGMENT_IMAGES } from "@/lib/segments";

export default async function SegmentsPage() {
  const supabase = await createClient();
  const brandId = await getBrandId();

  const [{ data: brandData }, { data: customersData }] = await Promise.all([
    supabase.from("brands").select("slug").eq("id", brandId).single(),
    supabase
      .from("customers")
      .select("email, total_spent, order_count, last_order_at, return_stats")
      .eq("brand_id", brandId),
  ]);

  const brand = brandData as { slug: string } | null;
  const isRodebjer =
    brand?.slug === "rodebjer" || process.env.NEXT_PUBLIC_BRAND_MODE === "rodebjer";

  const customers = (customersData ?? []) as {
    email: string;
    total_spent: number | null;
    order_count: number | null;
    last_order_at: string | null;
    return_stats: { return_rate: number; returns_count: number } | null;
  }[];

  const segments = computeSegmentStats(customers);

  const ink = "#1A1614";
  const inkMuted = "#8A6E55";
  const inkSoft = "#5A4232";
  const border = "#DDD0B5";

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-9">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-fraunces), serif",
              fontWeight: 400,
              fontSize: 34,
              letterSpacing: "-0.01em",
              color: ink,
            }}
          >
            Segment
          </h1>
          <p className="mt-1.5" style={{ color: inkMuted, fontSize: 14 }}>
            {segments.filter((s) => s.customer_count > 0).length} aktiva segment · uppdateras automatiskt baserat på kundbeteende.
          </p>
        </div>
        <div className="flex gap-2.5">
          <a
            href="/import"
            className="px-4 py-[9px] rounded-lg text-[13px] font-medium"
            style={{
              background: "transparent",
              color: ink,
              border: `1px solid ${border}`,
              fontFamily: "inherit",
              textDecoration: "none",
            }}
          >
            Importera från Klaviyo
          </a>
          <a
            href="/campaigns"
            className="flex items-center gap-1.5 px-4 py-[9px] rounded-lg text-[13px] font-medium"
            style={{
              background: ink,
              color: "#FAF5EB",
              border: "none",
              fontFamily: "inherit",
              textDecoration: "none",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
            </svg>
            Skapa kampanj
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {segments.map((seg) => {
          const heroImage = isRodebjer ? RODEBJER_SEGMENT_IMAGES[seg.type] : null;

          return (
          <a
            key={seg.type}
            href={`/segments/${seg.type}`}
            className="flex flex-col rounded-2xl overflow-hidden transition-all"
            style={{
              background: "#FFFFFF",
              border: `1px solid ${border}`,
              textDecoration: "none",
              opacity: seg.customer_count === 0 ? 0.45 : 1,
            }}
          >
            <div
              className="relative overflow-hidden"
              style={{
                height: heroImage ? 210 : 110,
                background: heroImage ? `url('${heroImage}') center 20% / cover` : seg.gradient,
              }}
            >
              {!heroImage && (
                <div
                  className="absolute inset-0"
                  style={{
                    opacity: 0.15,
                    backgroundImage:
                      "radial-gradient(circle at 30% 30%, white 0.5px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                />
              )}
              <span
                className="absolute text-[10.5px] uppercase tracking-[0.08em] font-semibold px-[9px] py-[4px] rounded-xl"
                style={{
                  top: 14,
                  left: 16,
                  background: "rgba(255,255,255,0.92)",
                  color: ink,
                  ...(heroImage ? { backdropFilter: "blur(8px)" } : {}),
                }}
              >
                {seg.tag}
              </span>
              {seg.customer_count === 0 && (
                <span
                  className="absolute text-[10px] uppercase tracking-[0.06em] font-medium px-2.5 py-1 rounded-lg"
                  style={{
                    top: 14,
                    right: 16,
                    background: "rgba(0,0,0,0.35)",
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  Tomt
                </span>
              )}
            </div>
            <div className="p-5">
              <div
                style={{
                  fontFamily: "var(--font-fraunces), serif",
                  fontSize: 19,
                  fontWeight: 500,
                  color: ink,
                }}
              >
                {seg.name}
              </div>
              <div className="mt-1 text-[13px]" style={{ color: inkSoft }}>
                {seg.description}
              </div>
              <div
                className="flex justify-between mt-4 pt-3.5"
                style={{ borderTop: `1px solid ${border}` }}
              >
                <div>
                  <div
                    className="text-[10.5px] uppercase tracking-[0.08em] font-medium"
                    style={{ color: inkMuted }}
                  >
                    Kunder
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-fraunces), serif",
                      fontSize: 17,
                      color: ink,
                      marginTop: 2,
                    }}
                  >
                    {seg.customer_count > 0 ? seg.customer_count.toLocaleString("sv") : "–"}
                  </div>
                </div>
                <div>
                  <div
                    className="text-[10.5px] uppercase tracking-[0.08em] font-medium"
                    style={{ color: inkMuted }}
                  >
                    Snitt köpvärde
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-fraunces), serif",
                      fontSize: 17,
                      color: ink,
                      marginTop: 2,
                    }}
                  >
                    {seg.avg_spent > 0 ? seg.avg_spent.toLocaleString("sv") + " kr" : "–"}
                  </div>
                </div>
                <div>
                  <div
                    className="text-[10.5px] uppercase tracking-[0.08em] font-medium"
                    style={{ color: inkMuted }}
                  >
                    Aktiva
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-fraunces), serif",
                      fontSize: 17,
                      color:
                        seg.active_pct >= 70
                          ? "#6B7A63"
                          : seg.active_pct >= 30
                          ? ink
                          : "#C45224",
                      marginTop: 2,
                    }}
                  >
                    {seg.customer_count > 0 ? seg.active_pct + "%" : "–"}
                  </div>
                </div>
              </div>
            </div>
          </a>
          );
        })}
      </div>
    </div>
  );
}
