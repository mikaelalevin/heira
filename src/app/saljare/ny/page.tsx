"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const COLORS = [
  "#D9896A", "#C45224", "#A8B5A0", "#6B7A63",
  "#C9A961", "#6B4F5B", "#1A1614", "#8A6E55",
];

export default function NySaljare() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ink = "#1A1614";
  const bg = "#FAF5EB";
  const border = "#DDD0B5";
  const warm = "#F2E8D0";
  const inkMuted = "#8A6E55";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: brandsData } = await supabase
      .from("brands")
      .select("id")
      .eq("owner_id", user.id)
      .order("created_at")
      .limit(1);

    const brandId = (brandsData?.[0] as { id: string } | undefined)?.id;
    if (!brandId) { setError("Kunde inte hitta varumärket."); setLoading(false); return; }

    const { data, error: err } = await supabase
      .from("sales_reps")
      .insert({ brand_id: brandId, name: name.trim(), email: email.trim().toLowerCase() || null, color })
      .select("id")
      .single();

    if (err) { setError(err.message); setLoading(false); return; }

    const repId = (data as { id: string } | null)?.id;
    router.push(`/saljare/${repId}`);
  }

  return (
    <div className="animate-fade-in max-w-md">
      <a
        href="/customers"
        className="inline-flex items-center gap-1.5 text-[13px] mb-8"
        style={{ color: inkMuted, textDecoration: "none" }}
      >
        ← Tillbaka
      </a>

      <h1
        className="mb-1"
        style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 34, color: ink }}
      >
        Lägg till säljare
      </h1>
      <p className="mb-8" style={{ color: inkMuted, fontSize: 14 }}>
        Säljaren får en personlig kundlista i sidomenyn.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div
          className="rounded-2xl p-6 flex flex-col gap-5"
          style={{ background: "#FFFFFF", border: `1px solid ${border}` }}
        >
          <div>
            <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: inkMuted }}>
              Namn
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="t.ex. Mikaela"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: bg, border: `1px solid ${border}`, color: ink, fontFamily: "inherit" }}
              onFocus={(e) => (e.target.style.borderColor = ink)}
              onBlur={(e) => (e.target.style.borderColor = border)}
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: inkMuted }}>
              Jobbmail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="t.ex. mikaela@rodebjer.com"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ background: bg, border: `1px solid ${border}`, color: ink, fontFamily: "inherit" }}
              onFocus={(e) => (e.target.style.borderColor = ink)}
              onBlur={(e) => (e.target.style.borderColor = border)}
            />
            <p className="text-[11.5px] mt-1.5" style={{ color: inkMuted }}>
              Används som avsändare i AI-genererade meddelanden.
            </p>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-3" style={{ color: inkMuted }}>
              Färg i sidomenyn
            </label>
            <div className="flex gap-2.5 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full transition-all"
                  style={{
                    background: c,
                    border: color === c ? `3px solid ${ink}` : "3px solid transparent",
                    outline: color === c ? `2px solid ${c}` : "none",
                    outlineOffset: 1,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: warm }}>
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0"
              style={{ background: color, fontSize: 9, fontWeight: 700 }}
            >
              {name ? name.slice(0, 2).toUpperCase() : "??"}
            </div>
            <span className="text-[13px] font-medium" style={{ color: ink }}>
              {name || "Säljarens namn"}
            </span>
          </div>
        </div>

        {error && <p className="text-sm" style={{ color: "#C45224" }}>{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-3 rounded-xl text-sm font-medium"
            style={{ background: warm, color: ink, border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex-1 py-3 rounded-xl text-sm font-medium"
            style={{
              background: loading || !name.trim() ? "#8A6E55" : ink,
              color: bg,
              border: "none",
              cursor: loading || !name.trim() ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {loading ? "Sparar..." : "Skapa säljare →"}
          </button>
        </div>
      </form>
    </div>
  );
}
