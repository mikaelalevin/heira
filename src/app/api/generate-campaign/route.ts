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
    .select("name")
    .eq("id", brandId)
    .single();
  const brandName = (brandData as { name: string } | null)?.name ?? "varumärket";

  const { data: customersData } = await supabase
    .from("customers")
    .select("email, total_spent, order_count, last_order_at")
    .eq("brand_id", brandId);

  const customers = (customersData ?? []) as {
    email: string;
    total_spent: number | null;
    order_count: number | null;
    last_order_at: string | null;
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

  const prompt = `Du är marknadschef på ${brandName}, ett mode/beauty-varumärke med skandinaviskt, sofistikerat och varmt tonläge (tänk COS, Totême, Studio Acacia).

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

Svara ENBART med giltig JSON i detta format (inga kommentarer, ingen förklaring):
{"subject":"ämnesrad här","body":"brödtext här\\nmed \\\\n för radbrytningar"}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
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
