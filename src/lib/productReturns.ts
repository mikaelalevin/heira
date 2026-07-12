import { RETURN_REASON_LABELS } from "@/lib/returns";

// Samma bucket-fördelning som scripts/seed-returns.ts (60% låg / 25% normal / 10% moderat / 5% wardrobers)
const RATE_BUCKETS: { min: number; max: number; weight: number }[] = [
  { min: 0.0, max: 0.15, weight: 0.6 },
  { min: 0.15, max: 0.35, weight: 0.25 },
  { min: 0.35, max: 0.55, weight: 0.1 },
  { min: 0.55, max: 0.8, weight: 0.05 },
];

// Aldrig "damaged" — Rodebjer skulle inte skicka trasiga plagg.
const REASON_WEIGHTS: { value: string; weight: number }[] = [
  { value: "size", weight: 0.55 },
  { value: "fit", weight: 0.2 },
  { value: "style", weight: 0.1 },
  { value: "color", weight: 0.07 },
  { value: "not-as-expected", weight: 0.05 },
  { value: "changed-mind", weight: 0.03 },
];

export interface ProductReturnReason {
  reason: string;
  label: string;
  count: number;
}

export interface ProductReturnStats {
  name: string;
  unitsSold: number;
  returnsCount: number;
  returnRate: number;
  reasons: ProductReturnReason[];
}

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function weightedPick<T extends { weight: number }>(items: T[], rng: () => number): T {
  const r = rng();
  let cum = 0;
  for (const item of items) {
    cum += item.weight;
    if (r < cum) return item;
  }
  return items[items.length - 1];
}

// Deterministisk mock-retur per produkt, baserad på faktiskt sålda enheter. Samma
// seedning som kundnivån (Fix 1) — en produkt hamnar alltid på samma returrate.
export function deriveProductReturns(unitsSoldByName: Record<string, number>): ProductReturnStats[] {
  return Object.entries(unitsSoldByName)
    .map(([name, unitsSold]) => {
      const rng = mulberry32(hashSeed(name));
      const bucket = weightedPick(RATE_BUCKETS, rng);
      const returnRate = Math.round((bucket.min + rng() * (bucket.max - bucket.min)) * 100) / 100;
      const returnsCount = Math.round(unitsSold * returnRate);

      const reasonCounts: Record<string, number> = {};
      for (let i = 0; i < returnsCount; i++) {
        const reason = weightedPick(REASON_WEIGHTS, rng).value;
        reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
      }
      const reasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, label: RETURN_REASON_LABELS[reason] ?? reason, count }))
        .sort((a, b) => b.count - a.count);

      return { name, unitsSold, returnsCount, returnRate, reasons };
    })
    .filter((p) => p.returnsCount > 0)
    .sort((a, b) => b.returnsCount - a.returnsCount);
}
