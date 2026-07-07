import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(__dirname, "../.env.local") });

const TYPE_TO_MOOD: Record<string, string> = {
  dress: "rose",
  top: "sand",
  body: "sand",
  blazer: "ink",
  jacket: "ink",
  suit: "ink",
  denim: "night",
  scarf: "gold",
  bag: "plum",
  belt: "dust",
};

type FW26Product = {
  name: string;
  full_name: string;
  sku: string;
  category: string;
  price_wholesale_sek: number;
  price_retail_sek: number;
  type: string;
};

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const dataPath = resolve(__dirname, "../../rodebjer-fw26-products.json");
  const products: FW26Product[] = JSON.parse(readFileSync(dataPath, "utf-8"));

  console.log(`Read ${products.length} products from ${dataPath}`);

  let { data: brand } = await supabase
    .from("brands")
    .select("id")
    .or("slug.eq.rodebjer,name.eq.Rodebjer")
    .maybeSingle();

  if (!brand) {
    throw new Error(
      "No brand with slug 'rodebjer' or name 'Rodebjer' found. Create one first (brands.owner_id is required)."
    );
  }

  const rows = products.map((p) => ({
    brand_id: brand.id,
    name: p.full_name,
    sku: p.sku,
    category: p.category,
    product_type: p.type,
    price_sek: p.price_retail_sek,
    price: p.price_retail_sek,
    mood_gradient: TYPE_TO_MOOD[p.type] ?? "sand",
  }));

  const { error, count } = await supabase
    .from("products")
    .upsert(rows, { onConflict: "brand_id,sku", count: "exact" });

  if (error) {
    throw error;
  }

  console.log(`Upserted ${count ?? rows.length} products for brand ${brand.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
