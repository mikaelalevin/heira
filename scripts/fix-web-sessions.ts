import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(__dirname, "../.env.local") });

const BRAND_ID = "68c72c8c-e029-4f21-ae0f-da7da42cec36";

type CatalogProduct = { sku: string; name: string };
type ViewedProduct = { name: string; sku?: string };

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
    .select("sku, name")
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

  const { data: sessionsData, error: sessionsError } = await supabase
    .from("web_sessions")
    .select("id, products_viewed")
    .in("customer_id", customerIds);
  if (sessionsError) throw sessionsError;

  console.log(`Byter ut visade produkter i ${sessionsData?.length ?? 0} sessioner mot Rodebjers FW26-katalog...`);

  let updated = 0;
  for (const session of sessionsData ?? []) {
    const viewed = (session.products_viewed ?? []) as ViewedProduct[];
    if (!Array.isArray(viewed) || viewed.length === 0) continue;

    const picks = shuffled(catalog).slice(0, viewed.length);
    const newViewed = viewed.map((_, i) => {
      const match = picks[i] ?? catalog[Math.floor(Math.random() * catalog.length)];
      return { name: match.name, sku: match.sku };
    });

    const { error } = await supabase
      .from("web_sessions")
      .update({ products_viewed: newViewed })
      .eq("id", session.id);
    if (error) throw error;
    updated++;
  }

  console.log(`Klart — ${updated} sessioner uppdaterade med riktiga Rodebjer-produkter.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
