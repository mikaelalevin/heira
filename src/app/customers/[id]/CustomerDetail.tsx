"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMoodGradient } from "@/lib/mood-gradients";
import {
  parseReturnStats,
  RETURN_REASON_LABELS,
  RETURN_TYPE_LABELS,
  returnRateColor,
  isSecondThoughtsRisk,
} from "@/lib/returns";

interface AiPrediction {
  product: string;
  predicted_product_sku?: string | null;
  category?: string | null;
  price_sek?: number | null;
  mood_gradient?: string | null;
  date: string;
  daysUntil: number;
  confidence: number;
  reason: string;
  generatedAt: string;
}

interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  total_spent: number | null;
  order_count: number | null;
  notes: string | null;
  sales_rep_id: string | null;
  last_order_at: string | null;
  last_visit_at: string | null;
  total_visits: number | null;
  return_stats: Record<string, unknown> | null;
}

interface Order {
  id: string;
  total: number;
  created_at: string;
  items: unknown[];
  shopify_order_id: string | null;
}

interface WebSession {
  id: string;
  started_at: string;
  pageviews: number;
  products_viewed: unknown[];
  duration_seconds: number;
}

interface SalesRep {
  id: string;
  name: string;
  color: string;
  email: string | null;
}

const ink = "#1A1614";
const bg = "#FAF5EB";
const border = "#DDD0B5";
const warm = "#F2E8D0";
const inkMuted = "#8A6E55";
const inputClass = "w-full px-4 py-3 rounded-xl text-sm outline-none";
const inputStyle = { background: bg, border: `1px solid ${border}`, color: ink, fontFamily: "inherit" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: inkMuted }}>{label}</label>
      {children}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function getItemNames(items: unknown[]): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items
    .map((item) => {
      if (typeof item === "object" && item !== null) {
        const i = item as Record<string, unknown>;
        const name = (i.name ?? i.title ?? i.product_name ?? "") as string;
        const qty = (i.quantity ?? i.qty ?? 1) as number;
        return qty > 1 ? `${name} ×${qty}` : name;
      }
      return String(item);
    })
    .filter(Boolean)
    .join(", ");
}

function getItems(items: unknown[]): { name: string; qty: number }[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items
    .map((item) => {
      if (typeof item === "object" && item !== null) {
        const i = item as Record<string, unknown>;
        const name = String(i.name ?? i.title ?? i.product_name ?? "");
        const qty = Number(i.quantity ?? i.qty ?? 1);
        return name ? { name, qty } : null;
      }
      return { name: String(item), qty: 1 };
    })
    .filter(Boolean) as { name: string; qty: number }[];
}

function getProductNames(products: unknown[]): string {
  if (!Array.isArray(products) || products.length === 0) return "";
  return products
    .map((p) => {
      if (typeof p === "object" && p !== null) {
        const prod = p as Record<string, unknown>;
        return (prod.name ?? prod.title ?? prod.product_name ?? "") as string;
      }
      return String(p);
    })
    .filter(Boolean)
    .join(", ");
}

function DigitalReceipt({ order, customer, brandName }: {
  order: Order;
  customer: Customer;
  brandName: string;
}) {
  const items = getItems(order.items);
  const orderRef = order.shopify_order_id ?? order.id.slice(0, 8).toUpperCase();
  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email;

  return (
    <div className="mt-3 rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
      {/* Receipt header */}
      <div className="px-5 py-4 text-center" style={{ background: ink }}>
        <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 15, color: "rgba(255,255,255,0.95)", letterSpacing: "0.04em" }}>
          {brandName}
        </div>
        <div className="text-[10px] uppercase tracking-[0.15em] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
          Digitalt kvitto
        </div>
      </div>

      {/* Receipt body */}
      <div className="px-5 py-4" style={{ background: "#FFFFFF" }}>
        {/* Meta */}
        <div className="flex justify-between mb-4 pb-4" style={{ borderBottom: `1px dashed ${border}` }}>
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold mb-1" style={{ color: inkMuted }}>Kund</div>
            <div className="text-[13px] font-medium" style={{ color: ink }}>{customerName}</div>
            <div className="text-[11.5px]" style={{ color: inkMuted }}>{customer.email}</div>
            {customer.phone && <div className="text-[11.5px]" style={{ color: inkMuted }}>{customer.phone}</div>}
          </div>
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-[0.08em] font-semibold mb-1" style={{ color: inkMuted }}>Order</div>
            <div className="text-[13px] font-medium" style={{ color: ink }}>#{orderRef}</div>
            <div className="text-[11.5px]" style={{ color: inkMuted }}>{formatDate(order.created_at)}</div>
          </div>
        </div>

        {/* Items */}
        <div className="mb-4 pb-4" style={{ borderBottom: `1px dashed ${border}` }}>
          {items.length > 0 ? (
            items.map((item, i) => (
              <div key={i} className="flex justify-between items-center py-1.5">
                <span className="text-[13px]" style={{ color: ink }}>
                  {item.name}{item.qty > 1 ? <span style={{ color: inkMuted }}> ×{item.qty}</span> : ""}
                </span>
              </div>
            ))
          ) : (
            <div className="text-[13px]" style={{ color: inkMuted }}>Inga artiklar registrerade</div>
          )}
        </div>

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: ink }}>Totalt</span>
          <span style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, color: ink }}>
            {order.total.toLocaleString("sv")} kr
          </span>
        </div>
      </div>

      {/* Print button */}
      <div className="px-5 py-3 flex justify-end" style={{ background: bg, borderTop: `1px solid ${border}` }}>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg"
          style={{ background: warm, color: ink, border: "none", cursor: "pointer", fontFamily: "inherit" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Skriv ut
        </button>
      </div>
    </div>
  );
}

export function CustomerDetail({ customer, salesReps, orders, sessions, aiPrediction: initialAiPrediction, brandName }: {
  customer: Customer;
  salesReps: SalesRep[];
  orders: Order[];
  sessions: WebSession[];
  aiPrediction?: Record<string, unknown> | null;
  brandName?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [aiPrediction, setAiPrediction] = useState<AiPrediction | null>(
    initialAiPrediction && typeof initialAiPrediction.product === "string"
      ? initialAiPrediction as unknown as AiPrediction
      : null
  );
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiError, setAiError] = useState("");
  const [openReceipts, setOpenReceipts] = useState<Record<string, boolean>>({});
  const [generatingMessage, setGeneratingMessage] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [messageError, setMessageError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [confirmingSend, setConfirmingSend] = useState(false);

  const [firstName, setFirstName] = useState(customer.first_name ?? "");
  const [lastName, setLastName] = useState(customer.last_name ?? "");
  const [email, setEmail] = useState(customer.email);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [totalSpent, setTotalSpent] = useState(customer.total_spent?.toString() ?? "");
  const [orderCount, setOrderCount] = useState(customer.order_count?.toString() ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [repId, setRepId] = useState<string | null>(customer.sales_rep_id ?? null);

  const displayName = [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.email;
  const initials = customer.first_name && customer.last_name
    ? (customer.first_name[0] + customer.last_name[0]).toUpperCase()
    : (customer.first_name?.[0] ?? customer.email[0]).toUpperCase();

  const assignedRep = salesReps.find((r) => r.id === repId);
  const prob = Math.min(95, 30 + (customer.order_count ?? 0) * 8 + ((customer.total_spent ?? 0) > 10000 ? 20 : 0));
  const returnStats = parseReturnStats(customer.return_stats);
  const showReturnDetails = !!returnStats && returnStats.returns_count >= 3;

  function toggleReceipt(orderId: string) {
    setOpenReceipts((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    const supabase = createClient();
    const { error: err } = await supabase.from("customers").update({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      total_spent: totalSpent ? parseFloat(totalSpent.replace(",", ".")) : 0,
      order_count: orderCount ? parseInt(orderCount) : 0,
      notes: notes.trim() || null,
      sales_rep_id: repId,
    }).eq("id", customer.id);

    if (err) {
      setError(err.message.includes("unique") ? "Den e-postadressen används redan av en annan kund." : err.message);
      setSaving(false);
      return;
    }

    setSuccess(true);
    setEditing(false);
    setSaving(false);
    router.refresh();
  }

  function handleCancel() {
    setFirstName(customer.first_name ?? "");
    setLastName(customer.last_name ?? "");
    setEmail(customer.email);
    setPhone(customer.phone ?? "");
    setTotalSpent(customer.total_spent?.toString() ?? "");
    setOrderCount(customer.order_count?.toString() ?? "");
    setNotes(customer.notes ?? "");
    setEditing(false);
    setError("");
  }

  async function generateAiPrediction() {
    setGeneratingAi(true);
    setAiError("");
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customer.id }),
      });
      const data = await res.json() as { prediction?: AiPrediction; error?: string };
      if (!res.ok || data.error) {
        setAiError(data.error ?? "Kunde inte generera prediktion");
      } else if (data.prediction) {
        setAiPrediction(data.prediction);
      }
    } catch {
      setAiError("Nätverksfel — försök igen");
    } finally {
      setGeneratingAi(false);
    }
  }

  async function generateMessage() {
    if (!aiPrediction) {
      setMessageError("Generera en AI-prediktion först");
      return;
    }
    setGeneratingMessage(true);
    setMessageError("");
    try {
      const res = await fetch("/api/generate-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customer.id,
          prediction: {
            product: aiPrediction.product,
            date: aiPrediction.date,
            daysUntil: aiPrediction.daysUntil,
            confidence: aiPrediction.confidence,
            reason: aiPrediction.reason,
          },
          rep_name: assignedRep?.name ?? null,
          rep_email: assignedRep?.email ?? null,
        }),
      });
      const data = await res.json() as { message?: string; error?: string };
      if (!res.ok || data.error) {
        setMessageError(data.error ?? "Kunde inte generera meddelande");
      } else if (data.message) {
        setGeneratedMessage(data.message);
      }
    } catch {
      setMessageError("Nätverksfel — försök igen");
    } finally {
      setGeneratingMessage(false);
    }
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function sendMessage() {
    setConfirmingSend(false);
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
      setTimeout(() => setSent(false), 2500);
    }, 600);
  }

  const pred = aiPrediction;
  const resolvedBrandName = brandName ?? "HEIRA";

  return (
    <div className="animate-fade-in">
      <a href="/customers" className="inline-flex items-center gap-1.5 text-[13px] mb-6" style={{ color: inkMuted, textDecoration: "none" }}>
        ← Tillbaka till kunder
      </a>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
            style={{ background: assignedRep ? `linear-gradient(135deg, ${assignedRep.color}, ${assignedRep.color}99)` : "linear-gradient(135deg, #D9896A, #C07858)", fontSize: 18 }}
          >
            {initials}
          </div>
          <div>
            <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 30, color: ink, letterSpacing: "-0.01em" }}>
              {displayName}
            </h1>
            <p style={{ color: inkMuted, fontSize: 14 }}>{customer.email}</p>
            {returnStats && (
              <div className="mt-2">
                {isSecondThoughtsRisk(returnStats.return_rate) ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-lg"
                    style={{ background: "#6B4F5B", color: "#FAF5EB" }}
                  >
                    Second Thoughts · {Math.round(returnStats.return_rate * 100)}% returrate
                  </span>
                ) : (
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: returnRateColor(returnStats.return_rate) }}
                  >
                    {Math.round(returnStats.return_rate * 100)}% returrate
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-[9px] rounded-lg text-[13px] font-medium"
            style={{ background: "transparent", color: ink, border: `1px solid ${border}`, cursor: "pointer", fontFamily: "inherit" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Redigera
          </button>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "1fr 1fr" }}>

        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-5">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3" style={{ order: editing ? 2 : 0 }}>
            {[
              { label: "Totalt köpvärde", value: customer.total_spent ? customer.total_spent.toLocaleString("sv") + " kr" : "–" },
              { label: "Antal köp", value: customer.order_count?.toString() ?? "0" },
              { label: "Träffsäkerhet 14d", value: `${prob}%` },
            ].map((s) => (
              <div key={s.label} className="rounded-xl p-4" style={{ background: "#FFFFFF", border: `1px solid ${border}` }}>
                <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium mb-1.5" style={{ color: inkMuted }}>{s.label}</div>
                <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 22, color: ink }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* HEIRA-prediktion */}
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}`, order: editing ? 3 : 1 }}>
            <div className="relative px-6 py-4 flex items-center justify-between" style={{ background: "linear-gradient(135deg, #1A1614 0%, #3D2B22 100%)" }}>
              <div className="flex items-center gap-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" style={{ opacity: 0.7 }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <span className="text-[10.5px] uppercase tracking-[0.12em] font-semibold" style={{ color: "rgba(255,255,255,0.6)" }}>
                  HEIRA-prediktion{pred ? " · AI" : ""}
                </span>
              </div>
              {pred && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.9)" }}>
                  {pred.confidence}% träffsäkerhet
                </span>
              )}
            </div>
            <div className="px-6 py-5" style={{ background: "#FFFFFF" }}>
              {pred ? (
                <>
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="rounded-xl flex-shrink-0"
                      style={{ width: 56, height: 56, background: getMoodGradient(pred.mood_gradient ?? "sand") }}
                    />
                    <div className="flex-1 min-w-0">
                      {pred.category && (
                        <div className="text-[10.5px] uppercase tracking-[0.1em] font-semibold mb-1" style={{ color: inkMuted }}>
                          {pred.category}
                        </div>
                      )}
                      <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 20, color: ink, letterSpacing: "-0.01em" }}>
                        {pred.product}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {pred.price_sek != null && (
                          <span className="text-[13px] font-medium" style={{ color: ink }}>
                            {pred.price_sek.toLocaleString("sv")} kr
                          </span>
                        )}
                        {pred.predicted_product_sku && (
                          <span className="text-[11px]" style={{ color: inkMuted }}>SKU {pred.predicted_product_sku}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[11px] uppercase tracking-[0.08em] font-medium mb-1" style={{ color: inkMuted }}>Förväntad</div>
                      <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, color: ink }}>
                        {pred.date}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: warm }}>
                      <div style={{ height: "100%", width: `${pred.confidence}%`, background: ink, borderRadius: 2 }} />
                    </div>
                    <span className="text-[12px]" style={{ color: inkMuted }}>{pred.daysUntil === 1 ? "Idag" : `Om ${pred.daysUntil} dagar`}</span>
                  </div>
                  <p className="text-[12.5px] leading-relaxed mb-4" style={{ color: inkMuted }}>
                    {pred.reason}
                  </p>
                </>
              ) : (
                <p className="text-[13px] leading-relaxed mb-4" style={{ color: inkMuted }}>
                  Ingen AI-prediktion genererad ännu. Klicka nedan för att låta Claude analysera köphistoriken mot produktkatalogen.
                </p>
              )}
              {aiError && (
                <p className="text-[12px] mb-3" style={{ color: "#C45224" }}>{aiError}</p>
              )}
              <button
                onClick={generateAiPrediction}
                disabled={generatingAi}
                className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg"
                style={{ background: generatingAi ? warm : ink, color: generatingAi ? inkMuted : bg, border: "none", cursor: generatingAi ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                {generatingAi ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Analyserar...
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    {pred ? "Uppdatera AI-prediktion" : "Generera AI-prediktion"}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Returmönster — kontextuell info, dovare än övriga kort */}
          {showReturnDetails && returnStats && (
            <div
              className="rounded-2xl px-6 py-5 flex flex-col gap-3"
              style={{ background: warm, border: `1px solid ${border}`, order: editing ? 4 : 2 }}
            >
              <div className="text-[10.5px] uppercase tracking-[0.1em] font-semibold" style={{ color: inkMuted }}>
                Returmönster
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 19, color: returnRateColor(returnStats.return_rate) }}>
                    {Math.round(returnStats.return_rate * 100)}%
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: inkMuted }}>Returrate</div>
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 19, color: ink }}>
                    {returnStats.returns_count}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: inkMuted }}>Returer totalt</div>
                </div>
              </div>
              <div className="text-[12.5px]" style={{ color: inkMuted }}>
                Vanligast: {RETURN_TYPE_LABELS[returnStats.most_returned_type] ?? returnStats.most_returned_type}
                {" — anledning: "}
                {RETURN_REASON_LABELS[returnStats.most_common_reason] ?? returnStats.most_common_reason}
              </div>
              <div className="text-[11.5px]" style={{ color: inkMuted }}>
                Senaste retur: {formatDate(returnStats.last_return_at)}
              </div>
            </div>
          )}

          {/* Åtgärder */}
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}`, order: editing ? 5 : 3 }}>
            <div className="px-6 py-4 flex items-center gap-2.5" style={{ background: warm }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.8">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <span className="text-[10.5px] uppercase tracking-[0.12em] font-semibold" style={{ color: inkMuted }}>
                Åtgärder
              </span>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4" style={{ background: "#FFFFFF" }}>
              <p className="text-[13px] leading-relaxed" style={{ color: inkMuted }}>
                Generera ett personligt meddelande baserat på prediktionen — klart att skicka direkt.
              </p>
              {messageError && (
                <p className="text-[12px]" style={{ color: "#C45224" }}>{messageError}</p>
              )}
              {generatedMessage ? (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={generatedMessage}
                    onChange={(e) => setGeneratedMessage(e.target.value)}
                    rows={6}
                    className="w-full px-4 py-3 rounded-xl text-[13px] outline-none"
                    style={{ background: bg, border: `1px solid ${border}`, color: ink, fontFamily: "inherit", lineHeight: 1.65, resize: "vertical" }}
                    onFocus={(e) => (e.target.style.borderColor = ink)}
                    onBlur={(e) => (e.target.style.borderColor = border)}
                  />
                  {confirmingSend && (
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl" style={{ background: warm }}>
                      <span className="text-[12px] flex-1" style={{ color: ink }}>
                        Skicka till {displayName}?
                      </span>
                      <button
                        onClick={() => setConfirmingSend(false)}
                        className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
                        style={{ background: "transparent", color: inkMuted, border: `1px solid ${border}`, cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Avbryt
                      </button>
                      <button
                        onClick={sendMessage}
                        className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
                        style={{ background: ink, color: bg, border: "none", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        Ja, skicka
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => setConfirmingSend(true)}
                      disabled={sending || sent || confirmingSend}
                      className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg flex-1 justify-center"
                      style={{ background: sent ? "#DDE7D7" : ink, color: sent ? "#3E4F36" : bg, border: "none", cursor: sending ? "wait" : "pointer", fontFamily: "inherit", opacity: confirmingSend ? 0.5 : 1 }}
                    >
                      {sent ? (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          Skickat!
                        </>
                      ) : sending ? (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          Skickar...
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                          Skicka
                        </>
                      )}
                    </button>
                    <button
                      onClick={copyMessage}
                      className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg"
                      style={{ background: "transparent", color: copied ? "#3E6B2F" : inkMuted, border: `1px solid ${border}`, cursor: "pointer", fontFamily: "inherit" }}
                    >
                      {copied ? (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          Kopierat!
                        </>
                      ) : (
                        <>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                          Kopiera
                        </>
                      )}
                    </button>
                    <button
                      onClick={generateMessage}
                      disabled={generatingMessage}
                      className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg"
                      style={{ background: "transparent", color: inkMuted, border: `1px solid ${border}`, cursor: generatingMessage ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                    >
                      {generatingMessage ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
                      )}
                      Generera nytt
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={generateMessage}
                  disabled={generatingMessage || !pred}
                  className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg self-start"
                  style={{ background: generatingMessage || !pred ? warm : ink, color: generatingMessage || !pred ? inkMuted : bg, border: "none", cursor: generatingMessage || !pred ? "not-allowed" : "pointer", fontFamily: "inherit" }}
                >
                  {generatingMessage ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      Skriver meddelande...
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      Generera personligt meddelande
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Contact info + form — lyfts upp vid redigering */}
          <div className="flex flex-col gap-5" style={{ order: editing ? 0 : 4 }}>
          {editing && (
            <div className="flex gap-3">
              <button type="button" onClick={handleCancel}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: warm, color: ink, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                Avbryt
              </button>
              <button type="button" onClick={() => formRef.current?.requestSubmit()} disabled={saving || !email.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: saving || !email.trim() ? inkMuted : ink, color: bg, border: "none", cursor: saving || !email.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {saving ? "Sparar..." : "Spara ändringar →"}
              </button>
            </div>
          )}
          {success && (
            <div className="px-4 py-3 rounded-xl text-[13px]" style={{ background: "#DDE7D7", color: "#3E4F36" }}>
              Ändringarna är sparade.
            </div>
          )}

          <form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-5">
            <div className="rounded-2xl p-6 flex flex-col gap-5" style={{ background: "#FFFFFF", border: `1px solid ${border}`, order: 0 }}>
              <div className="flex items-center justify-between">
                <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 16, fontWeight: 500, color: ink }}>
                  Kontaktuppgifter
                </div>
                {!editing && (
                  <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium"
                    style={{ background: "transparent", color: ink, border: `1px solid ${border}`, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Redigera
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Förnamn">
                  <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Förnamn" disabled={!editing}
                    className={inputClass} style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }}
                    onFocus={(e) => editing && (e.target.style.borderColor = ink)}
                    onBlur={(e) => (e.target.style.borderColor = border)} />
                </Field>
                <Field label="Efternamn">
                  <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Efternamn" disabled={!editing}
                    className={inputClass} style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }}
                    onFocus={(e) => editing && (e.target.style.borderColor = ink)}
                    onBlur={(e) => (e.target.style.borderColor = border)} />
                </Field>
              </div>

              <Field label="E-postadress">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={!editing}
                  className={inputClass} style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }}
                  onFocus={(e) => editing && (e.target.style.borderColor = ink)}
                  onBlur={(e) => (e.target.style.borderColor = border)} />
              </Field>

              <Field label="Telefon">
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="–" disabled={!editing}
                  className={inputClass} style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }}
                  onFocus={(e) => editing && (e.target.style.borderColor = ink)}
                  onBlur={(e) => (e.target.style.borderColor = border)} />
              </Field>

              {salesReps.length > 0 && (
                <Field label="Säljare">
                  {editing ? (
                    <select
                      value={repId ?? ""}
                      onChange={(e) => setRepId(e.target.value || null)}
                      className={inputClass}
                      style={{ ...inputStyle }}
                    >
                      <option value="">Ingen säljare</option>
                      {salesReps.map((rep) => (
                        <option key={rep.id} value={rep.id}>{rep.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ background: warm, opacity: 0.7 }}>
                      {assignedRep ? (
                        <>
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: assignedRep.color, fontSize: 8, fontWeight: 700 }}>
                            {assignedRep.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="text-[13px]" style={{ color: ink }}>{assignedRep.name}</span>
                        </>
                      ) : (
                        <span className="text-[13px]" style={{ color: inkMuted }}>–</span>
                      )}
                    </div>
                  )}
                </Field>
              )}
            </div>

            <div className="rounded-2xl p-6 flex flex-col gap-5" style={{ background: "#FFFFFF", border: `1px solid ${border}`, order: editing ? 2 : 1 }}>
              <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 16, fontWeight: 500, color: ink }}>Köphistorik</div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Total köp (kr)">
                  <input type="text" inputMode="decimal" value={totalSpent} onChange={(e) => setTotalSpent(e.target.value)} placeholder="0" disabled={!editing}
                    className={inputClass} style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }}
                    onFocus={(e) => editing && (e.target.style.borderColor = ink)}
                    onBlur={(e) => (e.target.style.borderColor = border)} />
                </Field>
                <Field label="Antal ordrar">
                  <input type="text" inputMode="numeric" value={orderCount} onChange={(e) => setOrderCount(e.target.value)} placeholder="0" disabled={!editing}
                    className={inputClass} style={{ ...inputStyle, opacity: editing ? 1 : 0.7 }}
                    onFocus={(e) => editing && (e.target.style.borderColor = ink)}
                    onBlur={(e) => (e.target.style.borderColor = border)} />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl p-6 flex flex-col gap-3" style={{ background: "#FFFFFF", border: `1px solid ${border}`, order: editing ? 1 : 2 }}>
              <Field label="Anteckningar">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={editing ? "Handlar ofta storlek S, gillar linne..." : "–"} rows={3} disabled={!editing}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ ...inputStyle, lineHeight: 1.6, resize: "vertical", opacity: editing ? 1 : 0.7 }}
                  onFocus={(e) => editing && (e.target.style.borderColor = ink)}
                  onBlur={(e) => (e.target.style.borderColor = border)} />
              </Field>
            </div>

            {error && <p className="text-sm" style={{ color: "#C45224" }}>{error}</p>}

          </form>
          </div>{/* end contact+form wrapper */}
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-5">

          {/* Order history with receipts */}
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: "#FFFFFF", border: `1px solid ${border}` }}>
            <div className="flex items-center justify-between">
              <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 16, fontWeight: 500, color: ink }}>
                Orderhistorik
              </div>
              {orders.length > 0 && (
                <span className="text-[12px]" style={{ color: inkMuted }}>{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
              )}
            </div>

            {orders.length === 0 ? (
              <p className="text-[13px]" style={{ color: inkMuted }}>Inga ordrar registrerade ännu.</p>
            ) : (
              <div className="flex flex-col">
                {orders.map((order, i) => {
                  const itemNames = getItemNames(order.items);
                  const isOpen = !!openReceipts[order.id];
                  return (
                    <div key={order.id} style={{ borderTop: i === 0 ? "none" : `1px solid ${border}` }}>
                      <div className="flex items-start justify-between py-3.5">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: warm }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="1.8">
                              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                              <line x1="3" y1="6" x2="21" y2="6"/>
                              <path d="M16 10a4 4 0 0 1-8 0"/>
                            </svg>
                          </div>
                          <div>
                            <div className="text-[13px] font-medium" style={{ color: ink }}>
                              {formatDate(order.created_at)}
                            </div>
                            {itemNames ? (
                              <div className="text-[12px] mt-0.5" style={{ color: inkMuted }}>{itemNames}</div>
                            ) : (
                              <div className="text-[12px] mt-0.5" style={{ color: inkMuted }}>
                                {order.items.length > 0 ? `${order.items.length} artiklar` : "Inga artiklar"}
                              </div>
                            )}
                            {order.shopify_order_id && (
                              <div className="text-[11px] mt-0.5" style={{ color: inkMuted }}>#{order.shopify_order_id}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="text-[14px] font-semibold" style={{ fontFamily: "var(--font-fraunces), serif", color: ink }}>
                            {order.total.toLocaleString("sv")} kr
                          </div>
                          <button
                            onClick={() => toggleReceipt(order.id)}
                            className="flex items-center gap-1 text-[11.5px] font-medium px-2.5 py-1.5 rounded-lg"
                            style={{ background: isOpen ? ink : warm, color: isOpen ? bg : inkMuted, border: "none", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                              <polyline points="14 2 14 8 20 8"/>
                              <line x1="16" y1="13" x2="8" y2="13"/>
                              <line x1="16" y1="17" x2="8" y2="17"/>
                              <polyline points="10 9 9 9 8 9"/>
                            </svg>
                            {isOpen ? "Stäng" : "Kvitto"}
                          </button>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="pb-3">
                          <DigitalReceipt order={order} customer={customer} brandName={resolvedBrandName} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Web activity */}
          <div className="rounded-2xl p-6 flex flex-col gap-4" style={{ background: "#FFFFFF", border: `1px solid ${border}` }}>
            <div className="flex items-center justify-between">
              <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 16, fontWeight: 500, color: ink }}>
                Webbaktivitet
              </div>
              {customer.total_visits != null && customer.total_visits > 0 && (
                <span className="text-[12px]" style={{ color: inkMuted }}>{customer.total_visits} besök totalt</span>
              )}
            </div>

            {sessions.length === 0 ? (
              <p className="text-[13px]" style={{ color: inkMuted }}>Ingen webbaktivitet registrerad ännu.</p>
            ) : (
              <div className="flex flex-col">
                {sessions.map((session, i) => {
                  const productNames = getProductNames(session.products_viewed);
                  return (
                    <div key={session.id}
                      className="flex items-start justify-between py-3.5"
                      style={{ borderTop: i === 0 ? "none" : `1px solid ${border}` }}>
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: warm }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="1.8">
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                            <line x1="8" y1="21" x2="16" y2="21"/>
                            <line x1="12" y1="17" x2="12" y2="21"/>
                          </svg>
                        </div>
                        <div>
                          <div className="text-[13px] font-medium" style={{ color: ink }}>
                            {formatDate(session.started_at)}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[12px]" style={{ color: inkMuted }}>
                              {session.pageviews} sidor
                            </span>
                            {session.duration_seconds > 0 && (
                              <span className="text-[12px]" style={{ color: inkMuted }}>
                                {formatDuration(session.duration_seconds)}
                              </span>
                            )}
                          </div>
                          {productNames && (
                            <div className="text-[12px] mt-0.5" style={{ color: inkMuted }}>
                              Tittade på: {productNames}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
