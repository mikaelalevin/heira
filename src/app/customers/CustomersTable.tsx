"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { parseReturnStats, returnRateColor } from "@/lib/returns";
import { getPrimarySegment, SEGMENT_META, AUTO_SEGMENT_BADGE_COLORS, type CustomerForSegment } from "@/lib/segments";

interface SalesRep {
  id: string;
  name: string;
  color: string;
}

interface Segment {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  total_spent: number | null;
  order_count: number | null;
  sales_rep_id: string | null;
  phone?: string | null;
  last_order_at?: string | null;
  created_at?: string | null;
  ai_prediction?: Record<string, unknown> | null;
  return_stats?: Record<string, unknown> | null;
}

function getRealPrediction(c: Customer): { product: string; date: string; confidence: number } | null {
  const p = c.ai_prediction;
  if (!p || typeof p.product !== "string" || typeof p.date !== "string" || typeof p.confidence !== "number") {
    return null;
  }
  return { product: p.product, date: p.date, confidence: p.confidence };
}

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const border = "#DDD0B5";
const warm = "#F2E8D0";

const SEGMENT_DISPLAY: Record<string, string> = {
  "Stammisar": "Stammis",
};

function segDisplayName(name: string) {
  return SEGMENT_DISPLAY[name] ?? name;
}

// Palette for manual segment badges, cycles by index
const SEG_PALETTE = [
  { bg: "#F4DDD9", text: "#6F3F3A" },
  { bg: "#F2E5C5", text: "#6A4E1B" },
  { bg: "#DDE7D7", text: "#3E4F36" },
  { bg: "#E3D5DC", text: "#4D3540" },
  { bg: "#E8E4DC", text: "#4A3F35" },
];

function segmentColor(index: number) {
  return SEG_PALETTE[index % SEG_PALETTE.length];
}

// Computes the auto-segment badge based on purchase history, using the same
// segment definitions as the segments pages so the two never disagree.
function getAutoSegment(c: Customer): { label: string; bg: string; text: string } | null {
  const type = getPrimarySegment(c as unknown as CustomerForSegment);
  if (!type) return null;
  return { label: SEGMENT_META[type].name, ...AUTO_SEGMENT_BADGE_COLORS[type] };
}

// Positions a fixed-position dropdown below its trigger button, flipping to open
// upward when there isn't enough room below (e.g. rows near the bottom of the table).
function useDropdownPosition(
  open: boolean,
  buttonRef: React.RefObject<HTMLButtonElement | null>,
  dropdownRef: React.RefObject<HTMLDivElement | null>
) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setReady(false);
      return;
    }
    const r = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current?.offsetHeight ?? 0;
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const openAbove = dropdownHeight > 0 && spaceBelow < dropdownHeight + 12 && spaceAbove > spaceBelow;
    setPos({
      top: openAbove ? Math.max(8, r.top - dropdownHeight - 4) : r.bottom + 4,
      left: r.left,
    });
    setReady(true);
  }, [open, buttonRef, dropdownRef]);

  return { pos, ready };
}

function RepPicker({ customerId, currentRepId, salesReps, onAssign }: {
  customerId: string;
  currentRepId: string | null;
  salesReps: SalesRep[];
  onAssign: (customerId: string, repId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentRep = salesReps.find((r) => r.id === currentRepId);
  const { pos, ready } = useDropdownPosition(open, buttonRef, dropdownRef);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function assign(repId: string | null) {
    setSaving(true);
    setOpen(false);
    const supabase = createClient();
    await supabase.from("customers").update({ sales_rep_id: repId }).eq("id", customerId);
    onAssign(customerId, repId);
    setSaving(false);
  }

  const dropdown = open ? (
    <div ref={dropdownRef} style={{ position: "fixed", top: pos.top, left: pos.left, visibility: ready ? "visible" : "hidden", zIndex: 9999, background: "#FFFFFF", border: `1px solid ${border}`, borderRadius: 12, minWidth: 170, padding: "4px 0", boxShadow: "0 4px 16px rgba(26,22,20,0.12)" }}>
      {salesReps.map((rep) => {
        const initials = rep.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
        const isSelected = rep.id === currentRepId;
        return (
          <button key={rep.id} onClick={() => assign(rep.id)} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left" style={{ background: isSelected ? warm : "transparent", color: ink, cursor: "pointer", fontFamily: "inherit", border: "none" }}
            onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = warm; }}
            onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: rep.color, fontSize: 8, fontWeight: 700 }}>{initials}</div>
            <span className="flex-1">{rep.name}</span>
            {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>}
          </button>
        );
      })}
      {currentRepId && (
        <>
          <div style={{ height: 1, background: border, margin: "4px 0" }} />
          <button onClick={() => assign(null)} className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left" style={{ background: "transparent", color: inkMuted, cursor: "pointer", fontFamily: "inherit", border: "none" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = warm)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}>
            Ta bort tilldelning
          </button>
        </>
      )}
    </div>
  ) : null;

  return (
    <div>
      <button ref={buttonRef} onClick={() => setOpen((v) => !v)} disabled={saving}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all"
        style={{ background: currentRep ? currentRep.color + "22" : warm, color: currentRep ? currentRep.color : inkMuted, border: `1px solid ${currentRep ? currentRep.color + "44" : border}`, cursor: saving ? "wait" : "pointer", fontFamily: "inherit" }}>
        {currentRep ? (
          <><div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: currentRep.color }} />{currentRep.name.split(" ")[0]}</>
        ) : (
          <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>Tilldela</>
        )}
      </button>
      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}

function SegmentPicker({ customerId, assignedIds, segments, onToggle }: {
  customerId: string;
  assignedIds: string[];
  segments: Segment[];
  onToggle: (customerId: string, segmentId: string, add: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { pos, ready } = useDropdownPosition(open, buttonRef, dropdownRef);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function toggle(segmentId: string) {
    const adding = !assignedIds.includes(segmentId);
    setSaving(segmentId);
    const supabase = createClient();
    if (adding) {
      await supabase.from("segment_memberships").insert({ customer_id: customerId, segment_id: segmentId });
    } else {
      await supabase.from("segment_memberships").delete().eq("customer_id", customerId).eq("segment_id", segmentId);
    }
    onToggle(customerId, segmentId, adding);
    setSaving(null);
  }

  const assignedSegments = segments.filter((s) => assignedIds.includes(s.id));

  const dropdown = open ? (
    <div ref={dropdownRef} style={{ position: "fixed", top: pos.top, left: pos.left, visibility: ready ? "visible" : "hidden", zIndex: 9999, background: "#FFFFFF", border: `1px solid ${border}`, borderRadius: 12, minWidth: 180, padding: "4px 0", boxShadow: "0 4px 16px rgba(26,22,20,0.12)" }}>
      {segments.length === 0 ? (
        <p className="px-4 py-3 text-[12px]" style={{ color: inkMuted }}>Inga segment skapade ännu.</p>
      ) : (
        segments.map((seg, i) => {
          const isSelected = assignedIds.includes(seg.id);
          const isSaving = saving === seg.id;
          const col = segmentColor(i);
          return (
            <button key={seg.id} onClick={() => toggle(seg.id)} disabled={!!saving}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left"
              style={{ background: isSelected ? warm : "transparent", color: ink, cursor: isSaving ? "wait" : "pointer", fontFamily: "inherit", border: "none" }}
              onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = warm; }}
              onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              <span className="text-[11px] font-medium px-[7px] py-[2px] rounded-lg flex-shrink-0" style={{ background: col.bg, color: col.text }}>{segDisplayName(seg.name)}</span>
              <span className="flex-1" />
              {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ink} strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>}
            </button>
          );
        })
      )}
    </div>
  ) : null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {assignedSegments.map((seg, i) => {
        const col = segmentColor(segments.findIndex((s) => s.id === seg.id));
        return (
          <span key={seg.id} className="text-[11px] font-medium px-[9px] py-[3px] rounded-xl" style={{ background: col.bg, color: col.text }}>
            {segDisplayName(seg.name)}
          </span>
        );
      })}
      {segments.length > 0 && (
        <button ref={buttonRef} onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 px-2 py-[3px] rounded-lg text-[11px] font-medium"
          style={{ background: "transparent", color: inkMuted, border: `1px dashed ${border}`, cursor: "pointer", fontFamily: "inherit" }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
          {assignedSegments.length === 0 ? "Lägg till" : ""}
        </button>
      )}
      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}

export function CustomersTable({ realCustomers, salesReps, segments, initialMemberships, totalCount }: {
  realCustomers: Customer[];
  salesReps: SalesRep[];
  segments: Segment[];
  initialMemberships: Record<string, string[]>;
  totalCount: number;
}) {
  const [repAssignments, setRepAssignments] = useState<Record<string, string | null>>(
    () => Object.fromEntries(realCustomers.map((c) => [c.id, c.sales_rep_id]))
  );
  const [memberships, setMemberships] = useState<Record<string, string[]>>(initialMemberships);
  const [search, setSearch] = useState("");
  const [returnSort, setReturnSort] = useState<"asc" | "desc" | null>(null);

  function toggleReturnSort() {
    setReturnSort((prev) => (prev === "desc" ? "asc" : prev === "asc" ? null : "desc"));
  }

  function handleAssign(customerId: string, repId: string | null) {
    setRepAssignments((prev) => ({ ...prev, [customerId]: repId }));
  }

  function handleSegmentToggle(customerId: string, segmentId: string, add: boolean) {
    setMemberships((prev) => {
      const current = prev[customerId] ?? [];
      return {
        ...prev,
        [customerId]: add ? [...current, segmentId] : current.filter((id) => id !== segmentId),
      };
    });
  }

  const q = search.toLowerCase().trim();

  const filteredReal = q
    ? realCustomers.filter((c) =>
        [c.first_name, c.last_name, c.email, c.phone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    : realCustomers;

  const sortedReal = returnSort
    ? [...filteredReal].sort((a, b) => {
        const ra = parseReturnStats(a.return_stats)?.return_rate ?? -1;
        const rb = parseReturnStats(b.return_stats)?.return_rate ?? -1;
        return returnSort === "desc" ? rb - ra : ra - rb;
      })
    : filteredReal;

  const headers = ["Kund", "Segment", "Totalt köpvärde", "Predikterat nästa köp", "Säljare"];

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-5 -mt-4">
        <p style={{ color: inkMuted, fontSize: 14 }}>
          {totalCount > 0 ? `${totalCount.toLocaleString("sv")} totalt` : "18 421 totalt"}
        </p>
        <div className="relative w-full md:w-60">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök namn, e-post, telefon..."
            className="pl-9 pr-4 py-2 rounded-xl text-[13px] outline-none"
            style={{ background: "#FFFFFF", border: `1px solid ${border}`, color: ink, fontFamily: "inherit", width: "100%" }}
            onFocus={(e) => (e.target.style.borderColor = ink)}
            onBlur={(e) => (e.target.style.borderColor = border)}
          />
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: `1px solid ${border}` }}>
        <div className="overflow-x-auto">
          <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: inkMuted, fontWeight: 500, padding: "14px 22px", borderBottom: `1px solid ${border}`, background: warm }}>
                  Kund
                </th>
                <th style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: inkMuted, fontWeight: 500, padding: "14px 22px", borderBottom: `1px solid ${border}`, background: warm }}>
                  Segment
                </th>
                <th
                  onClick={toggleReturnSort}
                  style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: inkMuted, fontWeight: 500, padding: "14px 22px", borderBottom: `1px solid ${border}`, background: warm, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                >
                  <span className="inline-flex items-center gap-1">
                    Returrate
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={inkMuted} strokeWidth="2.5" style={{ opacity: returnSort ? 1 : 0.35, transform: returnSort === "asc" ? "rotate(180deg)" : undefined }}>
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                </th>
                {headers.slice(2).map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: inkMuted, fontWeight: 500, padding: "14px 22px", borderBottom: `1px solid ${border}`, background: warm }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedReal.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "40px 22px", textAlign: "center", color: inkMuted, fontSize: 14 }}>
                    {q ? "Inga kunder matchar sökningen." : "Inga kunder ännu."}
                  </td>
                </tr>
              ) : (
                  sortedReal.map((c) => {
                    const initials = [c.first_name, c.last_name].filter(Boolean).map((n) => n![0]).join("").toUpperCase() || c.email.slice(0, 2).toUpperCase();
                    const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email;
                    const ltv = c.total_spent ? c.total_spent.toLocaleString("sv") + " kr" : "–";
                    const rep = salesReps.find((r) => r.id === repAssignments[c.id]);
                    const gradient = rep ? `linear-gradient(135deg, ${rep.color}, ${rep.color}99)` : "linear-gradient(135deg, #D9896A, #C07858)";
                    const autoSeg = getAutoSegment(c);
                    const assignedSegIds = memberships[c.id] ?? [];
                    const returnStats = parseReturnStats(c.return_stats);

                    return (
                      <tr key={c.id}
                        style={{ cursor: "pointer" }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#FDFCFA")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("button")) return;
                          window.location.href = `/customers/${c.id}`;
                        }}>
                        <td style={{ padding: "16px 22px", borderBottom: `1px solid ${border}` }}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0" style={{ background: gradient }}>{initials}</div>
                            <div>
                              <div className="font-semibold text-[13.5px]" style={{ color: ink }}>{fullName}</div>
                              <div className="text-xs mt-0.5" style={{ color: inkMuted }}>{c.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "16px 22px", borderBottom: `1px solid ${border}` }}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {autoSeg && (
                              <span className="text-[11px] font-medium px-[9px] py-[3px] rounded-xl" style={{ background: autoSeg.bg, color: autoSeg.text }}>
                                {autoSeg.label}
                              </span>
                            )}
                            <SegmentPicker
                              customerId={c.id}
                              assignedIds={assignedSegIds}
                              segments={segments}
                              onToggle={handleSegmentToggle}
                            />
                          </div>
                        </td>
                        <td style={{ padding: "16px 22px", borderBottom: `1px solid ${border}`, fontSize: 13.5 }}>
                          {returnStats ? (
                            <span
                              className="font-medium"
                              style={{ color: returnRateColor(returnStats.return_rate) }}
                            >
                              {Math.round(returnStats.return_rate * 100)}%
                            </span>
                          ) : (
                            <span style={{ color: inkMuted }}>–</span>
                          )}
                        </td>
                        <td style={{ padding: "16px 22px", borderBottom: `1px solid ${border}`, fontSize: 13.5, color: ink }}>{ltv}</td>
                        {(() => {
                          const pred = getRealPrediction(c);
                          return (
                            <td style={{ padding: "16px 22px", borderBottom: `1px solid ${border}` }}>
                              {pred ? (
                                <>
                                  <div className="text-[13px] font-medium" style={{ color: ink }}>{pred.product}</div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[11.5px]" style={{ color: inkMuted }}>{pred.date}</span>
                                    <span className="text-[11px] px-[7px] py-[2px] rounded-lg font-medium" style={{ background: warm, color: inkMuted }}>{pred.confidence}%</span>
                                  </div>
                                </>
                              ) : (
                                <span style={{ color: inkMuted }}>—</span>
                              )}
                            </td>
                          );
                        })()}
                        <td style={{ padding: "16px 22px", borderBottom: `1px solid ${border}` }}>
                          {salesReps.length > 0 ? (
                            <RepPicker customerId={c.id} currentRepId={repAssignments[c.id] ?? null} salesReps={salesReps} onAssign={handleAssign} />
                          ) : (
                            <span style={{ color: inkMuted, fontSize: 13 }}>–</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
