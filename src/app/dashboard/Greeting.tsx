"use client";

const ink = "#1A1614";
const inkMuted = "#8A6E55";
const rodebjerInk = "#212326";
const rodebjerInkMuted = "#8A8880";

const isRodebjerMode = process.env.NEXT_PUBLIC_BRAND_MODE === "rodebjer";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 10) return "God morgon";
  if (h < 12) return "God förmiddag";
  if (h < 18) return "God eftermiddag";
  if (h < 22) return "God kväll";
  return "God natt";
}

function getRodebjerSubtitle() {
  const h = new Date().getHours();
  if (h < 12) return "God morgon från Gotland.";
  if (h < 17) return "God eftermiddag.";
  return "God kväll.";
}

export function Greeting({ brandName }: { brandName?: string }) {
  if (isRodebjerMode) {
    return (
      <div className="mb-9">
        <h1 className="leading-tight" style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 34, letterSpacing: "-0.01em", color: rodebjerInk }}>
          Dear {brandName || "friend"}
        </h1>
        <p className="mt-1.5" style={{ color: rodebjerInkMuted, fontSize: 14 }}>
          {getRodebjerSubtitle()}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-9">
      <h1 className="leading-tight" style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: 34, letterSpacing: "-0.01em", color: ink }}>
        {getGreeting()}{brandName ? `, ${brandName}` : ""}.
      </h1>
      <p className="mt-1.5" style={{ color: inkMuted, fontSize: 14 }}>
        HEIRA har 3 förslag för dig idag.
      </p>
    </div>
  );
}
