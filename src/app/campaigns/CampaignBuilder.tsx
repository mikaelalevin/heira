"use client";

import { useState } from "react";
import type { SegmentStats } from "@/lib/segments";

interface SalesRep {
  id: string;
  name: string;
  email: string | null;
  color: string;
}

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const inkSoft = "#5A4232";
const border = "#DDD0B5";
const bg = "#FAF5EB";
const warm = "#F2E8D0";
const card = "#FFFFFF";

type Step = "form" | "confirming" | "sending" | "sent" | "error";

interface Props {
  brandName: string;
  segments: SegmentStats[];
  salesReps: SalesRep[];
}

export function CampaignBuilder({ brandName, segments, salesReps }: Props) {
  const [selectedSegment, setSelectedSegment] = useState(segments[1] ?? segments[0]);
  const [channel, setChannel] = useState("email");
  const [selectedRep, setSelectedRep] = useState<SalesRep | null>(salesReps[0] ?? null);
  const [timing, setTiming] = useState("sunday");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [generating, setGenerating] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [savedDraft, setSavedDraft] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment_type: selectedSegment.type,
          channel,
          rep_name: selectedRep?.name ?? null,
        }),
      });
      const data = (await res.json()) as {
        subject?: string;
        body?: string;
        error?: string;
      };
      if (!res.ok || data.error) throw new Error(data.error ?? "Okänt fel");
      setSubject(data.subject ?? "");
      setBody(data.body ?? "");
      setSavedDraft(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Kunde inte generera kampanj");
      setStep("error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveDraft() {
    if (!subject || !body) return;
    setSavingDraft(true);
    try {
      await fetch("/api/save-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, channel }),
      });
      setSavedDraft(true);
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleSend() {
    setStep("sending");
    try {
      const res = await fetch("/api/send-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          segment_type: selectedSegment.type,
          channel,
          rep_name: selectedRep?.name ?? null,
          rep_email: selectedRep?.email ?? null,
        }),
      });
      const data = (await res.json()) as { sent_count?: number; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Okänt fel");
      setSentCount(data.sent_count ?? selectedSegment.customer_count);
      setStep("sent");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Kunde inte skicka");
      setStep("error");
    }
  }

  if (step === "sent") {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-24 gap-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "#6B7A63" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div className="text-center">
          <h2
            style={{
              fontFamily: "var(--font-fraunces), serif",
              fontSize: 28,
              fontWeight: 400,
              color: ink,
            }}
          >
            Kampanj skickad
          </h2>
          <p className="mt-2 text-[14px]" style={{ color: inkMuted }}>
            {sentCount} kunder i {selectedSegment.name} fick mejlet.
          </p>
        </div>
        <button
          onClick={() => {
            setStep("form");
            setSubject("");
            setBody("");
            setSavedDraft(false);
          }}
          className="px-6 py-2.5 rounded-xl text-[13px] font-medium"
          style={{ background: ink, color: bg, border: "none", cursor: "pointer", fontFamily: "inherit" }}
        >
          Ny kampanj
        </button>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-24 gap-6">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: "#C45224" }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M12 8v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <div className="text-center max-w-md">
          <h2
            style={{
              fontFamily: "var(--font-fraunces), serif",
              fontSize: 22,
              fontWeight: 400,
              color: ink,
            }}
          >
            Något gick fel
          </h2>
          <p className="mt-2 text-[13px]" style={{ color: inkMuted }}>
            {errorMsg}
          </p>
        </div>
        <button
          onClick={() => { setStep("form"); setErrorMsg(""); }}
          className="px-6 py-2.5 rounded-xl text-[13px] font-medium"
          style={{ background: ink, color: bg, border: "none", cursor: "pointer", fontFamily: "inherit" }}
        >
          Försök igen
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
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
            Ny kampanj
          </h1>
          <p className="mt-1.5" style={{ color: inkMuted, fontSize: 14 }}>
            HEIRA föreslår innehåll baserat på det valda segmentet.
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={handleSaveDraft}
            disabled={!subject || !body || savingDraft || savedDraft}
            style={{
              background: "transparent",
              color: savedDraft ? "#6B7A63" : ink,
              border: `1px solid ${savedDraft ? "#6B7A63" : border}`,
              padding: "9px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: !subject || !body ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: !subject || !body ? 0.4 : 1,
            }}
          >
            {savingDraft ? "Sparar…" : savedDraft ? "Utkast sparat ✓" : "Spara utkast"}
          </button>
          <button
            onClick={() => setStep("confirming")}
            disabled={!subject || !body || step === "confirming"}
            style={{
              background: !subject || !body ? "#8A6E55" : ink,
              color: bg,
              border: "none",
              padding: "9px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: !subject || !body ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: !subject || !body ? 0.5 : 1,
            }}
          >
            Granska och skicka →
          </button>
        </div>
      </div>

      {/* Confirm overlay */}
      {step === "confirming" && (
        <div
          className="rounded-2xl p-6 mb-6 flex items-center justify-between gap-6"
          style={{ background: ink, border: `1px solid ${ink}` }}
        >
          <div>
            <div
              className="text-[10.5px] uppercase tracking-[0.1em] font-semibold mb-1.5"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Klar att skicka
            </div>
            <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 18, color: "white" }}>
              Skicka till {selectedSegment.customer_count} kunder i {selectedSegment.name}?
            </div>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={() => setStep("form")}
              style={{
                background: "transparent",
                color: "rgba(255,255,255,0.6)",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "9px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Avbryt
            </button>
            <button
              onClick={handleSend}
              style={{
                background: bg,
                color: ink,
                border: "none",
                padding: "9px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Skicka nu →
            </button>
          </div>
        </div>
      )}

      {step === "sending" && (
        <div
          className="rounded-2xl p-6 mb-6 flex items-center gap-4"
          style={{ background: ink }}
        >
          <svg
            className="animate-spin"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            style={{ opacity: 0.7 }}
          >
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity="0.25" />
            <path d="M21 12a9 9 0 00-9-9" />
          </svg>
          <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>
            Skickar till {selectedSegment.customer_count} kunder…
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-6">
        {/* Form */}
        <div className="flex flex-col gap-5">
          {/* Step 1 — Segment */}
          <div
            className="rounded-2xl"
            style={{ background: card, border: `1px solid ${border}`, padding: "22px 24px" }}
          >
            <div
              style={{
                fontFamily: "var(--font-fraunces), serif",
                fontSize: 18,
                fontWeight: 500,
                color: ink,
                marginBottom: 14,
              }}
            >
              1. Vem riktar vi oss till?
            </div>
            <div
              className="text-[11.5px] uppercase tracking-[0.1em] font-semibold mb-2.5"
              style={{ color: inkMuted }}
            >
              Segment
            </div>
            <select
              className="w-full rounded-xl px-3.5 py-3 text-sm outline-none"
              style={{
                background: bg,
                border: `1px solid ${border}`,
                color: ink,
                fontFamily: "inherit",
              }}
              value={selectedSegment.type}
              onChange={(e) => {
                const found = segments.find((s) => s.type === e.target.value);
                if (found) {
                  setSelectedSegment(found);
                  setSubject("");
                  setBody("");
                  setSavedDraft(false);
                }
              }}
            >
              {segments.map((seg) => (
                <option key={seg.type} value={seg.type}>
                  {seg.name}
                  {seg.customer_count > 0 ? ` — ${seg.customer_count} kunder` : ""}
                </option>
              ))}
            </select>
            {selectedSegment.customer_count > 0 && (
              <div
                className="flex gap-2.5 items-start mt-3.5 rounded-xl px-3.5 py-3"
                style={{ background: warm }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="#C45224"
                  className="flex-shrink-0 mt-0.5"
                >
                  <path d="M12 2l2 6h6l-5 4 2 7-5-4-5 4 2-7-5-4h6z" />
                </svg>
                <div className="text-[13px] leading-relaxed" style={{ color: inkSoft }}>
                  <strong style={{ color: ink }}>{selectedSegment.name}</strong> ·{" "}
                  {selectedSegment.customer_count} kunder · snitt{" "}
                  {selectedSegment.avg_spent.toLocaleString("sv")} kr per kund
                </div>
              </div>
            )}
            {selectedSegment.customer_count === 0 && (
              <div
                className="mt-3 text-[12.5px] rounded-xl px-3.5 py-2.5"
                style={{ background: warm, color: inkMuted }}
              >
                Inga kunder i det här segmentet just nu.
              </div>
            )}
          </div>

          {/* Step 2 — Channel */}
          <div
            className="rounded-2xl"
            style={{ background: card, border: `1px solid ${border}`, padding: "22px 24px" }}
          >
            <div
              style={{
                fontFamily: "var(--font-fraunces), serif",
                fontSize: 18,
                fontWeight: 500,
                color: ink,
                marginBottom: 14,
              }}
            >
              2. Kanal
            </div>
            <div className="flex gap-2.5">
              {[
                { id: "email", label: "E-post", sub: "Bäst för det här segmentet" },
                { id: "sms", label: "SMS", sub: "Snabb respons" },
                { id: "push", label: "Push", sub: "App-användare" },
              ].map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setChannel(ch.id)}
                  className="flex-1 py-3.5 rounded-xl text-center transition-all"
                  style={{
                    border: `1.5px solid ${channel === ch.id ? ink : border}`,
                    background: channel === ch.id ? ink : "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div
                    className="text-[13px] font-semibold"
                    style={{ color: channel === ch.id ? bg : ink }}
                  >
                    {ch.label}
                  </div>
                  <div
                    className="text-[11px] mt-0.5"
                    style={{
                      color: channel === ch.id ? "rgba(250,245,235,0.7)" : inkMuted,
                    }}
                  >
                    {ch.sub}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3 — Sales rep */}
          {salesReps.length > 0 && (
            <div
              className="rounded-2xl"
              style={{ background: card, border: `1px solid ${border}`, padding: "22px 24px" }}
            >
              <div
                style={{
                  fontFamily: "var(--font-fraunces), serif",
                  fontSize: 18,
                  fontWeight: 500,
                  color: ink,
                  marginBottom: 14,
                }}
              >
                3. Vem skickar?
              </div>
              <div className="flex flex-wrap gap-2.5">
                {salesReps.map((rep) => {
                  const isSelected = selectedRep?.id === rep.id;
                  return (
                    <button
                      key={rep.id}
                      onClick={() => { setSelectedRep(rep); setSavedDraft(false); }}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all"
                      style={{
                        border: `1.5px solid ${isSelected ? ink : border}`,
                        background: isSelected ? ink : "transparent",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0"
                        style={{ background: rep.color }}
                      >
                        {rep.name[0]}
                      </div>
                      <div className="text-left">
                        <div className="text-[13px] font-semibold" style={{ color: isSelected ? bg : ink }}>
                          {rep.name}
                        </div>
                        {rep.email ? (
                          <div className="text-[11px]" style={{ color: isSelected ? "rgba(250,245,235,0.6)" : inkMuted }}>
                            {rep.email}
                          </div>
                        ) : (
                          <div className="text-[11px]" style={{ color: isSelected ? "rgba(250,245,235,0.5)" : "#C4B0A0" }}>
                            Ingen e-post angiven
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedRep && !selectedRep.email && (
                <div
                  className="mt-3 text-[12px] rounded-xl px-3.5 py-2.5"
                  style={{ background: "#FDF0EC", color: "#C45224", border: "1px solid #E8B4A4" }}
                >
                  Lägg till e-post på säljarsidan för att kunder ska kunna svara direkt till {selectedRep.name}.
                </div>
              )}
              {selectedRep?.email && (
                <div
                  className="mt-3 text-[12.5px] rounded-xl px-3.5 py-2.5"
                  style={{ background: warm, color: inkSoft }}
                >
                  Kunder som svarar på mejlet hamnar direkt i {selectedRep.name}s inkorg.
                </div>
              )}
            </div>
          )}

          {/* Step 4 — Content */}
          <div
            className="rounded-2xl"
            style={{ background: card, border: `1px solid ${border}`, padding: "22px 24px" }}
          >
            <div
              style={{
                fontFamily: "var(--font-fraunces), serif",
                fontSize: 18,
                fontWeight: 500,
                color: ink,
                marginBottom: 14,
              }}
            >
              4. Innehåll
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating || selectedSegment.customer_count === 0}
              className="flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1.5 rounded-2xl mb-4"
              style={{
                background: generating ? "#5A4232" : ink,
                color: bg,
                border: "none",
                cursor: generating || selectedSegment.customer_count === 0 ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                opacity: selectedSegment.customer_count === 0 ? 0.4 : 1,
              }}
            >
              {generating ? (
                <>
                  <svg
                    className="animate-spin"
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M21 12a9 9 0 00-9-9" />
                  </svg>
                  HEIRA genererar…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2 6h6l-5 4 2 7-5-4-5 4 2-7-5-4h6z" />
                  </svg>
                  {subject ? "Generera nytt förslag" : "HEIRA skriver ett förslag"}
                </>
              )}
            </button>

            <div
              className="text-[11.5px] uppercase tracking-[0.1em] font-semibold mb-2"
              style={{ color: inkMuted }}
            >
              Ämnesrad
            </div>
            <input
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setSavedDraft(false); }}
              placeholder="Skriv själv eller låt HEIRA generera…"
              className="w-full rounded-xl px-3.5 py-3 text-sm outline-none mb-4"
              style={{
                background: bg,
                border: `1px solid ${border}`,
                color: ink,
                fontFamily: "inherit",
              }}
            />

            <div
              className="text-[11.5px] uppercase tracking-[0.1em] font-semibold mb-2"
              style={{ color: inkMuted }}
            >
              Brödtext
            </div>
            <textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); setSavedDraft(false); }}
              placeholder="Skriv själv eller låt HEIRA generera…"
              className="w-full rounded-xl px-3.5 py-3 text-sm outline-none"
              rows={7}
              style={{
                background: bg,
                border: `1px solid ${border}`,
                color: ink,
                fontFamily: "inherit",
                lineHeight: 1.55,
                resize: "vertical",
              }}
            />
          </div>

          {/* Step 4 — Timing */}
          <div
            className="rounded-2xl"
            style={{ background: card, border: `1px solid ${border}`, padding: "22px 24px" }}
          >
            <div
              style={{
                fontFamily: "var(--font-fraunces), serif",
                fontSize: 18,
                fontWeight: 500,
                color: ink,
                marginBottom: 14,
              }}
            >
              5. Tidpunkt
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {[
                { id: "now", time: "Skicka nu", date: "Direkt", opt: null },
                {
                  id: "sunday",
                  time: "Söndag 19:00",
                  date: "Nästa söndag",
                  opt: "+38% öppningsrate",
                },
                {
                  id: "ai",
                  time: "AI väljer",
                  date: "Per kund, optimalt",
                  opt: "+52% öppningsrate",
                },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTiming(t.id)}
                  className="rounded-xl text-left transition-all"
                  style={{
                    padding: timing === t.id ? "13px" : "14px",
                    border:
                      timing === t.id ? `2px solid ${ink}` : `1px solid ${border}`,
                    background: "transparent",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-fraunces), serif",
                      fontSize: 16,
                      color: ink,
                    }}
                  >
                    {t.time}
                  </div>
                  <div className="text-[11.5px] mt-0.5" style={{ color: inkMuted }}>
                    {t.date}
                  </div>
                  {t.opt && (
                    <div
                      className="text-[11px] mt-1 font-semibold"
                      style={{ color: "#6B7A63" }}
                    >
                      {t.opt}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview */}
        <div
          className="rounded-2xl overflow-hidden sticky top-6"
          style={{
            background: card,
            border: `1px solid ${border}`,
            height: "fit-content",
          }}
        >
          <div
            className="flex justify-between items-center"
            style={{
              padding: "14px 18px",
              borderBottom: `1px solid ${border}`,
              background: warm,
              fontSize: 12,
              fontWeight: 600,
              color: inkSoft,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            <span>Förhandsvisning</span>
            <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
              iPhone · E-post
            </span>
          </div>
          <div style={{ padding: 24 }}>
            <div className="text-[11.5px]" style={{ color: inkMuted }}>
              {brandName} &lt;hej@{brandName.toLowerCase().replace(/\s+/g, "")}.se&gt;
            </div>
            <div
              className="mt-2 leading-snug"
              style={{
                fontFamily: "var(--font-fraunces), serif",
                fontSize: 18,
                color: subject ? ink : inkMuted,
                fontStyle: subject ? "normal" : "italic",
              }}
            >
              {subject || "Ämnesrad visas här…"}
            </div>
            <div
              className="rounded-xl flex items-center justify-center my-4"
              style={{
                height: 160,
                background: "linear-gradient(135deg, #D9896A, #C45224)",
                fontFamily: "var(--font-fraunces), serif",
                fontSize: 26,
                color: "white",
                letterSpacing: "0.05em",
              }}
            >
              {brandName}
            </div>
            <div
              className="text-[13px] leading-relaxed"
              style={{ color: body ? inkSoft : inkMuted, fontStyle: body ? "normal" : "italic" }}
            >
              {body
                ? body
                    .split("\n")
                    .slice(0, 4)
                    .map((line, i) => (
                      <span key={i}>
                        {line}
                        <br />
                      </span>
                    ))
                : "Brödtext visas här efter att HEIRA genererat innehållet…"}
            </div>
            {body && (
              <div
                className="inline-block mt-4 rounded-full px-5 py-3 text-[13px] font-medium"
                style={{ background: ink, color: "white" }}
              >
                Utforska →
              </div>
            )}
            <div
              className="mt-6 pt-4 text-[11px] text-center"
              style={{ borderTop: `1px solid ${border}`, color: inkMuted }}
            >
              {process.env.NEXT_PUBLIC_BRAND_MODE === "rodebjer" ? "With love, Rodebjer" : "Skickat med HEIRA"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
