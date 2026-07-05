import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import {
  filterSegment,
  SEGMENT_META,
  type SegmentType,
  type CustomerForSegment,
} from "@/lib/segments";

const VALID_TYPES = Object.keys(SEGMENT_META) as SegmentType[];

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const inkSoft = "#5A4232";
const border = "#DDD0B5";
const bg = "#FAF5EB";
const warm = "#F2E8D0";
const card = "#FFFFFF";

const AVATAR_COLORS = ["#D9896A", "#A8B5A0", "#C9A961", "#B47A75", "#6B4F5B", "#6B7A63"];

interface CustomerRow extends CustomerForSegment {
  id: string;
  first_name: string | null;
  last_name: string | null;
  order_count: number | null;
  last_order_at: string | null;
}

export default async function SegmentDetailPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;

  if (!VALID_TYPES.includes(type as SegmentType)) notFound();
  const segmentType = type as SegmentType;
  const meta = SEGMENT_META[segmentType];

  const supabase = await createClient();
  const brandId = await getBrandId();

  const { data: customersData } = await supabase
    .from("customers")
    .select("id, email, first_name, last_name, total_spent, order_count, last_order_at")
    .eq("brand_id", brandId)
    .order("total_spent", { ascending: false });

  const allCustomers = (customersData ?? []) as CustomerRow[];
  const segmentCustomers = filterSegment(segmentType, allCustomers) as CustomerRow[];

  const count = segmentCustomers.length;
  const avgSpent =
    count > 0
      ? Math.round(segmentCustomers.reduce((s, c) => s + (c.total_spent ?? 0), 0) / count)
      : 0;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const activePct =
    count > 0
      ? Math.round(
          (segmentCustomers.filter((c) => c.last_order_at && c.last_order_at >= ninetyDaysAgo)
            .length /
            count) *
            100
        )
      : 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <a
          href="/segments"
          className="text-[13px]"
          style={{ color: inkMuted, textDecoration: "none" }}
        >
          ← Segment
        </a>
      </div>

      {/* Hero */}
      <div
        className="rounded-2xl overflow-hidden mb-6"
        style={{ background: meta.gradient }}
      >
        <div className="relative" style={{ padding: "32px 32px 28px" }}>
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.1,
              backgroundImage:
                "radial-gradient(circle at 20% 50%, white 0.5px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          />
          <div className="relative">
            <span
              className="inline-block text-[10.5px] uppercase tracking-[0.1em] font-semibold px-2.5 py-1 rounded-lg mb-3"
              style={{ background: "rgba(255,255,255,0.9)", color: ink }}
            >
              {meta.tag}
            </span>
            <h1
              style={{
                fontFamily: "var(--font-fraunces), serif",
                fontWeight: 400,
                fontSize: 34,
                letterSpacing: "-0.01em",
                color: "white",
                lineHeight: 1.1,
              }}
            >
              {meta.name}
            </h1>
            <p className="mt-2 text-[14px]" style={{ color: "rgba(255,255,255,0.7)" }}>
              {meta.description}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div
          className="grid grid-cols-3 divide-x"
          style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}
        >
          {[
            { label: "Kunder", value: count > 0 ? count.toLocaleString("sv") : "–" },
            {
              label: "Snitt köpvärde",
              value: avgSpent > 0 ? avgSpent.toLocaleString("sv") + " kr" : "–",
            },
            { label: "Aktiva", value: count > 0 ? activePct + "%" : "–" },
          ].map((stat) => (
            <div key={stat.label} className="px-7 py-4">
              <div
                className="text-[10.5px] uppercase tracking-[0.1em] font-semibold mb-1"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {stat.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-fraunces), serif",
                  fontSize: 22,
                  color: "white",
                  lineHeight: 1,
                }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      <div className="flex justify-between items-center mb-5">
        <h2
          style={{
            fontFamily: "var(--font-fraunces), serif",
            fontWeight: 400,
            fontSize: 20,
            color: ink,
          }}
        >
          {count > 0 ? `${count} kunder` : "Inga kunder i segmentet"}
        </h2>
        {count > 0 && (
          <a
            href={`/campaigns?segment=${segmentType}`}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium"
            style={{ background: ink, color: bg, textDecoration: "none", fontFamily: "inherit" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
            Skapa kampanj →
          </a>
        )}
      </div>

      {count === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3"
          style={{ background: card, border: `1px solid ${border}` }}
        >
          <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, color: ink }}>
            Inga kunder just nu
          </div>
          <p className="text-[13px]" style={{ color: inkMuted }}>
            Segmentet uppdateras automatiskt när kunder uppfyller kriterierna.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: card, border: `1px solid ${border}` }}>
          {segmentCustomers.map((customer, i) => {
            const name =
              [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
              customer.email;
            const initials = customer.first_name
              ? (
                  (customer.first_name[0] ?? "") + (customer.last_name?.[0] ?? "")
                ).toUpperCase()
              : customer.email.slice(0, 2).toUpperCase();
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const daysSince = customer.last_order_at
              ? Math.round(
                  (Date.now() - new Date(customer.last_order_at).getTime()) / 86_400_000
                )
              : null;
            const isActive = customer.last_order_at && customer.last_order_at >= ninetyDaysAgo;

            return (
              <a
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="flex items-center gap-4 px-6 py-4"
                style={{
                  borderBottom:
                    i < segmentCustomers.length - 1 ? `1px solid ${border}` : "none",
                  textDecoration: "none",
                  display: "flex",
                }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, fontSize: 13 }}
                >
                  {initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold truncate" style={{ color: ink }}>
                    {name}
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: inkMuted }}>
                    {customer.email}
                  </div>
                </div>

                <div className="flex items-center gap-6 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: inkMuted }}>
                      Ordrar
                    </div>
                    <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 15, color: ink }}>
                      {customer.order_count ?? 0}
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: inkMuted }}>
                      Totalt
                    </div>
                    <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 15, color: ink }}>
                      {(customer.total_spent ?? 0).toLocaleString("sv")} kr
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: inkMuted }}>
                      Senaste köp
                    </div>
                    <div
                      className="text-[13px] font-medium"
                      style={{ color: isActive ? "#6B7A63" : daysSince && daysSince > 180 ? "#C45224" : inkSoft }}
                    >
                      {daysSince !== null
                        ? daysSince === 0
                          ? "Idag"
                          : `${daysSince} dagar sedan`
                        : "–"}
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Bottom CTA */}
      {count > 0 && (
        <div
          className="rounded-2xl p-6 mt-5 flex items-center justify-between gap-6"
          style={{ background: warm, border: `1px solid ${border}` }}
        >
          <div>
            <div
              style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 17, color: ink }}
            >
              Nå {count} kunder med ett riktat mejl
            </div>
            <p className="text-[13px] mt-1" style={{ color: inkSoft }}>
              HEIRA skriver kampanjinnehållet åt dig baserat på segmentet.
            </p>
          </div>
          <a
            href={`/campaigns?segment=${segmentType}`}
            className="flex items-center gap-1.5 px-5 py-3 rounded-xl text-[13px] font-medium flex-shrink-0"
            style={{ background: ink, color: bg, textDecoration: "none", fontFamily: "inherit" }}
          >
            Skapa kampanj →
          </a>
        </div>
      )}
    </div>
  );
}
