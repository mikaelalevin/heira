import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { filterSegment, SEGMENT_META, type SegmentType } from "@/lib/segments";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(request: Request) {
  const body = (await request.json()) as {
    segment_type?: string;
    channel?: string;
    rep_name?: string | null;
  };
  const segment_type = (body.segment_type ?? "stammisar") as SegmentType;
  const channel = body.channel ?? "email";
  const repName = body.rep_name ?? null;

  const supabase = await createClient();
  const brandId = await getBrandId();

  const { data: brandData } = await supabase
    .from("brands")
    .select("name, slug")
    .eq("id", brandId)
    .single();
  const brandName = (brandData as { name: string } | null)?.name ?? "varumärket";
  const brandSlug = (brandData as { slug: string } | null)?.slug ?? "";
  const isRodebjer =
    brandSlug === "rodebjer" || process.env.NEXT_PUBLIC_BRAND_MODE === "rodebjer";

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
7. Avsluta med signatur:
   - Svenska: "Med varma hälsningar,\\nRodebjer" eller bara "x,\\nRodebjer"
   - Engelska: "With love,\\nRodebjer" eller "x,\\nRodebjer"
8. Aldrig från en specifik säljare/person — Rodebjer talar som ett enat brand

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

Vi tänkte den kunde bli en av dina.

Med varma hälsningar,
Rodebjer"
`
    : "";

  const secondThoughtsSection =
    isRodebjer && segment_type === "second-thoughts"
      ? `
--- SPECIAL: SECOND THOUGHTS ---
Detta segment består av kunder som ofta returnerar sina köp. Målet med detta mail är INTE att sälja mer — det är att erbjuda ett annat sätt att relatera till varumärket. Skriv därför:

1. Erkänn subtilt (utan skam) att val kan vara svåra
2. Erbjud ett personligt stylingsamtal som alternativ till att köpa online
3. Signalera att Rodebjer föredrar färre, mer medvetna köp (matchar deras sustainability-position)
4. Ingen produkt ska nämnas specifikt — samtalet är inte om ett plagg utan om en relation
5. CTA: "Boka ett stylingsamtal" istället för "Handla nu"

EXEMPEL PÅ TON (skriv i denna anda men inte kopiera):
"Kära Elsa,

Ibland är det svåraste med kläder inte att köpa dem — utan att veta säkert att de är dina. Vi märker att du testat mycket senaste tiden, och att en del gått tillbaka.

Vi tänkte att vi kunde göra det annorlunda. Boka en halvtimme med en av våra stylister — i butik eller online. Vi tittar tillsammans på vad som redan bor i din garderob och vad som skulle passa in där.

Ingen kassa, inget måste. Bara ett samtal.

Med varma hälsningar,
Rodebjer"
`
      : "";

  const { data: customersData } = await supabase
    .from("customers")
    .select("email, total_spent, order_count, last_order_at, return_stats")
    .eq("brand_id", brandId);

  const customers = (customersData ?? []) as {
    email: string;
    total_spent: number | null;
    order_count: number | null;
    last_order_at: string | null;
    return_stats: { return_rate: number; returns_count: number } | null;
  }[];

  const segmentCustomers = filterSegment(segment_type, customers);
  const count = segmentCustomers.length;
  const avgSpent =
    count > 0
      ? Math.round(
          segmentCustomers.reduce((s, c) => s + (c.total_spent ?? 0), 0) / count
        )
      : 0;

  const meta = SEGMENT_META[segment_type];
  const channelLabel =
    channel === "sms" ? "SMS" : channel === "push" ? "push-notis" : "e-post";

  const prompt = `Du är marknadschef på ${brandName}, ett mode/beauty-varumärke med sofistikerat tonläge.

UPPGIFT: Skriv ett kampanjmejl för segmentet "${meta.name}".

SEGMENTBESKRIVNING: ${meta.description}
ANTAL KUNDER I SEGMENT: ${count}
GENOMSNITTLIGT KÖPVÄRDE: ${avgSpent.toLocaleString("sv")} kr
KANAL: ${channelLabel}
VARUMÄRKE: ${brandName}

INSTRUKTIONER:
- Skriv på svenska, varmt och personligt — som ett brev från en människa, inte ett nyhetsbrev
- Ämnesraden: max 7 ord, nyfiken och personlig, ingen säljig känsla
- Brödtext: 4–6 meningar, anpassad för exakt detta segments beteende och relation
- Ingen rabatt eller prisinfo om det inte handlar om win-back (inaktiva/på väg bort)
- Inga emojis, inga onödiga utropstecken
- Avsluta med ett mjukt, konkret call-to-action
- Signera med: "${repName ? repName + ", " + brandName : brandName}"
${brandVoiceSection}${secondThoughtsSection}
Svara ENBART med giltig JSON i detta format (inga kommentarer, ingen förklaring):
{"subject":"ämnesrad här","body":"brödtext här\\nmed \\\\n för radbrytningar"}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Kunde inte tolka AI-svar");

    const result = JSON.parse(jsonMatch[0]) as { subject: string; body: string };

    return Response.json({
      subject: result.subject,
      body: result.body,
      customer_count: count,
      avg_spent: avgSpent,
      segment_name: meta.name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Okänt fel";
    return Response.json({ error: `Kunde inte generera kampanj: ${msg}` }, { status: 500 });
  }
}
