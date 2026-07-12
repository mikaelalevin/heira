import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";
import { filterSegment, type SegmentType } from "@/lib/segments";
import { Resend } from "resend";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    subject?: string;
    body?: string;
    segment_type?: string;
    channel?: string;
    rep_name?: string | null;
    rep_email?: string | null;
  };

  const {
    subject,
    body: emailBody,
    segment_type = "stammisar",
    channel = "email",
    rep_name,
    rep_email,
  } = body;
  if (!subject || !emailBody) {
    return Response.json({ error: "Ämnesrad och brödtext krävs" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || resendKey === "your_resend_api_key_here") {
    return Response.json(
      { error: "RESEND_API_KEY saknas — lägg till den i .env.local" },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const brandId = await getBrandId();

  const [{ data: brandData }, { data: customersData }] = await Promise.all([
    supabase.from("brands").select("name").eq("id", brandId).single(),
    supabase
      .from("customers")
      .select("email, total_spent, order_count, last_order_at, return_stats")
      .eq("brand_id", brandId),
  ]);

  const brandName = (brandData as { name: string } | null)?.name ?? "HEIRA";
  const customers = (customersData ?? []) as {
    email: string;
    total_spent: number | null;
    order_count: number | null;
    last_order_at: string | null;
    return_stats: { return_rate: number; returns_count: number } | null;
  }[];

  const segmentCustomers = filterSegment(segment_type as SegmentType, customers);
  const actualCount = segmentCustomers.length;

  const testEmail = process.env.RESEND_TEST_EMAIL;
  const recipients = testEmail ? [testEmail] : segmentCustomers.map((c) => c.email);

  if (recipients.length === 0) {
    return Response.json({ error: "Inga mottagare i segmentet" }, { status: 400 });
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL ?? `${brandName} <onboarding@resend.dev>`;

  const htmlBody = emailBody
    .split("\n")
    .map((line) =>
      line.trim()
        ? `<p style="margin:0 0 18px;line-height:1.65;color:#1A1614">${line}</p>`
        : `<div style="height:8px"></div>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF5EB;font-family:Georgia,serif">
  <div style="max-width:580px;margin:48px auto;padding:0 24px">
    <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A6E55;margin-bottom:40px">${brandName}</div>
    <div style="font-size:15px;line-height:1.7;color:#1A1614">${htmlBody}</div>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #DDD0B5;font-size:11px;color:#8A6E55;letter-spacing:0.06em">
      Skickat med HEIRA · <a href="#" style="color:#8A6E55">Avprenumerera</a>
    </div>
  </div>
</body>
</html>`;

  const resend = new Resend(resendKey);

  try {
    await resend.emails.send({
      from: fromEmail,
      to: recipients,
      subject,
      html,
      ...(rep_email
        ? { replyTo: rep_name ? `${rep_name} <${rep_email}>` : rep_email }
        : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Okänt fel";
    return Response.json({ error: `Kunde inte skicka: ${msg}` }, { status: 500 });
  }

  await supabase.from("campaigns").insert({
    brand_id: brandId,
    channel,
    subject,
    body: emailBody,
    status: "sent",
    ai_generated: true,
    scheduled_at: new Date().toISOString(),
  });

  return Response.json({ sent_count: actualCount });
}
