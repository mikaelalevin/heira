export default function SegmentsPage() {
  const segments = [
    {
      id: "vip",
      name: "VIP-kunder",
      desc: "Dina bästa kunder med tillgång till VIP-rabatt och exklusiva erbjudanden.",
      tag: "Topp 5%",
      gradient: "linear-gradient(135deg, #C9A961 0%, #8A7038 100%)",
      customers: "312",
      ltv: "42 800 kr",
      active: "96%",
    },
    {
      id: "stammisar",
      name: "Stammisar",
      desc: "Återkommande kunder som handlar regelbundet varje säsong.",
      tag: "Mest värdefull",
      gradient: "linear-gradient(135deg, #D9896A 0%, #C45224 100%)",
      customers: "1 284",
      ltv: "14 200 kr",
      active: "92%",
    },
    {
      id: "vanner-familj",
      name: "Vänner & familj",
      desc: "Nära relationer med tillgång till personlig rabatt och tidig tillgång.",
      tag: "Friends & family",
      gradient: "linear-gradient(135deg, #B8A848 0%, #998731 100%)",
      customers: "184",
      ltv: "9 600 kr",
      active: "78%",
    },
    {
      id: "nya",
      name: "Nya kunder",
      desc: "Första köpet inom 30 dagar. Viktigt att skapa ett andra köp snabbt.",
      tag: "Nya",
      gradient: "linear-gradient(135deg, #1A1614 0%, #3D3530 100%)",
      customers: "486",
      ltv: "980 kr",
      active: "34%",
    },
    {
      id: "inaktiva",
      name: "Inaktiva kunder",
      desc: "Har inte handlat på 90+ dagar men har historik hos dig.",
      tag: "Inaktiva",
      gradient: "linear-gradient(135deg, #C4B8A8 0%, #9A8878 100%)",
      customers: "1 642",
      ltv: "6 200 kr",
      active: "42%",
    },
    {
      id: "pa-vag-bort",
      name: "På väg bort",
      desc: "Var aktiva för 60–90 dagar sen. Behöver en anledning att komma tillbaka.",
      tag: "Churn-risk",
      gradient: "linear-gradient(135deg, #7D2027 0%, #4A1218 100%)",
      customers: "412",
      ltv: "9 100 kr",
      active: "68%",
    },
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-9">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-fraunces), serif",
              fontWeight: 400,
              fontSize: 34,
              letterSpacing: "-0.01em",
              color: "#1A1614",
            }}
          >
            Segment
          </h1>
          <p className="mt-1.5" style={{ color: "#8A6E55", fontSize: 14 }}>
            6 AI-genererade segment som uppdateras automatiskt baserat på beteende.
          </p>
        </div>
        <div className="flex gap-2.5">
          <a
            href="/import"
            className="px-4 py-[9px] rounded-lg text-[13px] font-medium"
            style={{ background: "transparent", color: "#1A1614", border: "1px solid #DDD0B5", fontFamily: "inherit", cursor: "pointer", textDecoration: "none" }}
          >
            Importera från Klaviyo
          </a>
          <button
            className="flex items-center gap-1.5 px-4 py-[9px] rounded-lg text-[13px] font-medium"
            style={{ background: "#1A1614", color: "#FAF5EB", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
            Skapa segment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {segments.map((seg) => (
          <a
            key={seg.id}
            href={`/segments/${seg.id}`}
            className="flex flex-col rounded-2xl overflow-hidden transition-all"
            style={{ background: "#FFFFFF", border: "1px solid #DDD0B5", textDecoration: "none" }}
          >
            <div className="relative overflow-hidden" style={{ height: 110, background: seg.gradient }}>
              <div className="absolute inset-0" style={{ opacity: 0.15, backgroundImage: "radial-gradient(circle at 30% 30%, white 0.5px, transparent 1px)", backgroundSize: "22px 22px" }} />
              <span
                className="absolute text-[10.5px] uppercase tracking-[0.08em] font-semibold px-[9px] py-[4px] rounded-xl"
                style={{ top: 14, left: 16, background: "rgba(255,255,255,0.92)", color: "#1A1614" }}
              >
                {seg.tag}
              </span>
            </div>
            <div className="p-5">
              <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 19, fontWeight: 500, color: "#1A1614" }}>{seg.name}</div>
              <div className="mt-1 text-[13px]" style={{ color: "#5A4232" }}>{seg.desc}</div>
              <div className="flex justify-between mt-4 pt-3.5" style={{ borderTop: "1px solid #DDD0B5" }}>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: "#8A6E55" }}>Kunder</div>
                  <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 17, color: "#1A1614", marginTop: 2 }}>{seg.customers}</div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: "#8A6E55" }}>Snitt köpvärde</div>
                  <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 17, color: "#1A1614", marginTop: 2 }}>{seg.ltv}</div>
                </div>
                <div>
                  <div className="text-[10.5px] uppercase tracking-[0.08em] font-medium" style={{ color: "#8A6E55" }}>Aktiv</div>
                  <div style={{ fontFamily: "var(--font-fraunces), serif", fontSize: 17, color: "#1A1614", marginTop: 2 }}>{seg.active}</div>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
