"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getMoodGradient } from "@/lib/mood-gradients";

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const inkSoft = "#5A4232";
const border = "#DDD0B5";
const bg = "#FAF5EB";
const warm = "#F2E8D0";
const card = "#FFFFFF";

interface Segment {
  id: string;
  name: string;
  description: string;
  mood_gradient: string;
  customer_count: number;
  avg_ltv: number;
  ai_suggestion: string;
}

interface Props {
  segments: Segment[];
  customerCount: number;
}

export function SegmentsClient({ segments, customerCount }: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/segments/generate", { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Okänt fel");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Något gick fel");
      setGenerating(false);
    }
  }

  const hasSegments = segments.length > 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-9">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-fraunces), serif",
              fontWeight: 400,
              fontSize: 34,
              letterSpacing: "-0.01em",
              color: ink,
            }}
          >
            Segment
          </h1>
          <p className="mt-1.5" style={{ color: inkMuted, fontSize: 14 }}>
            {hasSegments
              ? `${segments.length} AI-genererade segment baserade på din kunddata.`
              : "Inga segment ännu — låt HEIRA analysera din kunddata."}
          </p>
        </div>
        <div className="flex gap-2.5">
          {hasSegments && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-[9px] rounded-lg text-[13px] font-medium"
              style={{
                background: "transparent",
                color: generating ? inkMuted : ink,
                border: `1px solid ${border}`,
                cursor: generating ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {generating ? (
                <>
                  <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 00-9-9" />
                  </svg>
                  Analyserar…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  Regenerera
                </>
              )}
            </button>
          )}
          <a
            href="/import"
            className="px-4 py-[9px] rounded-lg text-[13px] font-medium"
            style={{
              background: "transparent",
              color: ink,
              border: `1px solid ${border}`,
              fontFamily: "inherit",
              textDecoration: "none",
            }}
          >
            Importera från Klaviyo
          </a>
        </div>
      </div>

      {error && (
        <div
          className="rounded-xl px-4 py-3 mb-6 text-[13px]"
          style={{ background: "#FDF0EC", color: "#C45224", border: "1px solid #E8B4A4" }}
        >
          {error}
        </div>
      )}

      {/* Empty state */}
      {!hasSegments && !generating && (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-24 gap-6"
          style={{ background: card, border: `1px solid ${border}` }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: warm }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div className="text-center">
            <div
              style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 22, fontWeight: 400, color: ink }}
            >
              Inga segment ännu
            </div>
            <p className="mt-2 text-[14px] max-w-sm" style={{ color: inkMuted }}>
              HEIRA analyserar din kunddata och skapar unika segment anpassade för just ditt varumärke.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-medium"
            style={{ background: ink, color: bg, border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Generera segment med AI
          </button>
          {customerCount > 0 && (
            <p className="text-[12px]" style={{ color: inkMuted }}>
              Analyserar {customerCount} kunder
            </p>
          )}
        </div>
      )}

      {/* Loading state */}
      {generating && (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-24 gap-6"
          style={{ background: card, border: `1px solid ${border}` }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: ink }}
          >
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 12a9 9 0 00-9-9" />
            </svg>
          </div>
          <div className="text-center">
            <div
              style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 22, fontWeight: 400, color: ink }}
            >
              Analyserar kunddata…
            </div>
            <p className="mt-2 text-[14px]" style={{ color: inkMuted }}>
              {customerCount > 0
                ? `Går igenom ${customerCount} kunder och hittar mönster.`
                : "Identifierar beteendemönster i din kunddata."}
            </p>
          </div>
        </div>
      )}

      {/* Segment cards */}
      {hasSegments && !generating && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {segments.map((seg, i) => {
            const gradient = getMoodGradient(seg.mood_gradient);

            return (
              <a
                key={seg.id}
                href={`/segments/${seg.id}`}
                className="flex flex-col rounded-2xl overflow-hidden transition-all"
                style={{
                  background: card,
                  border: `1px solid ${border}`,
                  textDecoration: "none",
                  opacity: seg.customer_count === 0 ? 0.45 : 1,
                }}
              >
                <div className="relative overflow-hidden" style={{ height: 110, background: gradient }}>
                  <div
                    className="absolute inset-0"
                    style={{
                      opacity: 0.12,
                      backgroundImage: "radial-gradient(circle at 30% 30%, white 0.5px, transparent 1px)",
                      backgroundSize: "22px 22px",
                    }}
                  />
                  <span
                    className="absolute text-[10px] uppercase tracking-[0.1em] font-semibold px-2.5 py-1 rounded-lg"
                    style={{ top: 14, left: 16, background: "rgba(255,255,255,0.92)", color: ink }}
                  >
                    AI · {i + 1}
                  </span>
                  {seg.customer_count === 0 && (
                    <span
                      className="absolute text-[10px] uppercase tracking-[0.06em] font-medium px-2.5 py-1 rounded-lg"
                      style={{ top: 14, right: 16, background: "rgba(0,0,0,0.3)", color: "rgba(255,255,255,0.7)" }}
                    >
                      Tomt
                    </span>
                  )}
                </div>

                <div className="p-5">
                  <div
                    style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 19, fontWeight: 500, color: ink }}
                  >
                    {seg.name}
                  </div>
                  <div className="mt-1 text-[13px] leading-relaxed" style={{ color: inkSoft }}>
                    {seg.description}
                  </div>

                  <div
                    className="flex justify-between mt-4 pt-3.5"
                    style={{ borderTop: `1px solid ${border}` }}
                  >
                    <div>
                      <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: inkMuted }}>
                        Kunder
                      </div>
                      <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 17, color: ink, marginTop: 2 }}>
                        {seg.customer_count > 0 ? seg.customer_count.toLocaleString("sv") : "–"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: inkMuted }}>
                        Snitt köpvärde
                      </div>
                      <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 17, color: ink, marginTop: 2 }}>
                        {seg.avg_ltv > 0 ? seg.avg_ltv.toLocaleString("sv") + " kr" : "–"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: inkMuted }}>
                        HEIRA-tips
                      </div>
                      <div className="mt-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill={ink} style={{ opacity: 0.5 }}>
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {seg.ai_suggestion && (
                    <div
                      className="mt-3 text-[12px] leading-relaxed rounded-xl px-3 py-2.5"
                      style={{ background: warm, color: inkSoft }}
                    >
                      {seg.ai_suggestion.length > 100
                        ? seg.ai_suggestion.slice(0, 100) + "…"
                        : seg.ai_suggestion}
                    </div>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
