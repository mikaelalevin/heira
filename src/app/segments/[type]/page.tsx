import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { getMoodGradient } from "@/lib/mood-gradients";
import {
  filterSegment,
  SEGMENT_META,
  type SegmentType,
  type CustomerForSegment,
} from "@/lib/segments";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_TYPES = Object.keys(SEGMENT_META) as SegmentType[];

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const inkSoft = "#5A4232";
const border = "#DDD0B5";
const bg = "#FAF5EB";
const warm = "#F2E8D0";
const card = "#FFFFFF";

const AVATAR_COLORS = ["#D9896A", "#A8B5A0", "#C9A961", "#B47A75", "#6B4F5B", "#6B7A63"];

const SEGMENT_AI_SUGGESTION: Record<SegmentType, string> = {
  vip: "Bjud in till en exklusiv förhandsvisning av nästa kollektion — VIP-kunder konverterar 3× bättre på preview-erbjudanden än öppna kampanjer. Skicka inbjudan minst 10 dagar innan lansering.",
  stammisar: "En personlig 'tack för din lojalitet'-kampanj nästa vecka kan konvertera upp till 68% av detta segment till ytterligare ett köp. Undvik generell rabatt — de handlar redan utan incitament.",
  "vanner-familj": "Säsongspåminnelse med personlig hälsning fungerar bättre än kampanjerbjudanden för detta segment. Dessa kunder reagerar på relation, inte rabatter — håll tonen varm och informell.",
  nya: "Skicka ett välkomstmail inom 48 timmar med produktrekommendationer baserade på första köpet. Chansen för ett andra köp minskar med 40% efter 14 dagar utan kontakt.",
  inaktiva: "Reaktivering med en stark anledning att återvända — ny kollektion eller limiterat erbjudande — ökar konverteringschansen 2× jämfört med generella rabatter. Timing: de närmaste 30 dagarna.",
  "pa-vag-bort": "Kritiskt fönster: dessa kunder är fortfarande nåbara men håller på att glömma varumärket. En 'vi saknar dig'-kampanj bör skickas inom 7 dagar för bäst effekt.",
};

interface AIPrediction {
  date?: string;
  product?: string;
  confidence?: number;
  daysUntil?: number;
}

interface CustomerRow extends CustomerForSegment {
  id: string;
  first_name: string | null;
  last_name: string | null;
  order_count: number | null;
  last_order_at: string | null;
  ai_prediction: AIPrediction | null;
}

export default async function SegmentDetailPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;

  const supabase = await createClient();
  const brandId = await getBrandId();

  let meta: { name: string; description: string; gradient: string; tag: string };
  let aiSuggestion: string;
  let segmentCustomers: CustomerRow[];

  if (UUID_RE.test(type)) {
    const { data: segmentRow } = await supabase
      .from("segments")
      .select("id, name, description, mood_gradient, ai_suggestion")
      .eq("id", type)
      .eq("brand_id", brandId)
      .maybeSingle();
    if (!segmentRow) notFound();

    const { data: memberships } = await supabase
      .from("segment_memberships")
      .select("customer_id")
      .eq("segment_id", type);
    const customerIds = (memberships ?? []).map((m) => m.customer_id as string);

    const { data: customersData } =
      customerIds.length > 0
        ? await supabase
            .from("customers")
            .select("id, email, first_name, last_name, total_spent, order_count, last_order_at, ai_prediction")
            .in("id", customerIds)
            .order("total_spent", { ascending: false })
        : { data: [] as CustomerRow[] };

    segmentCustomers = (customersData ?? []) as CustomerRow[];
    meta = {
      name: segmentRow.name,
      description: segmentRow.description,
      gradient: getMoodGradient(segmentRow.mood_gradient),
      tag: "AI-segment",
    };
    aiSuggestion = segmentRow.ai_suggestion ?? "";
  } else {
    if (!VALID_TYPES.includes(type as SegmentType)) notFound();
    const segmentType = type as SegmentType;
    meta = SEGMENT_META[segmentType];
    aiSuggestion = SEGMENT_AI_SUGGESTION[segmentType];

    const { data: customersData } = await supabase
      .from("customers")
      .select("id, email, first_name, last_name, total_spent, order_count, last_order_at, ai_prediction")
      .eq("brand_id", brandId)
      .order("total_spent", { ascending: false });

    const allCustomers = (customersData ?? []) as CustomerRow[];
    segmentCustomers = filterSegment(segmentType, allCustomers) as CustomerRow[];
  }

  const count = segmentCustomers.length;
  const avgSpent =
    count > 0
      ? Math.round(segmentCustomers.reduce((s, c) => s + (c.total_spent ?? 0), 0) / count)
      : 0;
  const avgOrders =
    count > 0
      ? Math.round((segmentCustomers.reduce((s, c) => s + (c.order_count ?? 0), 0) / count) * 10) / 10
      : 0;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const activePct =
    count > 0
      ? Math.round(
          (segmentCustomers.filter((c) => c.last_order_at && c.last_order_at >= ninetyDaysAgo).length /
            count) *
            100
        )
      : 0;

  return (
    <div className="animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-8">
        <a href="/segments" className="text-[13px]" style={{ color: inkMuted, textDecoration: "none" }}>
          ← Segment
        </a>
      </div>

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden mb-6" style={{ background: meta.gradient }}>
        <div className="relative" style={{ padding: "32px 32px 28px" }}>
          <div
            className="absolute inset-0"
            style={{
              opacity: 0.1,
              backgroundImage: "radial-gradient(circle at 20% 50%, white 0.5px, transparent 1px)",
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
        <div className="grid grid-cols-4 divide-x" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
          {[
            { label: "Kunder", value: count > 0 ? count.toLocaleString("sv") : "–" },
            { label: "Snitt LTV", value: avgSpent > 0 ? avgSpent.toLocaleString("sv") + " kr" : "–" },
            { label: "Snitt ordrar", value: count > 0 ? avgOrders.toString() : "–" },
            { label: "Aktiva", value: count > 0 ? activePct + "%" : "–" },
          ].map((stat) => (
            <div key={stat.label} className="px-6 py-4">
              <div
                className="text-[10.5px] uppercase tracking-[0.1em] font-semibold mb-1"
                style={{ color: "rgba(255,255,255,0.5)" }}
              >
                {stat.label}
              </div>
              <div
                style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 22, color: "white", lineHeight: 1 }}
              >
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI suggestion */}
      <div
        className="rounded-2xl px-6 py-5 mb-6 flex gap-4 items-start"
        style={{ background: card, border: `1px solid ${border}` }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: ink }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] font-semibold mb-1.5" style={{ color: inkMuted }}>
            HEIRA rekommenderar
          </div>
          <p className="text-[13.5px] leading-relaxed" style={{ color: ink }}>
            {aiSuggestion}
          </p>
        </div>
        {count > 0 && (
          <a
            href={`/campaigns?segment=${type}`}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium ml-auto"
            style={{ background: ink, color: bg, textDecoration: "none", fontFamily: "inherit" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
            </svg>
            Skapa kampanj
          </a>
        )}
      </div>

      {/* Customer list header */}
      <div className="flex justify-between items-center mb-4">
        <h2
          style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 20, color: ink }}
        >
          {count > 0 ? `${count} kunder` : "Inga kunder i segmentet"}
        </h2>
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
              [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email;
            const initials = customer.first_name
              ? ((customer.first_name[0] ?? "") + (customer.last_name?.[0] ?? "")).toUpperCase()
              : customer.email.slice(0, 2).toUpperCase();
            const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const daysSince = customer.last_order_at
              ? Math.round((Date.now() - new Date(customer.last_order_at).getTime()) / 86_400_000)
              : null;
            const isActive = customer.last_order_at && customer.last_order_at >= ninetyDaysAgo;
            const pred = customer.ai_prediction;

            return (
              <a
                key={customer.id}
                href={`/customers/${customer.id}`}
                className="flex items-center gap-4 px-6 py-4"
                style={{
                  borderBottom: i < segmentCustomers.length - 1 ? `1px solid ${border}` : "none",
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

                <div className="flex items-center gap-5 flex-shrink-0">
                  <div className="text-right hidden md:block">
                    <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: inkMuted }}>
                      Ordrar
                    </div>
                    <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 15, color: ink }}>
                      {customer.order_count ?? 0}
                    </div>
                  </div>

                  <div className="text-right hidden md:block">
                    <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: inkMuted }}>
                      LTV
                    </div>
                    <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 15, color: ink }}>
                      {(customer.total_spent ?? 0).toLocaleString("sv")} kr
                    </div>
                  </div>

                  {pred?.product && (
                    <div className="text-right hidden lg:block max-w-[160px]">
                      <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: inkMuted }}>
                        Nästa köp
                      </div>
                      <div className="text-[12px] truncate" style={{ color: inkSoft }}>
                        {pred.product}
                      </div>
                      {pred.confidence && (
                        <div className="text-[11px] font-semibold" style={{ color: "#6B7A63" }}>
                          {pred.confidence}% sannolikhet
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-right">
                    <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: inkMuted }}>
                      Senaste köp
                    </div>
                    <div
                      className="text-[13px] font-medium"
                      style={{
                        color: isActive ? "#6B7A63" : daysSince && daysSince > 180 ? "#C45224" : inkSoft,
                      }}
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
            <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 17, color: ink }}>
              Nå {count} kunder med ett riktat mejl
            </div>
            <p className="text-[13px] mt-1" style={{ color: inkSoft }}>
              HEIRA skriver kampanjinnehållet åt dig baserat på segmentet.
            </p>
          </div>
          <a
            href={`/campaigns?segment=${type}`}
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
