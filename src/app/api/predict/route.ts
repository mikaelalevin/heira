import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json() as { customer_id?: string };
  const { customer_id } = body;
  if (!customer_id) return Response.json({ error: "customer_id krävs" }, { status: 400 });

  const brandId = await getBrandId();
  if (!brandId) return Response.json({ error: "Inget varumärke hittades" }, { status: 404 });

  const { data: brandsData } = await supabase
    .from("brands")
    .select("id, name")
    .eq("id", brandId)
    .limit(1);

  const brand = (brandsData?.[0] as { id: string; name: string } | undefined);
  if (!brand) return Response.json({ error: "Inget varumärke hittades" }, { status: 404 });

  const [{ data: customerData }, { data: ordersData }, { data: sessionsData }, { data: productsData }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, email, first_name, last_name, total_spent, order_count, last_order_at, notes")
      .eq("id", customer_id)
      .eq("brand_id", brand.id)
      .single(),
    supabase
      .from("orders")
      .select("total, created_at, items")
      .eq("customer_id", customer_id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("web_sessions")
      .select("started_at, products_viewed")
      .eq("customer_id", customer_id)
      .order("started_at", { ascending: false })
      .limit(5),
    supabase
      .from("products")
      .select("sku, name, category, product_type, price_sek, mood_gradient")
      .eq("brand_id", brand.id),
  ]);

  if (!customerData) return Response.json({ error: "Kund hittades inte" }, { status: 404 });

  const products = (productsData ?? []) as {
    sku: string | null; name: string; category: string | null;
    product_type: string | null; price_sek: number | null; mood_gradient: string | null;
  }[];

  if (products.length === 0) {
    return Response.json(
      { error: "Ingen produktkatalog hittades för varumärket — kör npm run seed:rodebjer först" },
      { status: 400 }
    );
  }

  const customer = customerData as {
    email: string; first_name: string | null; last_name: string | null;
    total_spent: number | null; order_count: number | null;
    last_order_at: string | null; notes: string | null;
  };

  const orders = (ordersData ?? []) as { total: number; created_at: string; items: unknown[] }[];
  const sessions = (sessionsData ?? []) as { started_at: string; products_viewed: unknown[] }[];

  const name = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email;

  const ordersText = orders.length > 0
    ? orders.map((o, i) => {
        const itemList = Array.isArray(o.items)
          ? o.items.map((item) => {
              if (typeof item === "object" && item !== null) {
                const it = item as Record<string, unknown>;
                return String(it.name ?? it.title ?? it.product_name ?? "");
              }
              return String(item);
            }).filter(Boolean).join(", ")
          : "";
        return `${i + 1}. ${new Date(o.created_at).toLocaleDateString("sv-SE")} — ${o.total} kr${itemList ? ` (${itemList})` : ""}`;
      }).join("\n")
    : "Inga ordrar ännu";

  const sessionsText = sessions.length > 0
    ? sessions.flatMap((s) => {
        const products = Array.isArray(s.products_viewed)
          ? s.products_viewed.map((p) => {
              if (typeof p === "object" && p !== null) {
                const prod = p as Record<string, unknown>;
                return String(prod.name ?? prod.title ?? "");
              }
              return String(p);
            }).filter(Boolean).join(", ")
          : "";
        return products ? [`${new Date(s.started_at).toLocaleDateString("sv-SE")}: ${products}`] : [];
      }).join("\n") || "Inga produkter tittade på"
    : "Ingen webbaktivitet";

  const today = new Date().toLocaleDateString("sv-SE");

  const catalogText = products
    .map((p) => `SKU:${p.sku} — ${p.name} | ${p.product_type ?? p.category ?? "okänd typ"} | ${p.price_sek ?? "?"} kr`)
    .join("\n");

  const prompt = `Du är ett AI-system för ${brand.name}, ett mode/beauty-varumärke. Analysera kunddata och prediktera nästa köp.

KUND: ${name}
Total spenderat: ${(customer.total_spent ?? 0).toLocaleString("sv")} kr
Antal köp: ${customer.order_count ?? 0}
Senaste order: ${customer.last_order_at ? new Date(customer.last_order_at).toLocaleDateString("sv-SE") : "okänt"}${customer.notes ? `\nAnteckningar: ${customer.notes}` : ""}

ORDERHISTORIK (senaste ${orders.length}):
${ordersText}

WEBBAKTIVITET:
${sessionsText}

PRODUKTKATALOG:
${catalogText}

Idag: ${today}

Välj en produkt från katalogen ovan som denna kund troligt köper härnäst, baserat på deras historik. Returnera exakt produktens SKU och namn från katalogen — hitta inte på egna produkter. Motivera valet i en mening som refererar till kundens tidigare köp.

Svara ENBART med ett JSON-objekt, ingen annan text:
{
  "sku": "<exakt SKU från katalogen ovan>",
  "name": "<exakt produktnamn från katalogen ovan>",
  "daysUntil": <heltal 1-90>,
  "confidence": <heltal 40-96>,
  "reason": "<1 mening på svenska som refererar till kundens tidigare köp>"
}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Ogiltigt svar från AI");

    const raw = JSON.parse(jsonMatch[0]) as {
      sku?: unknown;
      name?: unknown;
      daysUntil?: unknown;
      confidence?: unknown;
      reason?: unknown;
    };

    if (typeof raw.sku !== "string" || typeof raw.daysUntil !== "number") {
      throw new Error("Saknade fält i AI-svar");
    }

    const matchedProduct =
      products.find((p) => p.sku === raw.sku) ??
      products.find((p) => p.name === raw.name);

    if (!matchedProduct) {
      throw new Error("AI valde en produkt som inte finns i katalogen — försök igen");
    }

    const predictedDate = new Date();
    predictedDate.setDate(predictedDate.getDate() + raw.daysUntil);
    const dateStr = predictedDate.toLocaleDateString("sv-SE", { day: "numeric", month: "short" }).replace(".", "");

    const prediction = {
      product: matchedProduct.name,
      predicted_product_sku: matchedProduct.sku,
      category: matchedProduct.category,
      price_sek: matchedProduct.price_sek,
      mood_gradient: matchedProduct.mood_gradient,
      date: dateStr,
      daysUntil: raw.daysUntil,
      confidence: Math.min(96, Math.max(40, typeof raw.confidence === "number" ? raw.confidence : 60)),
      reason: typeof raw.reason === "string" ? raw.reason : "",
      generatedAt: new Date().toISOString(),
    };

    await supabase
      .from("customers")
      .update({ ai_prediction: prediction, ai_prediction_at: prediction.generatedAt })
      .eq("id", customer_id);

    return Response.json({ prediction });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Okänt fel";
    const isKeyError = msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("authentication");
    return Response.json(
      { error: isKeyError ? "ANTHROPIC_API_KEY saknas eller är ogiltig — lägg till en riktig nyckel i .env.local" : `Kunde inte generera prediktion: ${msg}` },
      { status: 500 }
    );
  }
}
