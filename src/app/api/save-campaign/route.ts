import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    subject?: string;
    body?: string;
    channel?: string;
  };

  const { subject, body: emailBody, channel = "email" } = body;
  if (!subject || !emailBody) {
    return Response.json({ error: "Ämnesrad och brödtext krävs" }, { status: 400 });
  }

  const supabase = await createClient();
  const brandId = await getBrandId();

  const { error } = await supabase.from("campaigns").insert({
    brand_id: brandId,
    channel,
    subject,
    body: emailBody,
    status: "draft",
    ai_generated: true,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
