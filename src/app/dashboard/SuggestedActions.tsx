"use client";

import { useEffect, useState } from "react";

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const border = "#DDD0B5";
const card = "#FFFFFF";
const warm = "#F2E8D0";

type Category = "kuratorer" | "imminent-prediction" | "thank-you" | "win-back";

interface SuggestedAction {
  id: string;
  category: Category;
  priority: number;
  customer: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    return_rate?: number;
  };
  context: string;
  cta_label: string;
  cta_action: "generate-message" | "generate-styling-offer";
}

const CATEGORY_DOT: Record<Category, string> = {
  kuratorer: "#B47A75", // rose
  "imminent-prediction": "#C9A961", // gold
  "thank-you": "#6B7A63", // sage
  "win-back": "#6B4F5B", // plum
};

const CATEGORY_MESSAGE_TYPE: Record<Category, { type: "prediction" | "thank_you" | "follow_up"; context?: string }> = {
  kuratorer: {
    type: "follow_up",
    context: "Kunden returnerar ofta — föreslå en personlig stylingtimme istället för fler köp.",
  },
  "imminent-prediction": { type: "prediction" },
  "thank-you": { type: "thank_you" },
  "win-back": {
    type: "follow_up",
    context: "Kunden har inte handlat på ett tag — skriv en varm påminnelse om att komma tillbaka.",
  },
};

function actionHref(action: SuggestedAction): string {
  const meta = CATEGORY_MESSAGE_TYPE[action.category];
  const params = new URLSearchParams({ action: "generate", type: meta.type });
  if (meta.context) params.set("context", meta.context);
  return `/customers/${action.customer.id}?${params.toString()}`;
}

export function SuggestedActions() {
  const [actions, setActions] = useState<SuggestedAction[] | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/suggested-actions")
      .then((res) => res.json())
      .then((data: { actions?: SuggestedAction[]; total?: number }) => {
        if (cancelled) return;
        setActions(data.actions ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) setActions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (actions === null) {
    return (
      <div className="rounded-2xl mb-5 p-6" style={{ background: card, border: `1px solid ${border}` }}>
        <div className="h-4 w-48 rounded-full" style={{ background: warm }} />
      </div>
    );
  }

  return (
    <div className="rounded-2xl mb-5" style={{ background: card, border: `1px solid ${border}` }}>
      <div className="px-6 py-4 flex items-baseline gap-2" style={{ borderBottom: `1px solid ${border}` }}>
        <h2 style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 18, color: ink }}>
          Idag föreslår HEIRA
        </h2>
        <span className="text-[12.5px]" style={{ color: inkMuted }}>
          · {total} handling{total === 1 ? "" : "ar"}
        </span>
      </div>
      {actions.length === 0 ? (
        <div className="px-6 py-8 text-center text-[13.5px]" style={{ color: inkMuted }}>
          Inget att göra just nu. Allt är i sync.
        </div>
      ) : (
        <div>
          {actions.map((a, i) => {
            const name = [a.customer.first_name, a.customer.last_name].filter(Boolean).join(" ") || a.customer.email;
            return (
              <a
                key={a.id}
                href={actionHref(a)}
                className="flex items-center gap-3.5 px-6 py-4"
                style={{
                  borderBottom: i < actions.length - 1 ? `1px solid ${border}` : "none",
                  textDecoration: "none",
                }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_DOT[a.category] }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold" style={{ color: ink }}>{name}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: inkMuted }}>{a.context}</div>
                </div>
                <span
                  className="flex-shrink-0 text-[12px] font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: warm, color: ink }}
                >
                  {a.cta_label} →
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
