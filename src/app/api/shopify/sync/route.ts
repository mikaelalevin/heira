import { createClient } from "@/lib/supabase/server";
import { getBrandId } from "@/lib/brand";

interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  orders_count: number;
  total_spent: string;
  created_at: string;
  updated_at: string;
}

interface ShopifyLineItem {
  title: string;
  quantity: number;
  price: string;
}

interface ShopifyOrder {
  id: number;
  order_number: number;
  customer?: { id: number; email: string };
  total_price: string;
  created_at: string;
  line_items: ShopifyLineItem[];
  source_name?: string;
}

// Shopify uses cursor-based pagination via Link response headers.
// Returns { data, nextPageInfo } where nextPageInfo is null on last page.
async function shopifyFetch(
  domain: string,
  token: string,
  path: string,
  pageInfo?: string
): Promise<{ data: unknown; nextPageInfo: string | null }> {
  const url = pageInfo
    ? `https://${domain}/admin/api/2025-01/${path}?limit=250&page_info=${pageInfo}`
    : `https://${domain}/admin/api/2025-01/${path}?limit=250`;

  const res = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) throw new Error(`Shopify API fel: ${res.status} ${await res.text()}`);

  // Parse cursor from Link header: <url>; rel="next"
  const linkHeader = res.headers.get("Link") ?? "";
  const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
  const nextPageInfo = nextMatch ? nextMatch[1] : null;

  return { data: await res.json(), nextPageInfo };
}

export async function POST() {
  const supabase = await createClient();
  const brandId = await getBrandId();
  if (!brandId) return Response.json({ error: "Inget varumärke hittades" }, { status: 404 });

  const { data: brandData } = await supabase
    .from("brands")
    .select("shopify_domain, shopify_access_token")
    .eq("id", brandId)
    .single();

  const brand = brandData as { shopify_domain: string | null; shopify_access_token: string | null } | null;
  if (!brand?.shopify_domain || !brand?.shopify_access_token) {
    return Response.json({ error: "Shopify är inte kopplat — lägg till butiksdomain och access token." }, { status: 400 });
  }

  const domain = brand.shopify_domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const token = brand.shopify_access_token;

  let customersImported = 0;
  let ordersImported = 0;
  const errors: string[] = [];

  // --- Kunder ---
  try {
    let pageInfo: string | undefined = undefined;
    let isFirst = true;

    while (true) {
      const { data, nextPageInfo } = await shopifyFetch(domain, token, "customers.json", isFirst ? undefined : pageInfo);
      isFirst = false;
      const customers = (data as { customers: ShopifyCustomer[] }).customers ?? [];
      if (customers.length === 0) break;

      for (const c of customers) {
        if (!c.email) continue;
        const { error } = await supabase.from("customers").upsert({
          brand_id: brandId,
          shopify_customer_id: String(c.id),
          email: c.email.toLowerCase().trim(),
          first_name: c.first_name || null,
          last_name: c.last_name || null,
          phone: c.phone || null,
          order_count: c.orders_count ?? 0,
          total_spent: parseFloat(c.total_spent ?? "0"),
          created_at: c.created_at,
          last_order_at: c.updated_at,
        }, { onConflict: "brand_id,email", ignoreDuplicates: false });

        if (error) errors.push(`Kund ${c.email}: ${error.message}`);
        else customersImported++;
      }

      if (!nextPageInfo) break;
      pageInfo = nextPageInfo;
    }
  } catch (e) {
    return Response.json({ error: `Kunde inte hämta kunder: ${e instanceof Error ? e.message : "Okänt fel"}` }, { status: 500 });
  }

  // --- Ordrar ---
  try {
    let pageInfo: string | undefined = undefined;
    let isFirst = true;

    while (true) {
      const { data, nextPageInfo } = await shopifyFetch(domain, token, "orders.json?status=any", isFirst ? undefined : pageInfo);
      isFirst = false;
      const orders = (data as { orders: ShopifyOrder[] }).orders ?? [];
      if (orders.length === 0) break;

      for (const o of orders) {
        if (!o.customer?.email) continue;

        const { data: customerRows } = await supabase
          .from("customers")
          .select("id")
          .eq("brand_id", brandId)
          .eq("email", o.customer.email.toLowerCase().trim())
          .limit(1);

        const customerId = (customerRows?.[0] as { id: string } | undefined)?.id;
        if (!customerId) continue;

        const items = o.line_items.map((li) => ({
          name: li.title,
          quantity: li.quantity,
          price: Math.round(parseFloat(li.price)),
        }));

        const { error } = await supabase.from("orders").upsert({
          customer_id: customerId,
          shopify_order_id: String(o.order_number),
          total: Math.round(parseFloat(o.total_price)),
          created_at: o.created_at,
          items,
          channel: o.source_name === "pos" ? "in_store" : "online",
        }, { onConflict: "shopify_order_id", ignoreDuplicates: false });

        if (error) errors.push(`Order #${o.order_number}: ${error.message}`);
        else ordersImported++;
      }

      if (!nextPageInfo) break;
      pageInfo = nextPageInfo;
    }
  } catch (e) {
    return Response.json({ error: `Kunde inte hämta ordrar: ${e instanceof Error ? e.message : "Okänt fel"}` }, { status: 500 });
  }

  await supabase.from("brands").update({ shopify_synced_at: new Date().toISOString() }).eq("id", brandId);

  return Response.json({ customersImported, ordersImported, errors: errors.slice(0, 10) });
}
