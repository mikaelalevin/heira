export type SegmentType =
  | "vip"
  | "stammisar"
  | "vanner-familj"
  | "nya"
  | "inaktiva"
  | "kuratorer";

export const SEGMENT_META: Record<
  SegmentType,
  { name: string; description: string; gradient: string; tag: string }
> = {
  vip: {
    name: "Darlings",
    description: "Rodebjers VIP-kunder med särskild rabatt. Personliga relationer, inte konvertering.",
    gradient: "linear-gradient(135deg, #C9A961 0%, #8A7038 100%)",
    tag: "VIP",
  },
  stammisar: {
    name: "Stammisar",
    description: "Återkommande kunder som handlat minst 2 gånger senaste 90 dagarna.",
    gradient: "linear-gradient(135deg, #D9896A 0%, #C45224 100%)",
    tag: "Mest värdefull",
  },
  "vanner-familj": {
    name: "Vänner & familj",
    description: "Nära relationer med personlig rabatt och tidig tillgång.",
    gradient: "linear-gradient(135deg, #B8A848 0%, #998731 100%)",
    tag: "Friends & family",
  },
  nya: {
    name: "Nya kunder",
    description: "Första köpet gjort — viktigt att skapa ett andra köp snabbt.",
    gradient: "linear-gradient(135deg, #1A1614 0%, #3D3530 100%)",
    tag: "Nya",
  },
  inaktiva: {
    name: "Inaktiva kunder",
    description: "Har inte handlat på över 90 dagar. Rätt återkoppling nu kan väcka relationen igen.",
    gradient: "linear-gradient(135deg, #C4B8A8 0%, #9A8878 100%)",
    tag: "Inaktiva",
  },
  kuratorer: {
    name: "Kuratorer",
    description: "Kunder som noggrant curerar sin garderob genom att prova. Perfekt målgrupp för personlig styling.",
    gradient: "linear-gradient(135deg, #6B4F5B 0%, #3D2C35 100%)",
    tag: "Kurerar noga",
  },
};

export const RODEBJER_SEGMENT_IMAGES: Record<SegmentType, string> = {
  vip: "/rodebjer/segments/darlings.jpg",
  stammisar: "/rodebjer/segments/stammisar.jpg",
  "vanner-familj": "/rodebjer/segments/vanner-familj.jpg",
  nya: "/rodebjer/segments/nya-kunder.jpg",
  inaktiva: "/rodebjer/segments/inaktiva-kunder.jpg",
  // Ingen dedikerad bild vald ännu — svart läderjacka + röd scarf matchar tonen
  // (dramatiskt utan att vara aggressivt).
  kuratorer: "/rodebjer/segments/pa-vag-bort.jpg",
};

export interface CustomerForSegment {
  email: string;
  total_spent: number | null;
  order_count: number | null;
  last_order_at: string | null;
  return_stats?: { return_rate: number; returns_count: number } | null;
}

export const AUTO_SEGMENT_BADGE_COLORS: Record<SegmentType, { bg: string; text: string }> = {
  vip: { bg: "#F2E5C5", text: "#6A4E1B" },
  stammisar: { bg: "#F4DDD9", text: "#6F3F3A" },
  "vanner-familj": { bg: "#E8E3C8", text: "#6A5C1E" },
  nya: { bg: "#DDE7D7", text: "#3E4F36" },
  inaktiva: { bg: "#F2E8D0", text: "#5A4232" },
  kuratorer: { bg: "#E3D5DC", text: "#4D3540" },
};

const AUTO_SEGMENT_PRIORITY: SegmentType[] = [
  "vanner-familj",
  "vip",
  "stammisar",
  "nya",
  "inaktiva",
];

// Returns the single most relevant segment for a customer, used for the
// auto-segment badge shown on customer rows and profiles. Reuses filterSegment
// so it can never drift from the segment definitions above.
export function getPrimarySegment(customer: CustomerForSegment): SegmentType | null {
  for (const type of AUTO_SEGMENT_PRIORITY) {
    if (filterSegment(type, [customer]).length > 0) return type;
  }
  return null;
}

export interface SegmentStats {
  type: SegmentType;
  name: string;
  description: string;
  gradient: string;
  tag: string;
  customer_count: number;
  avg_spent: number;
  active_pct: number;
}

function isVip(c: CustomerForSegment): boolean {
  return (c.total_spent ?? 0) >= 5000 && (c.order_count ?? 0) >= 3;
}

export function filterSegment(
  type: SegmentType,
  customers: CustomerForSegment[]
): CustomerForSegment[] {
  const now = Date.now();
  const ninetyDaysAgo = new Date(now - 90 * 86_400_000).toISOString();

  switch (type) {
    case "vip":
      return customers.filter(isVip);
    case "stammisar":
      return customers.filter(
        (c) =>
          !isVip(c) &&
          (c.order_count ?? 0) >= 2 &&
          !!c.last_order_at &&
          c.last_order_at >= ninetyDaysAgo
      );
    case "nya":
      return customers.filter((c) => (c.order_count ?? 0) === 1);
    case "inaktiva":
      return customers.filter(
        (c) =>
          (c.order_count ?? 0) >= 1 &&
          (!c.last_order_at || c.last_order_at < ninetyDaysAgo)
      );
    case "vanner-familj":
      return customers.filter((c) => c.email.endsWith("@icloud.com"));
    case "kuratorer":
      return customers.filter(
        (c) => !!c.return_stats && c.return_stats.return_rate >= 0.45 && c.return_stats.returns_count >= 2
      );
  }
}

export function computeSegmentStats(
  customers: CustomerForSegment[]
): SegmentStats[] {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000).toISOString();

  return (Object.keys(SEGMENT_META) as SegmentType[]).map((type) => {
    const filtered = filterSegment(type, customers);
    const count = filtered.length;
    const avgSpent =
      count > 0
        ? Math.round(
            filtered.reduce((s, c) => s + (c.total_spent ?? 0), 0) / count
          )
        : 0;
    const activeCount = filtered.filter(
      (c) => c.last_order_at && c.last_order_at >= ninetyDaysAgo
    ).length;
    const activePct = count > 0 ? Math.round((activeCount / count) * 100) : 0;

    return {
      type,
      ...SEGMENT_META[type],
      customer_count: count,
      avg_spent: avgSpent,
      active_pct: activePct,
    };
  });
}
