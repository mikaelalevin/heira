"use client";

import { useState } from "react";
import { generateTablePrediction } from "@/lib/predictions";

interface AiPrediction {
  product: string;
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
  total_spent: number | null;
  order_count: number | null;
  last_order_at: string | null;
  ai_prediction: Record<string, unknown> | null;
  ai_prediction_at: string | null;
}

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const border = "#DDD0B5";
const warm = "#F2E8D0";
const bg = "#FAF5EB";

function getAiPrediction(c: Customer): AiPrediction | null {
  const p = c.ai_prediction;
  if (!p || typeof p.product !== "string") return null;
  return p as unknown as AiPrediction;
}

function displayName(c: Customer) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email;
}

function initials(c: Customer) {
  if (c.first_name && c.last_name) return (c.first_name[0] + c.last_name[0]).toUpperCase();
  return (c.first_name?.[0] ?? c.email[0]).toUpperCase();
}

const AVATAR_COLORS = ["#D9896A", "#A8B5A0", "#C9A961", "#B47A75", "#6B4F5B", "#6B7A63"];

export function AiRecommendationsList({ customers }: { customers: Customer[] }) {
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [predictions, setPredictions] = useState<Record<string, AiPrediction>>(() => {
    const init: Record<string, AiPrediction> = {};
    customers.forEach((c) => {
      const p = getAiPrediction(c);
      if (p) init[c.id] = p;
    });
    return init;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [search, setSearch] = useState("");

  async function generateOne(customerId: string) {
    setGenerating((g) => ({ ...g, [customerId]: true }));
    setErrors((e) => ({ ...e, [customerId]: "" }));
    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      });
      const data = await res.json() as { prediction?: AiPrediction; error?: string };
      if (!res.ok || data.error) {
        setErrors((e) => ({ ...e, [customerId]: data.error ?? "Fel" }));
      } else if (data.prediction) {
        setPredictions((p) => ({ ...p, [customerId]: data.prediction! }));
      }
    } catch {
      setErrors((e) => ({ ...e, [customerId]: "Nätverksfel" }));
    } finally {
      setGenerating((g) => ({ ...g, [customerId]: false }));
    }
  }

  async function generateAll() {
    setGeneratingAll(true);
    const missing = filteredCustomers.filter((c) => !predictions[c.id]);
    for (const c of missing) {
      await generateOne(c.id);
    }
    setGeneratingAll(false);
  }

  const q = search.toLowerCase().trim();
  const filteredCustomers = q
    ? customers.filter((c) =>
        [c.first_name, c.last_name, c.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : customers;

  const withPredictions = filteredCustomers.filter((c) => predictions[c.id]);
  const withoutPredictions = filteredCustomers.filter((c) => !predictions[c.id]);

  const sorted = [
    ...withPredictions.sort((a, b) => (predictions[a.id]?.daysUntil ?? 99) - (predictions[b.id]?.daysUntil ?? 99)),
    ...withoutPredictions,
  ];

  const aiCount = withPredictions.length;

  return (
    <div className="animate-fade-in">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 34, color: ink, letterSpacing: "-0.01em" }}>
            AI-prediktioner
          </h1>
          <p className="mt-1 text-[14px]" style={{ color: inkMuted }}>
            Claude analyserar köphistorik och förutspår nästa köp per kund
          </p>
        </div>
        {withoutPredictions.length > 0 && (
          <button
            onClick={generateAll}
            disabled={generatingAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium flex-shrink-0"
            style={{ background: generatingAll ? warm : ink, color: generatingAll ? inkMuted : bg, border: "none", cursor: generatingAll ? "not-allowed" : "pointer", fontFamily: "inherit" }}
          >
            {generatingAll ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                Analyserar...
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                Analysera alla ({withoutPredictions.length})
              </>
            )}
          </button>
        )}
      </div>

      <div className="relative w-full md:w-60 mb-5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök namn, e-post..."
          className="pl-9 pr-4 py-2 rounded-xl text-[13px] outline-none"
          style={{ background: "#FFFFFF", border: `1px solid ${border}`, color: ink, fontFamily: "inherit", width: "100%" }}
          onFocus={(e) => (e.target.style.borderColor = ink)}
          onBlur={(e) => (e.target.style.borderColor = border)}
        />
      </div>

      {aiCount > 0 && (
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] font-semibold px-2.5 py-1 rounded-lg" style={{ background: "#6B4F5B", color: "rgba(255,255,255,0.85)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            {aiCount} Claude-prediktioner
          </div>
          <span className="text-[12px]" style={{ color: inkMuted }}>
            {withoutPredictions.length > 0 ? `· ${withoutPredictions.length} kunder kvar att analysera` : "· Alla kunder analyserade"}
          </span>
        </div>
      )}

      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
        {sorted.map((c, i) => {
          const aiPred = predictions[c.id];
          const fallback = !aiPred ? generateTablePrediction(c) : null;
          const pred = aiPred ?? fallback!;
          const isAi = !!aiPred;
          const isGenerating = !!generating[c.id];
          const err = errors[c.id];
          const color = AVATAR_COLORS[i % AVATAR_COLORS.length];

          const genDate = isAi && pred.generatedAt ? new Date(pred.generatedAt) : null;
          if (genDate) genDate.setDate(genDate.getDate() + pred.daysUntil);
          const actualDaysUntil = genDate
            ? Math.max(0, Math.round((genDate.getTime() - Date.now()) / 86_400_000))
            : pred.daysUntil;
          const urgentSoon = actualDaysUntil <= 7;
          const urgentMid = actualDaysUntil <= 30;
          const daysColor = urgentSoon ? "#3E6B2F" : urgentMid ? "#8A6E55" : inkMuted;

          return (
            <div
              key={c.id}
              className="flex items-start gap-4 px-6 py-4"
              style={{ borderTop: i === 0 ? "none" : `1px solid ${border}`, background: "#FFFFFF" }}
            >
              {/* Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 mt-0.5"
                style={{ background: `linear-gradient(135deg, ${color}, ${color}99)`, fontSize: 13 }}
              >
                {initials(c)}
              </div>

              {/* Name + email + reason */}
              <div className="flex-1 min-w-0">
                <a
                  href={`/customers/${c.id}`}
                  className="text-[13px] font-medium hover:underline"
                  style={{ color: ink, textDecoration: "none" }}
                >
                  {displayName(c)}
                </a>
                <div className="text-[11px] mt-0.5" style={{ color: inkMuted }}>{c.email}</div>
                {isAi && pred.reason && (
                  <div className="text-[11.5px] mt-1.5 leading-relaxed" style={{ color: inkMuted, fontStyle: "italic" }}>
                    {pred.reason}
                  </div>
                )}
              </div>

              {/* Prediction */}
              <div className="flex-shrink-0 text-right" style={{ minWidth: 160 }}>
                {isGenerating ? (
                  <div className="flex items-center justify-end gap-2 text-[12px]" style={{ color: inkMuted }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Analyserar...
                  </div>
                ) : err ? (
                  <span className="text-[11px]" style={{ color: "#C45224" }}>{err}</span>
                ) : (
                  <>
                    <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 14, color: ink }}>
                      {pred.product}
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-1">
                      <span className="text-[11.5px]" style={{ color: daysColor, fontWeight: urgentSoon ? 500 : 400 }}>
                        {pred.date}{urgentSoon && <span className="ml-1">●</span>}
                      </span>
                      <span
                        className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md"
                        style={{ background: "#F2E8D0", color: isAi ? "#6B4F5B" : ink }}
                      >
                        {pred.confidence}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="px-6 py-12 text-center" style={{ background: "#FFFFFF" }}>
            <p className="text-[14px]" style={{ color: inkMuted }}>
              {q ? "Inga kunder matchar sökningen." : "Inga kunder att analysera ännu."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
