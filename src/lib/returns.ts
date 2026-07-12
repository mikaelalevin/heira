export interface ReturnStats {
  return_rate: number;
  returns_count: number;
  orders_with_returns: number;
  most_returned_type: string;
  most_common_reason: string;
  last_return_at: string;
}

export function parseReturnStats(raw: Record<string, unknown> | null | undefined): ReturnStats | null {
  if (!raw || typeof raw.return_rate !== "number" || typeof raw.returns_count !== "number") return null;
  return raw as unknown as ReturnStats;
}

export const RETURN_REASON_LABELS: Record<string, string> = {
  size: "Storlek",
  fit: "Passform",
  style: "Stil",
  color: "Färg",
  "not-as-expected": "Inte som förväntat",
  "changed-mind": "Ändrat sig",
};

export const RETURN_TYPE_LABELS: Record<string, string> = {
  dress: "Klänning",
  top: "Topp",
  jacket: "Jacka",
  denim: "Denim",
};

// < 15%: neutral · 15–35%: normal · 35–50%: dov varning · 50%+: "Second Thoughts"-nivå
export function returnRateColor(rate: number): string {
  if (rate < 0.15) return "#8A6E55";
  if (rate < 0.35) return "#1A1614";
  if (rate < 0.5) return "#B47A75";
  return "#6B4F5B";
}

export function isSecondThoughtsRisk(rate: number): boolean {
  return rate >= 0.5;
}
