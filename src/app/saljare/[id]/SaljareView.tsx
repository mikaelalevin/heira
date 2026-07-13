"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  total_spent: number | null;
  order_count: number | null;
}

interface SalesRep {
  id: string;
  name: string;
  color: string;
  email: string | null;
}

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const border = "#DDD0B5";
const bg = "#FAF5EB";
const warm = "#F2E8D0";

const COLORS = [
  "#D9896A", "#C45224", "#A8B5A0", "#6B7A63",
  "#C9A961", "#6B4F5B", "#1A1614", "#8A6E55",
];

function getInitials(c: Customer) {
  if (c.first_name && c.last_name) return (c.first_name[0] + c.last_name[0]).toUpperCase();
  if (c.first_name) return c.first_name.slice(0, 2).toUpperCase();
  return c.email.slice(0, 2).toUpperCase();
}

function getFullName(c: Customer) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email;
}

function formatLTV(n: number | null) {
  if (!n) return "–";
  return n.toLocaleString("sv") + " kr";
}

function getProbability(c: Customer) {
  if (!c.order_count || !c.total_spent) return 40;
  return Math.min(95, 30 + c.order_count * 8 + (c.total_spent > 10000 ? 20 : 0));
}

export function SaljareView({
  rep,
  initialAssigned,
  allCustomers,
}: {
  rep: SalesRep;
  initialAssigned: Customer[];
  allCustomers: Customer[];
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState<Customer[]>(initialAssigned);
  const [panelOpen, setPanelOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [assigning, setAssigning] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(rep.name);
  const [editEmail, setEditEmail] = useState(rep.email ?? "");
  const [editColor, setEditColor] = useState(rep.color);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [currentRep, setCurrentRep] = useState(rep);

  const assignedIds = new Set(assigned.map((c) => c.id));
  const unassigned = allCustomers.filter((c) => !assignedIds.has(c.id));
  const filtered = unassigned.filter((c) => {
    const q = search.toLowerCase();
    return (
      getFullName(c).toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  const assignedQ = assignedSearch.toLowerCase().trim();
  const filteredAssigned = assignedQ
    ? assigned.filter((c) =>
        getFullName(c).toLowerCase().includes(assignedQ) || c.email.toLowerCase().includes(assignedQ)
      )
    : assigned;

  const repInitials = currentRep.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const totalLTV = assigned.reduce((sum, c) => sum + (c.total_spent ?? 0), 0);

  useEffect(() => {
    if (panelOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [panelOpen]);

  function handleEditCancel() {
    setEditName(currentRep.name);
    setEditEmail(currentRep.email ?? "");
    setEditColor(currentRep.color);
    setSaveError("");
    setEditing(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    setSaveError("");
    const supabase = createClient();
    const { error } = await supabase
      .from("sales_reps")
      .update({
        name: editName.trim(),
        email: editEmail.trim().toLowerCase() || null,
        color: editColor,
      })
      .eq("id", currentRep.id);

    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }
    setCurrentRep({ ...currentRep, name: editName.trim(), email: editEmail.trim().toLowerCase() || null, color: editColor });
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  async function assignCustomer(customer: Customer) {
    setAssigning(customer.id);
    const supabase = createClient();
    await supabase.from("customers").update({ sales_rep_id: currentRep.id }).eq("id", customer.id);
    setAssigned((prev) => [...prev, customer]);
    setAssigning(null);
  }

  async function removeCustomer(customer: Customer) {
    setRemoving(customer.id);
    const supabase = createClient();
    await supabase.from("customers").update({ sales_rep_id: null }).eq("id", customer.id);
    setAssigned((prev) => prev.filter((c) => c.id !== customer.id));
    setRemoving(null);
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-9">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
            style={{ background: currentRep.color, fontSize: 16 }}
          >
            {repInitials}
          </div>
          <div>
            <h1 style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 34, letterSpacing: "-0.01em", color: ink }}>
              {currentRep.name}
            </h1>
            <p style={{ color: inkMuted, fontSize: 14 }}>
              {assigned.length} kunder{totalLTV > 0 ? ` · ${totalLTV.toLocaleString("sv")} kr totalt köpvärde` : ""}
            </p>
            {currentRep.email && (
              <p className="text-[12.5px] mt-0.5" style={{ color: inkMuted }}>{currentRep.email}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2.5">
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
          <button
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-2 px-4 py-[9px] rounded-lg text-[13px] font-medium"
            style={{ background: ink, color: bg, border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            Lägg till kunder
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <form onSubmit={handleSave} className="mb-6">
          <div className="rounded-2xl p-6 flex flex-col gap-5" style={{ background: "#FFFFFF", border: `1px solid ${border}` }}>
            <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 16, fontWeight: 500, color: ink }}>
              Redigera säljare
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: inkMuted }}>Namn</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Namn"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: bg, border: `1px solid ${border}`, color: ink, fontFamily: "inherit" }}
                  onFocus={(e) => (e.target.style.borderColor = ink)}
                  onBlur={(e) => (e.target.style.borderColor = border)}
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: inkMuted }}>Jobbmail</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="namn@varumärke.se"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: bg, border: `1px solid ${border}`, color: ink, fontFamily: "inherit" }}
                  onFocus={(e) => (e.target.style.borderColor = ink)}
                  onBlur={(e) => (e.target.style.borderColor = border)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.1em] font-semibold mb-3" style={{ color: inkMuted }}>Färg</label>
              <div className="flex gap-2.5 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditColor(c)}
                    className="w-8 h-8 rounded-full transition-all"
                    style={{
                      background: c,
                      border: editColor === c ? `3px solid ${ink}` : "3px solid transparent",
                      outline: editColor === c ? `2px solid ${c}` : "none",
                      outlineOffset: 1,
                    }}
                  />
                ))}
              </div>
            </div>

            {saveError && <p className="text-[12px]" style={{ color: "#C45224" }}>{saveError}</p>}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleEditCancel}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: warm, color: ink, border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={saving || !editName.trim()}
                className="flex-1 py-3 rounded-xl text-sm font-medium"
                style={{ background: saving || !editName.trim() ? inkMuted : ink, color: bg, border: "none", cursor: saving || !editName.trim() ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                {saving ? "Sparar..." : "Spara ändringar →"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Customer table or empty state */}
      {assigned.length === 0 ? (
        <div
          className="rounded-2xl flex flex-col items-center justify-center py-20 gap-4"
          style={{ background: "#FFFFFF", border: `1px dashed ${border}` }}
        >
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: warm }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="1.5" className="w-6 h-6">
              <circle cx="12" cy="8" r="4" /><path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-medium text-sm mb-1" style={{ color: ink }}>Inga kunder tilldelade ännu</p>
            <p className="text-sm" style={{ color: inkMuted }}>Lägg till kunder som {currentRep.name} ansvarar för.</p>
          </div>
          <button
            onClick={() => setPanelOpen(true)}
            className="px-5 py-2.5 rounded-xl text-sm font-medium mt-2"
            style={{ background: ink, color: bg, border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            Lägg till kunder →
          </button>
        </div>
      ) : (
        <>
        <div className="relative w-full md:w-60 mb-4">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={assignedSearch}
            onChange={(e) => setAssignedSearch(e.target.value)}
            placeholder="Sök namn, e-post..."
            className="pl-9 pr-4 py-2 rounded-xl text-[13px] outline-none"
            style={{ background: "#FFFFFF", border: `1px solid ${border}`, color: ink, fontFamily: "inherit", width: "100%" }}
            onFocus={(e) => (e.target.style.borderColor = ink)}
            onBlur={(e) => (e.target.style.borderColor = border)}
          />
        </div>
        <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: `1px solid ${border}` }}>
          <div className="overflow-x-auto">
          <table style={{ width: "100%", minWidth: 560, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Kund", "Totalt köpvärde", "Antal köp", "Sannolikhet", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: inkMuted, fontWeight: 500, padding: "14px 22px", borderBottom: `1px solid ${border}`, background: warm }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAssigned.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "40px 22px", textAlign: "center", color: inkMuted, fontSize: 13.5 }}>
                    Inga kunder matchar sökningen.
                  </td>
                </tr>
              )}
              {filteredAssigned.map((c) => {
                const prob = getProbability(c);
                return (
                  <tr key={c.id}>
                    <td style={{ padding: "16px 22px", borderBottom: `1px solid ${border}` }}>
                      <a href={`/customers/${c.id}`} style={{ textDecoration: "none" }}>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, ${currentRep.color}, ${currentRep.color}99)` }}
                          >
                            {getInitials(c)}
                          </div>
                          <div>
                            <div className="font-semibold text-[13.5px]" style={{ color: ink }}>{getFullName(c)}</div>
                            <div className="text-xs mt-0.5" style={{ color: inkMuted }}>{c.email}</div>
                          </div>
                        </div>
                      </a>
                    </td>
                    <td style={{ padding: "16px 22px", borderBottom: `1px solid ${border}`, fontSize: 13.5, color: ink }}>
                      {formatLTV(c.total_spent)}
                    </td>
                    <td style={{ padding: "16px 22px", borderBottom: `1px solid ${border}`, fontSize: 13.5, color: ink }}>
                      {c.order_count ?? "–"}
                    </td>
                    <td style={{ padding: "16px 22px", borderBottom: `1px solid ${border}` }}>
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-full overflow-hidden" style={{ width: 70, height: 5, background: warm }}>
                          <div style={{ height: "100%", width: `${prob}%`, background: ink, borderRadius: 3 }} />
                        </div>
                        <span className="text-[13.5px]" style={{ color: ink }}>{prob}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "16px 22px", borderBottom: `1px solid ${border}`, textAlign: "right" }}>
                      <button
                        onClick={() => removeCustomer(c)}
                        disabled={removing === c.id}
                        className="text-[12px] px-3 py-1.5 rounded-lg transition-colors"
                        style={{ color: inkMuted, background: "transparent", border: `1px solid ${border}`, cursor: removing === c.id ? "wait" : "pointer", fontFamily: "inherit" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#C45224"; (e.currentTarget as HTMLElement).style.borderColor = "#C45224"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = inkMuted; (e.currentTarget as HTMLElement).style.borderColor = border; }}
                      >
                        {removing === c.id ? "..." : "Ta bort"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
        </>
      )}

      {/* Add customers slide-over panel */}
      {panelOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(26,22,20,0.3)" }}
            onClick={() => setPanelOpen(false)}
          />
          <div
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
            style={{ width: 420, background: "#FFFFFF", borderLeft: `1px solid ${border}`, boxShadow: "-8px 0 32px rgba(26,22,20,0.10)" }}
          >
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: `1px solid ${border}` }}>
              <div>
                <h2 className="font-semibold text-[15px]" style={{ color: ink }}>Lägg till kunder</h2>
                <p className="text-xs mt-0.5" style={{ color: inkMuted }}>Tilldela kunder till {currentRep.name}</p>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ background: warm, border: "none", cursor: "pointer", color: ink }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="px-6 py-4" style={{ borderBottom: `1px solid ${border}` }}>
              <div className="relative">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Sök på namn eller e-post..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-[13px] outline-none"
                  style={{ background: bg, border: `1px solid ${border}`, color: ink, fontFamily: "inherit" }}
                  onFocus={(e) => (e.target.style.borderColor = ink)}
                  onBlur={(e) => (e.target.style.borderColor = border)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {unassigned.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm" style={{ color: inkMuted }}>Alla kunder är redan tilldelade.</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm" style={{ color: inkMuted }}>Inga kunder matchar sökningen.</p>
                </div>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => assignCustomer(c)}
                    disabled={assigning === c.id}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
                    style={{ background: "transparent", border: "none", cursor: assigning === c.id ? "wait" : "pointer", fontFamily: "inherit" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = warm)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #D9896A, #C07858)" }}
                    >
                      {getInitials(c)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium truncate" style={{ color: ink }}>{getFullName(c)}</div>
                      <div className="text-xs truncate mt-0.5" style={{ color: inkMuted }}>{c.email}</div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {c.total_spent ? (
                        <div className="text-[12px] font-medium" style={{ color: ink }}>{formatLTV(c.total_spent)}</div>
                      ) : null}
                      {assigning === c.id ? (
                        <div className="text-[11px]" style={{ color: inkMuted }}>Sparar...</div>
                      ) : (
                        <div className="text-[11px]" style={{ color: "#6B7A63" }}>+ Lägg till</div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>

            <div className="px-6 py-4" style={{ borderTop: `1px solid ${border}` }}>
              <p className="text-xs text-center" style={{ color: inkMuted }}>
                {unassigned.length} kunder utan tilldelad säljare
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
