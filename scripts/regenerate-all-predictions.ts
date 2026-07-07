import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(__dirname, "../.env.local") });

const BRAND_ID = "68c72c8c-e029-4f21-ae0f-da7da42cec36";
const API_URL = process.env.PREDICT_API_URL ?? "http://localhost:3000/api/predict";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("Supabase env vars saknas");
  const supabase = createClient(supabaseUrl, anonKey);

  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, first_name, last_name")
    .eq("brand_id", BRAND_ID);
  if (error) throw error;

  console.log(`Regenererar AI-prediktion för ${customers?.length ?? 0} kunder...`);

  let ok = 0;
  let failed = 0;
  for (const c of customers ?? []) {
    const label = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.id;
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: c.id }),
      });
      const data = (await res.json()) as { prediction?: { product: string }; error?: string };
      if (!res.ok || data.error) {
        console.error(`✗ ${label}: ${data.error}`);
        failed++;
      } else {
        console.log(`✓ ${label}: ${data.prediction?.product}`);
        ok++;
      }
    } catch (err) {
      console.error(`✗ ${label}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
    await sleep(300);
  }

  console.log(`Klart — ${ok} lyckades, ${failed} misslyckades.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
