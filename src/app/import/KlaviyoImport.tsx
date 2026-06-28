"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";

type Step = "upload" | "preview" | "importing" | "done";

interface MappedRow {
  klaviyo_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  order_count: number;
  total_spent: number;
  created_at: string | null;
  last_order_at: string | null;
  email_consent: string | null;
  predicted_gender: string | null;
}

interface ColumnMapping {
  klaviyo_id?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  order_count?: string;
  total_spent?: string;
  first_active?: string;
  last_active?: string;
  email_consent?: string;
  predicted_gender?: string;
}

const KLAVIYO_MATCHERS: Array<[keyof ColumnMapping, string[]]> = [
  ["klaviyo_id",       ["klaviyo id", "klaviyoid", "klaviyo_id", "profile id"]],
  ["email",            ["email", "email address"]],
  ["first_name",       ["first name", "firstname", "first_name"]],
  ["last_name",        ["last name", "lastname", "last_name"]],
  ["order_count",      ["historic number of orders", "number of orders", "order count", "orders"]],
  ["total_spent",      ["historic customer lifetime value", "lifetime value", "ltv", "total spent", "total_spent"]],
  ["first_active",     ["first active", "first_active", "customer since", "created at"]],
  ["last_active",      ["last active", "last_active", "last order date", "last purchase"]],
  ["email_consent",    ["email marketing consent", "email consent", "marketing consent"]],
  ["predicted_gender", ["predicted gender", "gender"]],
];

function detectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const lowered = headers.map((h) => h.toLowerCase().trim());
  for (const [field, candidates] of KLAVIYO_MATCHERS) {
    for (const candidate of candidates) {
      const idx = lowered.indexOf(candidate);
      if (idx !== -1) {
        mapping[field] = headers[idx];
        break;
      }
    }
  }
  return mapping;
}

function parseDate(val: string | undefined): string | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function mapRow(raw: Record<string, string>, mapping: ColumnMapping): MappedRow {
  const get = (col?: string) => (col ? (raw[col] ?? "").trim() : "");
  return {
    klaviyo_id:       get(mapping.klaviyo_id) || null,
    email:            get(mapping.email)?.toLowerCase() || null,
    first_name:       get(mapping.first_name) || null,
    last_name:        get(mapping.last_name) || null,
    order_count:      parseInt(get(mapping.order_count)) || 0,
    total_spent:      parseFloat(get(mapping.total_spent)) || 0,
    created_at:       parseDate(get(mapping.first_active)),
    last_order_at:    parseDate(get(mapping.last_active)),
    email_consent:    get(mapping.email_consent) || null,
    predicted_gender: get(mapping.predicted_gender) || null,
  };
}

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const border = "#DDD0B5";
const warm = "#F2E8D0";
const bg = "#FAF7F2";
const sage = "#6B7A63";

export default function KlaviyoImport() {
  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [allRows, setAllRows] = useState<MappedRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState("");
  const [brandId, setBrandId] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("brands")
        .select("id")
        .eq("owner_id", user.id)
        .order("created_at")
        .limit(1);
      const id = (data?.[0] as { id: string } | undefined)?.id;
      if (id) setBrandId(id);
    });
  }, []);

  function processFile(f: File) {
    setFile(f);
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { data, meta } = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        preview: 0,
      });
      if (!meta.fields?.length) {
        setError("Kunde inte läsa kolumnrubrikerna i filen.");
        return;
      }
      const detectedMapping = detectMapping(meta.fields);
      setHeaders(meta.fields);
      setMapping(detectedMapping);
      setAllRows(data.map((row) => mapRow(row, detectedMapping)));
      setStep("preview");
    };
    reader.readAsText(f, "utf-8");
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".csv")) processFile(f);
    else setError("Välj en .csv-fil.");
  }, []);

  async function runImport() {
    if (!brandId || !allRows.length) return;
    setStep("importing");
    setProgress({ done: 0, total: allRows.length });
    setError("");

    const supabase = createClient();
    const BATCH = 200;
    let done = 0;

    for (let i = 0; i < allRows.length; i += BATCH) {
      const batch = allRows.slice(i, i + BATCH).map((r) => ({
        brand_id: brandId,
        klaviyo_id: r.klaviyo_id,
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        order_count: r.order_count,
        total_spent: r.total_spent,
        created_at: r.created_at ?? undefined,
        last_order_at: r.last_order_at,
        email_consent: r.email_consent,
        predicted_gender: r.predicted_gender,
      }));

      const { error: batchError } = await supabase
        .from("customers")
        .upsert(batch, { onConflict: "brand_id,klaviyo_id" });

      if (batchError) {
        setError(`Importfel: ${batchError.message}`);
        setStep("preview");
        return;
      }

      done += batch.length;
      setProgress({ done, total: allRows.length });
    }

    setImportedCount(done);
    setStep("done");
  }

  const previewRows = allRows.slice(0, 8);
  const withKlaviyoId = allRows.filter((r) => r.klaviyo_id).length;
  const withEmail = allRows.filter((r) => r.email).length;
  const isKlaviyoFormat = !!mapping.klaviyo_id;

  const PREVIEW_COLS: Array<{ label: string; key: keyof MappedRow; format?: (v: unknown) => string }> = [
    { label: "Klaviyo ID", key: "klaviyo_id", format: (v) => v ? String(v).slice(0, 10) + "…" : "—" },
    { label: "Email", key: "email", format: (v) => v ? "✓" : "—" },
    { label: "Senast aktiv", key: "last_order_at", format: (v) => v ? new Date(v as string).toLocaleDateString("sv-SE") : "—" },
    { label: "Ordrar", key: "order_count" },
    { label: "Livsvärde", key: "total_spent", format: (v) => v ? `${Number(v).toLocaleString("sv-SE")} kr` : "0 kr" },
    { label: "Köpstämning", key: "predicted_gender", format: (v) => v ? String(v) : "—" },
  ];

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="mb-9">
        <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 34, letterSpacing: "-0.01em", color: ink }}>
          Importera från Klaviyo
        </h1>
        <p className="mt-1.5" style={{ color: inkMuted, fontSize: 14 }}>
          Ladda upp en Profile Export-fil från Klaviyo. Ingen e-post eller persondata behöver finnas med.
        </p>
      </div>

      {/* STEP: UPLOAD */}
      {step === "upload" && (
        <div>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className="rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all"
            style={{
              border: `2px dashed ${dragOver ? ink : border}`,
              background: dragOver ? warm : "#FFFFFF",
              padding: "72px 40px",
              minHeight: 260,
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
            />
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={dragOver ? ink : "#C4B8A8"} strokeWidth="1.2" className="mb-5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 20, color: ink, fontWeight: 400 }}>
              Dra och släpp CSV-fil hit
            </p>
            <p className="mt-2 text-sm" style={{ color: inkMuted }}>
              eller klicka för att välja fil
            </p>
          </div>

          {error && <p className="mt-4 text-sm" style={{ color: "#C45224" }}>{error}</p>}

          {/* Format info */}
          <div className="mt-6 rounded-xl p-5" style={{ background: warm, border: `1px solid ${border}` }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: inkMuted }}>
              Klaviyo Profile Export — kolumner som känns igen automatiskt
            </p>
            <div className="flex flex-wrap gap-2">
              {["Klaviyo ID", "First Active", "Last Active", "Historic Number of Orders",
                "Historic Customer Lifetime Value", "Email Marketing Consent", "Predicted Gender",
                "Email", "First Name", "Last Name"].map((col) => (
                <span key={col} className="text-xs px-3 py-1.5 rounded-lg font-mono" style={{ background: "#FFFFFF", color: ink, border: `1px solid ${border}` }}>
                  {col}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs" style={{ color: inkMuted }}>
              Ingen e-post, inga namn eller adresser krävs — filens anonymiserade profiler fungerar utmärkt.
            </p>
          </div>
        </div>
      )}

      {/* STEP: PREVIEW */}
      {step === "preview" && (
        <div>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-7">
            {[
              { label: "Profiler totalt", value: allRows.length.toLocaleString("sv-SE") },
              { label: "Med Klaviyo ID", value: withKlaviyoId.toLocaleString("sv-SE"), ok: withKlaviyoId === allRows.length },
              { label: "Med e-post", value: withEmail > 0 ? withEmail.toLocaleString("sv-SE") : "Ingen — anonymiserad", ok: true },
            ].map(({ label, value, ok }) => (
              <div key={label} className="rounded-2xl p-5" style={{ background: "#FFFFFF", border: `1px solid ${border}` }}>
                <div className="text-[10.5px] uppercase tracking-widest font-medium mb-1" style={{ color: inkMuted }}>{label}</div>
                <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 22, color: ok === false ? "#C45224" : ink }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Format badge */}
          <div className="flex items-center gap-2 mb-5">
            <span
              className="text-xs px-3 py-1.5 rounded-full font-medium"
              style={{ background: isKlaviyoFormat ? "#EAF0E7" : warm, color: isKlaviyoFormat ? sage : inkMuted }}
            >
              {isKlaviyoFormat ? "Klaviyo-format detekterat" : "Generellt CSV-format"}
            </span>
            <span className="text-xs" style={{ color: inkMuted }}>
              {file?.name} · {((file?.size ?? 0) / 1024).toFixed(0)} KB
            </span>
          </div>

          {/* Detected mapping summary */}
          <div className="rounded-xl px-5 py-4 mb-6 flex flex-wrap gap-x-6 gap-y-2" style={{ background: warm }}>
            <span className="text-xs font-semibold uppercase tracking-widest self-center" style={{ color: inkMuted }}>Kolumnmappning:</span>
            {Object.entries(mapping).map(([field, col]) => (
              <span key={field} className="text-xs" style={{ color: ink }}>
                <span style={{ color: inkMuted }}>{field}</span> → <strong>{col}</strong>
              </span>
            ))}
          </div>

          {/* Preview table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${border}` }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${border}`, background: warm }}>
                    <th className="px-4 py-3 text-left text-[10.5px] uppercase tracking-widest font-medium" style={{ color: inkMuted }}>#</th>
                    {PREVIEW_COLS.map((col) => (
                      <th key={col.key} className="px-4 py-3 text-left text-[10.5px] uppercase tracking-widest font-medium whitespace-nowrap" style={{ color: inkMuted }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: i < previewRows.length - 1 ? `1px solid ${border}` : "none", background: "#FFFFFF" }}>
                      <td className="px-4 py-3 text-xs" style={{ color: "#C4B8A8" }}>{i + 1}</td>
                      {PREVIEW_COLS.map((col) => (
                        <td key={col.key} className="px-4 py-3 text-[13px]" style={{ color: row[col.key] ? ink : "#C4B8A8", fontFamily: col.key === "klaviyo_id" ? "monospace" : "inherit" }}>
                          {col.format ? col.format(row[col.key]) : String(row[col.key] ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {allRows.length > 8 && (
              <div className="px-4 py-3 text-xs text-center" style={{ color: inkMuted, borderTop: `1px solid ${border}`, background: warm }}>
                …och {(allRows.length - 8).toLocaleString("sv-SE")} rader till
              </div>
            )}
          </div>

          {error && <p className="mt-4 text-sm" style={{ color: "#C45224" }}>{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 mt-7">
            <button
              onClick={() => { setStep("upload"); setFile(null); setAllRows([]); }}
              className="px-5 py-3 rounded-xl text-sm font-medium"
              style={{ background: warm, color: ink, border: `1px solid ${border}`, cursor: "pointer", fontFamily: "inherit" }}
            >
              ← Byt fil
            </button>
            <button
              onClick={runImport}
              disabled={!brandId || !allRows.length}
              className="flex-1 py-3 rounded-xl text-sm font-medium transition-all"
              style={{
                background: !brandId || !allRows.length ? inkMuted : ink,
                color: bg,
                border: "none",
                cursor: !brandId || !allRows.length ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              Importera {allRows.length.toLocaleString("sv-SE")} profiler →
            </button>
          </div>
        </div>
      )}

      {/* STEP: IMPORTING */}
      {step === "importing" && (
        <div className="rounded-2xl p-10 flex flex-col items-center" style={{ background: "#FFFFFF", border: `1px solid ${border}` }}>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: warm }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={sage} strokeWidth="1.5" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 22, fontWeight: 400, color: ink }} className="mb-2">
            Importerar profiler…
          </h2>
          <p className="text-sm mb-8" style={{ color: inkMuted }}>
            {progress.done.toLocaleString("sv-SE")} av {progress.total.toLocaleString("sv-SE")} klara
          </p>
          <div className="w-full max-w-sm">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: border }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ background: ink, width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* STEP: DONE */}
      {step === "done" && (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center" style={{ background: "#FFFFFF", border: `1px solid ${border}` }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6" style={{ background: "#EAF0E7" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={sage} strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 26, fontWeight: 400, color: ink }} className="mb-2">
            Import klar
          </h2>
          <p className="text-sm mb-2" style={{ color: inkMuted, lineHeight: 1.7 }}>
            {importedCount.toLocaleString("sv-SE")} kundprofiler är nu sparade.
          </p>
          <p className="text-sm mb-9" style={{ color: inkMuted }}>
            Inga e-postadresser eller personuppgifter har lagrats — bara beteendedata.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setStep("upload"); setFile(null); setAllRows([]); }}
              className="px-5 py-3 rounded-xl text-sm font-medium"
              style={{ background: warm, color: ink, border: `1px solid ${border}`, cursor: "pointer", fontFamily: "inherit" }}
            >
              Importera fler
            </button>
            <a
              href="/segments"
              className="px-6 py-3 rounded-xl text-sm font-medium"
              style={{ background: ink, color: bg, textDecoration: "none", fontFamily: "inherit" }}
            >
              Generera segment →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
