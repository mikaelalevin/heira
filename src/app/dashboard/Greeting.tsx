"use client";

const ink = "#1A1614";
const inkMuted = "#8A6E55";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 10) return "God morgon";
  if (h < 12) return "God förmiddag";
  if (h < 18) return "God eftermiddag";
  if (h < 22) return "God kväll";
  return "God natt";
}

export function Greeting({ brandName }: { brandName?: string }) {
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
