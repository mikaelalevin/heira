import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { RETURN_TYPE_LABELS } from "@/lib/returns";
import { RODEBJER_STORE_FOOTER, getSignoffName } from "@/lib/messageSignature";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const supabase = await createClient();

  const body = await request.json() as {
    customer_id?: string;
    prediction?: {
      product: string;
      product_type?: string | null;
      date: string;
      daysUntil: number;
      confidence: number;
      reason: string;
    };
    rep_name?: string | null;
    rep_email?: string | null;
  };

  const { customer_id, prediction, rep_name, rep_email } = body;
  if (!customer_id) return Response.json({ error: "customer_id krävs" }, { status: 400 });

  const brandId = await getBrandId();
  if (!brandId) return Response.json({ error: "Inget varumärke hittades" }, { status: 404 });

  const { data: brandsData } = await supabase
    .from("brands")
    .select("id, name, slug")
    .eq("id", brandId)
    .limit(1);

  const brand = brandsData?.[0] as { id: string; name: string; slug: string } | undefined;
  if (!brand) return Response.json({ error: "Inget varumärke hittades" }, { status: 404 });

  const isRodebjer =
    brand.slug === "rodebjer" || process.env.NEXT_PUBLIC_BRAND_MODE === "rodebjer";

  const brandVoiceSection = isRodebjer
    ? `
--- BRAND VOICE: RODEBJER ---
Du skriver som Rodebjer, ett svenskt fashion-varumärke grundat 2000 i New York av Carin Rodebjer. Er kund kallas "the strict hippie" eller "the refined eccentric" — hon är eftertänksam, konstnärlig, inte showig. Ton: poetisk men jordnära. Grundregeln är att grunda poesi i fysisk detalj (material, silhuett, referens) — aldrig hype eller känslor.

REGLER:
1. Kundtilltal: "Kära [förnamn]" på svenska, "Dear [förnamn]" på engelska — aldrig "Hej" eller "Hi"
2. Produkter alltid med "The [Name]"-prefix: "The Karlai", "The Adela" — aldrig bara "Karlai"
3. Beskriv plagg med material och silhuett, inte känslor: "long sleeve jersey i chalky Opulent Rose" — inte "gorgeous must-have"
4. Inga utropstecken, aldrig
5. Inga hype-ord: amazing, incredible, must-have, trendy, VIP, exclusive, deal, save, discount, shop now, limited time
6. Korta stycken, editorial mellanrum
7. Skriv INGEN avslutande hälsningsfras eller signatur — meddelandet ska sluta med sista innehållsmeningen. Signatur och kontaktuppgifter läggs till automatiskt efteråt.
8. Referera till produkten som den typ den faktiskt är — om det är en mössa säg "mössa" eller beskriv den som en accessoar, aldrig som ett plagg. Om typ saknas — beskriv produkten neutralt utan att gissa kategori.

--- VISUAL WORLD (FW26 lookbook) ---
Rodebjers FW26 utspelar sig i Stockholms offentliga rum: granit-fasader, tunnelbanor, kullersten, träd i park. Modellen är eftertänksam, individuell, aldrig glamorös. Kläderna definieras av taktilitet: fluffig mohair, ribbstickat, jacquard-blommor, läder, silke, korrduroj, plaid. Färgpaletten är dov men rik: mossgrön, dov rosa, indigo, cognac, plommon, tegel, off-white.

När du refererar till plagg eller säsong — grunda beskrivningen i:
- Material och textur ("mohair", "silke", "jacquard", "korrduroj")
- Rörelse och draperi ("faller mjukt", "lager på lager")
- Ljus och miljö ("på tunnelbanan hem", "en morgon vid Djurgården")
- Aldrig i trender eller känslor ("must-have", "vackert", "amazing")

Om ett specifikt plagg nämns — anspela på hur det känns att bära det snarare än hur det ser ut:
- Bra: "The Karlai i mohair — den där tyngden runt axlarna innan man går ut i vinden"
- Dåligt: "Vår nya Karlai är så snygg och trendig"

Tillåtna material (hitta aldrig på andra): mohair, silke, jacquard, korrduroj, plaid, alpaca, viskos, bomull, läder.

EXEMPEL PÅ RODEBJER-COPY (från deras egen webshop):
"An everyday layering item referencing dance wear. Long sleeve, tight fitting jersey silhouette in a seasonal chalky Opulent Rose print."

EXEMPEL PÅ EN RODEBJER-MEJL TILL EN KUND:
"Kära Elsa,

The Karlai återkommer för hösten — den här gången i Opulent Rose, med långa ärmar och tumhål för de lagrade dagarna som väntar. Bomullsjersey, gjord i Portugal.

Vi tänkte den kunde bli en av dina."
`
    : "";

  const [{ data: customerData }, { data: ordersData }] = await Promise.all([
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
      .limit(5),
  ]);

  if (!customerData) return Response.json({ error: "Kund hittades inte" }, { status: 404 });

  const customer = customerData as {
    email: string;
    first_name: string | null;
    last_name: string | null;
    total_spent: number | null;
    order_count: number | null;
    last_order_at: string | null;
    notes: string | null;
  };

  const orders = (ordersData ?? []) as { total: number; created_at: string; items: unknown[] }[];

  const firstName = customer.first_name ?? customer.email.split("@")[0];
  const fullName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email;

  const lastItems = orders.slice(0, 3).flatMap((o) => {
    if (!Array.isArray(o.items)) return [];
    return o.items.map((item) => {
      if (typeof item === "object" && item !== null) {
        const it = item as Record<string, unknown>;
        return String(it.name ?? it.title ?? it.product_name ?? "").trim();
      }
      return String(item).trim();
    }).filter(Boolean);
  });

  const lastItemsText = lastItems.length > 0 ? lastItems.slice(0, 4).join(", ") : null;
  const totalSpent = (customer.total_spent ?? 0).toLocaleString("sv");
  const orderCount = customer.order_count ?? 0;
  const daysSinceLast = customer.last_order_at
    ? Math.round((Date.now() - new Date(customer.last_order_at).getTime()) / 86_400_000)
    : null;

  const predProduct = prediction?.product ?? "ett nytt plagg";
  const predType = prediction?.product_type ? RETURN_TYPE_LABELS[prediction.product_type] ?? null : null;
  const predDate = prediction?.date ?? "inom kort";
  const predDays = prediction?.daysUntil ?? 14;
  const predReason = prediction?.reason ?? "";

  const prompt = `Du är säljarens assistent på ${brand.name}, ett mode/beauty-varumärke med sofistikerat och personligt tonläge.

UPPGIFT: Skriv ett kort, personligt utgående meddelande som säljaren ska skicka direkt till kunden. Det ska kännas som att en verklig person skriver — inte ett nyhetsbrev, inte en säljpitch.

KUNDINFO:
- Namn: ${fullName} (tilltala som "${firstName}")
- Totalt spenderat: ${totalSpent} kr
- Antal köp: ${orderCount}
${daysSinceLast !== null ? `- Dagar sedan senaste köp: ${daysSinceLast}` : ""}
${lastItemsText ? `- Senast köpta: ${lastItemsText}` : ""}
${customer.notes ? `- Säljarens anteckning: ${customer.notes}` : ""}

AI-PREDIKTION:
- Kunden förväntas köpa: ${predProduct}${predType ? ` (${predType})` : ""}
- Inom: ${predDays} dagar (ca ${predDate})
${predReason ? `- Anledning: ${predReason}` : ""}
${brandVoiceSection}
INSTRUKTIONER:
- Skriv på svenska, varmt och personligt
- Nämn ett specifikt plagg eller kategori kopplat till prediktionen — naturligt, inte påtvingat
- Referera till produkten som den typ den faktiskt är — om det är en mössa säg "mössa" eller beskriv den som en accessoar, aldrig som ett plagg. Om typ saknas — beskriv produkten neutralt utan att gissa kategori.
- Max 4 meningar — kortare är bättre
- Avsluta med ett konkret nästa steg: boka tid, kom in, ta en titt
${
  isRodebjer
    ? `- Skriv ingen signatur eller avslutningsfras (se regel ovan) — den läggs till automatiskt`
    : `- Signera med säljarens namn: "${rep_name ?? "teamet på " + brand.name}"${rep_email ? ` och e-post: ${rep_email}` : ""}`
}
- Inga emojis, inga utropstecken i onödan
- Känn igen kunden som en stammis om de handlat mer än 2 ggr

Svara ENBART med meddelandet, ingen förklaring, ingen rubrik.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    let text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    if (!text) throw new Error("Tomt svar från AI");

    if (isRodebjer) {
      const signoffName = getSignoffName(rep_name);
      text = [text, signoffName, RODEBJER_STORE_FOOTER].filter(Boolean).join("\n\n");
    }

    return Response.json({ message: text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Okänt fel";
    const isKeyError = msg.toLowerCase().includes("api key") || msg.toLowerCase().includes("authentication");
    return Response.json(
      { error: isKeyError ? "ANTHROPIC_API_KEY saknas eller är ogiltig" : `Kunde inte generera meddelande: ${msg}` },
      { status: 500 }
    );
  }
}
