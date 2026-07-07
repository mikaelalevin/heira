import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(__dirname, "../.env.local") });

const BRAND_ID = "68c72c8c-e029-4f21-ae0f-da7da42cec36";

type CatalogProduct = { sku: string; name: string; price_sek: number };
type OrderItem = { name: string; price: number; quantity: number; sku?: string };

function closestProduct(
  targetPrice: number,
  catalog: CatalogProduct[],
  used: Set<string>
): CatalogProduct {
  const pool = catalog.filter((p) => !used.has(p.sku));
  const candidates = pool.length > 0 ? pool : catalog;
  let best = candidates[0];
  let bestDiff = Math.abs(best.price_sek - targetPrice);
  for (const p of candidates) {
    const diff = Math.abs(p.price_sek - targetPrice);
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  return best;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: productsData, error: productsError } = await supabase
    .from("products")
    .select("sku, name, price_sek")
    .eq("brand_id", BRAND_ID);
  if (productsError) throw productsError;
  const catalog = (productsData ?? []) as CatalogProduct[];
  if (catalog.length === 0) {
    throw new Error("Ingen produktkatalog hittades — kör npm run seed:rodebjer först");
  }

  const { data: customersData, error: customersError } = await supabase
    .from("customers")
    .select("id")
    .eq("brand_id", BRAND_ID);
  if (customersError) throw customersError;
  const customerIds = (customersData ?? []).map((c) => c.id as string);

  const { data: ordersData, error: ordersError } = await supabase
    .from("orders")
    .select("id, items")
    .in("customer_id", customerIds);
  if (ordersError) throw ordersError;

  console.log(`Byter ut artiklar i ${ordersData?.length ?? 0} ordrar mot Rodebjers FW26-katalog...`);

  let updated = 0;
  for (const order of ordersData ?? []) {
    const items = (order.items ?? []) as OrderItem[];
    if (!Array.isArray(items) || items.length === 0) continue;

    const used = new Set<string>();
    const newItems = items.map((item) => {
      const targetPrice = typeof item.price === "number" ? item.price : 1000;
      const match = closestProduct(targetPrice, catalog, used);
      used.add(match.sku);
      return {
        name: match.name,
        sku: match.sku,
        price: match.price_sek,
        quantity: item.quantity ?? 1,
      };
    });

    const { error } = await supabase
      .from("orders")
      .update({ items: newItems })
      .eq("id", order.id);
    if (error) throw error;
    updated++;
  }

  console.log(`Klart — ${updated} ordrar uppdaterade med riktiga Rodebjer-produkter.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
