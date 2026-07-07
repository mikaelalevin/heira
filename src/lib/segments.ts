export type SegmentType =
  | "vip"
  | "stammisar"
  | "vanner-familj"
  | "nya"
  | "inaktiva"
  | "pa-vag-bort";

export const SEGMENT_META: Record<
  SegmentType,
  { name: string; description: string; gradient: string; tag: string }
> = {
  vip: {
    name: "Darlings",
    description: "Dina bästa kunder med högst köpvärde och flest ordrar.",
    gradient: "linear-gradient(135deg, #C9A961 0%, #8A7038 100%)",
    tag: "Topp 5%",
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
    description: "Har inte handlat på över 90 dagar men har historik.",
    gradient: "linear-gradient(135deg, #C4B8A8 0%, #9A8878 100%)",
    tag: "Inaktiva",
  },
  "pa-vag-bort": {
    name: "På väg bort",
    description: "Var aktiva för 3–6 månader sedan. Behöver en anledning att komma tillbaka.",
    gradient: "linear-gradient(135deg, #7D2027 0%, #4A1218 100%)",
    tag: "Churn-risk",
  },
};

export interface CustomerForSegment {
  email: string;
  total_spent: number | null;
  order_count: number | null;
  last_order_at: string | null;
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
  const oneEightyDaysAgo = new Date(now - 180 * 86_400_000).toISOString();

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
    case "pa-vag-bort":
      return customers.filter(
        (c) =>
          !!c.last_order_at &&
          c.last_order_at < ninetyDaysAgo &&
          c.last_order_at >= oneEightyDaysAgo
      );
    case "vanner-familj":
      return customers.filter((c) => c.email.endsWith("@icloud.com"));
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
