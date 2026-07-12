import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(__dirname, "../.env.local") });

const BRAND_ID = "68c72c8c-e029-4f21-ae0f-da7da42cec36";

type ReturnBucket = { min: number; max: number; weight: number };

// 60% låg / 25% normal / 10% moderat / 5% "wardrobers"
const BUCKETS: ReturnBucket[] = [
  { min: 0.0, max: 0.15, weight: 0.6 },
  { min: 0.15, max: 0.35, weight: 0.25 },
  { min: 0.35, max: 0.55, weight: 0.1 },
  { min: 0.55, max: 0.8, weight: 0.05 },
];

const RETURNED_TYPES: { value: string; weight: number }[] = [
  { value: "dress", weight: 0.4 },
  { value: "top", weight: 0.35 },
  { value: "jacket", weight: 0.15 },
  { value: "denim", weight: 0.1 },
];

// Aldrig "damaged" — Rodebjer skulle inte skicka trasiga plagg.
const REASONS: { value: string; weight: number }[] = [
  { value: "size", weight: 0.55 },
  { value: "fit", weight: 0.2 },
  { value: "style", weight: 0.1 },
  { value: "color", weight: 0.07 },
  { value: "not-as-expected", weight: 0.05 },
  { value: "changed-mind", weight: 0.03 },
];

// Deterministisk hash → seed så samma kunder alltid hamnar i samma bucket
// (oavsett körordning), vilket håller demo-"hjältekunderna" stabila mellan körningar.
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

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("Supabase env vars saknas");
  const supabase = createClient(supabaseUrl, anonKey);

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name, order_count")
    .eq("brand_id", BRAND_ID);
  if (error) throw error;

  console.log(`Seedar retur-data för ${customers?.length ?? 0} kunder...`);

  let ok = 0;
  let failed = 0;
  const bucketCounts = [0, 0, 0, 0];

  for (const c of customers ?? []) {
    const label = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.id;
    const rng = mulberry32(hashSeed(c.id));

    const bucketIndex = weightedPick(
      BUCKETS.map((b, i) => ({ ...b, i })),
      rng
    ).i;
    bucketCounts[bucketIndex]++;
    const bucket = BUCKETS[bucketIndex];
    const returnRate = Math.round((bucket.min + rng() * (bucket.max - bucket.min)) * 100) / 100;

    const orderCount = c.order_count ?? 0;
    const returnsCount = Math.round(orderCount * returnRate);
    const ordersWithReturns = returnsCount;

    const mostReturnedType = weightedPick(RETURNED_TYPES, rng).value;
    const mostCommonReason = weightedPick(REASONS, rng).value;

    // Lägre return_rate → returen ligger längre tillbaka i tiden.
    const maxDaysAgo = Math.round(90 - returnRate * 60);
    const daysAgo = Math.round(rng() * maxDaysAgo);
    const lastReturnAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();

    const returnStats = {
      return_rate: returnRate,
      returns_count: returnsCount,
      orders_with_returns: ordersWithReturns,
      most_returned_type: mostReturnedType,
      most_common_reason: mostCommonReason,
      last_return_at: lastReturnAt,
    };

    const { error: updateError } = await supabase
      .from("customers")
      .update({ return_stats: returnStats })
      .eq("id", c.id);

    if (updateError) {
      console.error(`✗ ${label}: ${updateError.message}`);
      failed++;
    } else {
      console.log(`✓ ${label}: ${Math.round(returnRate * 100)}% (${returnsCount} returer)`);
      ok++;
    }
  }

  console.log(
    `Klart — ${ok} lyckades, ${failed} misslyckades. Buckets: låg=${bucketCounts[0]} normal=${bucketCounts[1]} moderat=${bucketCounts[2]} wardrobers=${bucketCounts[3]}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
