"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const border = "#DDD0B5";
const warm = "#F2E8D0";
const bg = "#FAF5EB";

interface Props {
  brandId: string;
  initialDomain?: string | null;
  initialSyncedAt?: string | null;
  isConnected: boolean;
}

export function ShopifyConnect({ brandId, initialDomain, initialSyncedAt, isConnected: initialConnected }: Props) {
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [connected, setConnected] = useState(initialConnected);
  const [syncedAt, setSyncedAt] = useState(initialSyncedAt);
  const [syncResult, setSyncResult] = useState<{ customersImported: number; ordersImported: number } | null>(null);
  const [error, setError] = useState("");

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const supabase = createClient();
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    const { error: err } = await supabase
      .from("brands")
      .update({ shopify_domain: cleanDomain, shopify_access_token: token })
      .eq("id", brandId);
    if (err) { setError(err.message); setSaving(false); return; }
    setConnected(true);
    setDomain(cleanDomain);
    setToken("");
    setSaving(false);
  }

  async function handleSync() {
    setSyncing(true);
    setError("");
    setSyncResult(null);
    try {
      const res = await fetch("/api/shopify/sync", { method: "POST" });
      const data = await res.json() as { customersImported?: number; ordersImported?: number; error?: string };
      if (!res.ok || data.error) { setError(data.error ?? "Synkronisering misslyckades"); return; }
      setSyncResult({ customersImported: data.customersImported ?? 0, ordersImported: data.ordersImported ?? 0 });
      setSyncedAt(new Date().toISOString());
    } catch { setError("Nätverksfel — försök igen"); }
    finally { setSyncing(false); }
  }

  async function handleDisconnect() {
    const supabase = createClient();
    await supabase.from("brands").update({ shopify_domain: null, shopify_access_token: null, shopify_synced_at: null }).eq("id", brandId);
    setConnected(false);
    setDomain("");
    setToken("");
    setSyncResult(null);
    setSyncedAt(null);
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${border}`, background: "#FFFFFF" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#96BF48" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M15.337 23.979l7.216-1.561s-2.604-17.609-2.625-17.739c-.017-.13-.126-.217-.252-.217-.126 0-2.391-.044-2.391-.044s-1.591-1.539-1.765-1.713v21.274zm-2.234.021L13.059.62C13.029.271 12.741 0 12.387 0c-.009 0-.017 0-.026.001L11.625.13c-.127.032-2.361 1.578-2.361 1.578l-.004-.004.698 22.296 3.145-.02zM9.26 1.708L9.238.22C9.235.098 9.147 0 9.023 0c-.018 0-.035.002-.053.007L7.696.375l.005 1.333H9.26z"/>
            </svg>
          </div>
          <div>
            <div className="font-semibold text-[14px]" style={{ color: ink }}>Shopify</div>
            <div className="text-[12px]" style={{ color: inkMuted }}>
              {connected ? `Kopplad — ${domain}` : "Inte kopplad"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "#DDE7D7", color: "#3E6B2F" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 inline-block" />
              Aktiv
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-5" style={{ background: "#FFFFFF" }}>
        {!connected ? (
          <>
            <p className="text-[13px] leading-relaxed mb-5" style={{ color: inkMuted }}>
              Koppla ditt Shopify-konto för att automatiskt importera kunder och ordrar till HEIRA. Du behöver en Admin API access token från din Shopify-butik.
            </p>

            {/* Instruktioner */}
            <div className="rounded-xl p-4 mb-5" style={{ background: warm }}>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: inkMuted }}>Så här får du din access token</div>
              <ol className="text-[12.5px] leading-relaxed flex flex-col gap-1" style={{ color: ink }}>
                <li>1. Gå till din Shopify Admin → <strong>Inställningar → Appar → Utveckla appar</strong></li>
                <li>2. Klicka <strong>Skapa app</strong> → namnge den "HEIRA"</li>
                <li>3. Under <strong>API-behörigheter</strong> — aktivera läsåtkomst för Kunder och Ordrar</li>
                <li>4. Klicka <strong>Installera app</strong> → kopiera Admin API access token</li>
              </ol>
            </div>

            <form onSubmit={handleConnect} className="flex flex-col gap-4">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-1.5" style={{ color: inkMuted }}>
                  Butiksdomain
                </label>
                <input
                  type="text"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="dinbutik.myshopify.com"
                  required
                  className="w-full px-4 py-3 rounded-xl text-[13px] outline-none"
                  style={{ background: bg, border: `1px solid ${border}`, color: ink, fontFamily: "inherit" }}
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-1.5" style={{ color: inkMuted }}>
                  Admin API Access Token
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="shpat_••••••••••••••••"
                  required
                  className="w-full px-4 py-3 rounded-xl text-[13px] outline-none"
                  style={{ background: bg, border: `1px solid ${border}`, color: ink, fontFamily: "inherit" }}
                />
              </div>
              {error && <p className="text-[12px]" style={{ color: "#C45224" }}>{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold"
                style={{ background: saving ? inkMuted : ink, color: "#FAF5EB", border: "none", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                {saving ? "Kopplar..." : "Koppla Shopify →"}
              </button>
            </form>
          </>
        ) : (
          <>
            {/* Synkstatus */}
            {syncedAt && (
              <div className="text-[12.5px] mb-4" style={{ color: inkMuted }}>
                Senast synkad: {new Date(syncedAt).toLocaleString("sv-SE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </div>
            )}

            {syncResult && (
              <div className="rounded-xl px-4 py-3 mb-4 text-[13px]" style={{ background: "#DDE7D7", color: "#3E4F36" }}>
                ✓ Importerade <strong>{syncResult.customersImported}</strong> kunder och <strong>{syncResult.ordersImported}</strong> ordrar
              </div>
            )}

            {error && <p className="text-[12px] mb-3" style={{ color: "#C45224" }}>{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold"
                style={{ background: syncing ? warm : ink, color: syncing ? inkMuted : "#FAF5EB", border: "none", cursor: syncing ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                {syncing ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Synkroniserar...
                  </>
                ) : "Synka nu"}
              </button>
              <button
                onClick={handleDisconnect}
                className="px-4 py-3 rounded-xl text-[13px] font-medium"
                style={{ background: "transparent", color: inkMuted, border: `1px solid ${border}`, cursor: "pointer", fontFamily: "inherit" }}
              >
                Koppla bort
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
