"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";

type Step = "brand" | "import" | "done";

interface CsvRow {
  email?: string;
  first_name?: string;
  last_name?: string;
  total_spent?: string;
  order_count?: string;
  order_date?: string;
  order_total?: string;
  order_id?: string;
  [key: string]: string | undefined;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("brand");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Brand step
  const [brandName, setBrandName] = useState("");
  const [brandId, setBrandId] = useState("");

  // If user already has a brand, jump straight to import step
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: brandsData } = await supabase
        .from("brands")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at")
        .limit(1);
      const existing = (brandsData?.[0] as { id: string } | undefined)?.id;
      if (existing) {
        setBrandId(existing);
        setStep("import");
      }
    });
  }, []);

  // Import step
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvType, setCsvType] = useState<"customers" | "orders">("customers");
  const [importProgress, setImportProgress] = useState<{
    total: number;
    done: number;
  } | null>(null);

  async function createBrand(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const slug = brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const { data, error } = await supabase
      .from("brands")
      .insert({ name: brandName, slug, owner_id: user.id })
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setBrandId(data.id);
    setStep("import");
    setLoading(false);
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) setCsvFile(file);
  }, []);

  async function importCsv() {
    if (!csvFile || !brandId) return;
    setLoading(true);
    setError("");

    const supabase = createClient();

    const text = await csvFile.text();
    const { data: rows } = Papa.parse<CsvRow>(text, {
      header: true,
      skipEmptyLines: true,
    });

    if (!rows.length) {
      setError("Filen verkar vara tom.");
      setLoading(false);
      return;
    }

    setImportProgress({ total: rows.length, done: 0 });

    const BATCH = 50;
    let done = 0;

    if (csvType === "customers") {
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const customers = batch
          .filter((r) => r.email)
          .map((r) => ({
            brand_id: brandId,
            email: r.email!.trim().toLowerCase(),
            first_name: r.first_name?.trim() || null,
            last_name: r.last_name?.trim() || null,
            total_spent: parseFloat(r.total_spent || "0") || 0,
            order_count: parseInt(r.order_count || "0") || 0,
          }));

        if (customers.length) {
          const { error } = await supabase.from("customers").upsert(customers, {
            onConflict: "brand_id,email",
          });
          if (error) console.error("Batch error:", error.message);
        }

        done += batch.length;
        setImportProgress({ total: rows.length, done });
      }
    } else {
      // Orders CSV: expected columns: customer_email, order_id, total, order_date, items (JSON string)
      const { data: existingCustomers } = await supabase
        .from("customers")
        .select("id, email")
        .eq("brand_id", brandId);

      const emailToId = new Map(
        (existingCustomers || []).map((c) => [c.email, c.id])
      );

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const orders = batch
          .filter((r) => r.email && emailToId.has(r.email.trim().toLowerCase()))
          .map((r) => ({
            customer_id: emailToId.get(r.email!.trim().toLowerCase())!,
            total: parseFloat(r.order_total || "0") || 0,
            created_at: r.order_date || new Date().toISOString(),
            items: [],
            shopify_order_id: r.order_id || null,
          }));

        if (orders.length) {
          await supabase.from("orders").insert(orders);
        }

        done += batch.length;
        setImportProgress({ total: rows.length, done });
      }
    }

    setStep("done");
    setLoading(false);
  }

  const ink = "#1A1614";
  const inkMuted = "#8A6E55";
  const border = "#DDD0B5";
  const warm = "#F2E8D0";
  const card = "#FFFFFF";
  const bg = "#FAF5EB";

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
      <div className="w-full max-w-lg px-4">
        {/* Logo + progress */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: "#C45224" }} />
            <span
              className="text-2xl tracking-widest"
              style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, color: ink }}
            >
              HEIRA
            </span>
          </div>
          <div className="flex gap-2">
            {(["brand", "import", "done"] as Step[]).map((s, i) => (
              <div
                key={s}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: step === s ? 24 : 8,
                  background: step === s || (i < ["brand", "import", "done"].indexOf(step)) ? ink : border,
                }}
              />
            ))}
          </div>
        </div>

        <div
          className="rounded-2xl p-8"
          style={{ background: card, border: `1px solid ${border}` }}
        >
          {step === "brand" && (
            <>
              <h1
                className="text-3xl mb-1"
                style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, color: ink }}
              >
                Berätta om ditt varumärke
              </h1>
              <p className="text-sm mb-8" style={{ color: inkMuted }}>
                Det tar 60 sekunder att komma igång.
              </p>

              <form onSubmit={createBrand} className="flex flex-col gap-5">
                <div>
                  <label className="block text-xs mb-2 uppercase tracking-widest" style={{ color: inkMuted, fontWeight: 500 }}>
                    Varumärkets namn
                  </label>
                  <input
                    type="text"
                    required
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="Studio Acacia"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: bg, border: `1px solid ${border}`, color: ink, fontFamily: "inherit" }}
                    onFocus={(e) => (e.target.style.borderColor = ink)}
                    onBlur={(e) => (e.target.style.borderColor = border)}
                  />
                </div>

                {error && <p className="text-sm" style={{ color: "#C45224" }}>{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !brandName.trim()}
                  className="w-full py-3 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: loading || !brandName.trim() ? "#8A6E55" : ink,
                    color: bg,
                    fontFamily: "inherit",
                    border: "none",
                    cursor: loading || !brandName.trim() ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Skapar..." : "Fortsätt →"}
                </button>
              </form>
            </>
          )}

          {step === "import" && (
            <>
              <h1
                className="text-3xl mb-1"
                style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, color: ink }}
              >
                Importera kunddata
              </h1>
              <p className="text-sm mb-6" style={{ color: inkMuted }}>
                Ladda upp en CSV med dina kunder eller ordrar. Du kan hoppa över det här och lägga till data senare.
              </p>

              {/* Type toggle */}
              <div className="flex gap-2 mb-6">
                {(["customers", "orders"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setCsvType(type)}
                    className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      background: csvType === type ? ink : warm,
                      color: csvType === type ? bg : inkMuted,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {type === "customers" ? "Kunder" : "Ordrar"}
                  </button>
                ))}
              </div>

              {/* Column guide */}
              <div
                className="rounded-xl p-4 mb-6 text-xs"
                style={{ background: warm, color: inkMuted, lineHeight: 1.7 }}
              >
                {csvType === "customers" ? (
                  <>
                    <strong style={{ color: ink }}>Förväntade kolumner (kunder):</strong>
                    <br />
                    <code>email</code> (obligatorisk) · <code>first_name</code> · <code>last_name</code> · <code>total_spent</code> · <code>order_count</code>
                  </>
                ) : (
                  <>
                    <strong style={{ color: ink }}>Förväntade kolumner (ordrar):</strong>
                    <br />
                    <code>email</code> (kopplar till kund) · <code>order_id</code> · <code>order_total</code> · <code>order_date</code>
                  </>
                )}
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleFileDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById("csv-input")?.click()}
                className="rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all mb-6"
                style={{
                  border: `2px dashed ${csvFile ? ink : border}`,
                  padding: "40px 20px",
                  background: csvFile ? warm : "transparent",
                }}
              >
                <input
                  id="csv-input"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                />
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={csvFile ? ink : inkMuted} strokeWidth="1.5" className="mb-3">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <p className="text-sm font-medium" style={{ color: csvFile ? ink : inkMuted }}>
                  {csvFile ? csvFile.name : "Dra och släpp CSV-fil eller klicka"}
                </p>
                {csvFile && (
                  <p className="text-xs mt-1" style={{ color: inkMuted }}>
                    {(csvFile.size / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>

              {importProgress && (
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1" style={{ color: inkMuted }}>
                    <span>Importerar...</span>
                    <span>{importProgress.done}/{importProgress.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: border }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        background: ink,
                        width: `${(importProgress.done / importProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {error && <p className="text-sm mb-4" style={{ color: "#C45224" }}>{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="flex-1 py-3 rounded-xl text-sm font-medium"
                  style={{ background: warm, color: ink, border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Hoppa över
                </button>
                <button
                  onClick={importCsv}
                  disabled={!csvFile || loading}
                  className="flex-1 py-3 rounded-xl text-sm font-medium"
                  style={{
                    background: !csvFile || loading ? "#8A6E55" : ink,
                    color: bg,
                    border: "none",
                    cursor: !csvFile || loading ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {loading ? "Importerar..." : "Importera →"}
                </button>
              </div>
            </>
          )}

          {step === "done" && (
            <div className="text-center py-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: warm }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7A63" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2
                className="text-2xl mb-2"
                style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, color: ink }}
              >
                Du är redo!
              </h2>
              <p className="text-sm mb-8" style={{ color: inkMuted, lineHeight: 1.6 }}>
                Dina kunddata är importerade. HEIRA är redo att börja analysera och generera insikter.
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-8 py-3 rounded-xl text-sm font-medium"
                style={{ background: ink, color: bg, border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                Gå till dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
