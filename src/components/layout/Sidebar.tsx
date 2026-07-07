"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

interface SalesRep { id: string; name: string; color: string; }
interface NavItem { href: string; label: string; icon: React.ReactNode; badge?: string | number; }

function DashboardIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>;
}
function SegmentsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><circle cx="9" cy="9" r="5" /><circle cx="16" cy="15" r="5" /></svg>;
}
function CustomersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v2" /></svg>;
}
function CampaignsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M3 8l9-5 9 5-9 5-9-5z" /><path d="M3 14l9 5 9-5" /><path d="M3 11l9 5 9-5" /></svg>;
}
function TrendsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></svg>;
}
function AiIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M12 2l3 7h7l-5.5 4 2 7-6.5-4.5L5.5 20l2-7L2 9h7z" /></svg>;
}
function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
}

const isRodebjerMode = process.env.NEXT_PUBLIC_BRAND_MODE === "rodebjer";

function Logo({ size }: { size: "desktop" | "mobile" }) {
  if (isRodebjerMode) {
    return (
      <div className="flex flex-col items-start">
        <span style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, fontSize: size === "desktop" ? 20 : 17, color: "#212326" }}>HEIRA</span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div style={{ width: 14, height: 1, background: "#8A8880" }} />
          <span style={{ fontFamily: "var(--font-inter), sans-serif", fontWeight: 300, fontSize: 11, color: "#8A8880" }}>for Rodebjer</span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-2">
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#C45224" }} />
      <span className={size === "desktop" ? "text-[28px] tracking-[0.08em]" : "text-[22px] tracking-[0.08em]"} style={{ fontFamily: "var(--font-fraunces), serif", fontWeight: 400, color: "#1A1614" }}>HEIRA</span>
    </div>
  );
}

interface SidebarProps {
  brandName?: string;
  userInitials?: string;
  userEmail?: string;
  salesReps?: SalesRep[];
}

export function Sidebar({ brandName = "Ditt varumärke", userInitials = "?", userEmail = "", salesReps = [] }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const mainNav: NavItem[] = [
    { href: "/dashboard", label: "Översikt", icon: <DashboardIcon /> },
    { href: "/ai-recommendations", label: "AI-prediktioner", icon: <AiIcon /> },
    { href: "/customers", label: "Alla kunder", icon: <CustomersIcon /> },
    { href: "/segments", label: "Segment", icon: <SegmentsIcon />, badge: 6 },
    { href: "/campaigns", label: "Kampanjer", icon: <CampaignsIcon /> },
  ];
  const insightsNav: NavItem[] = [
    { href: "/trends", label: "Försäljning", icon: <TrendsIcon /> },
  ];
  const configNav: NavItem[] = [
    { href: "/settings", label: "Integrationer", icon: <SettingsIcon /> },
  ];

  function NavLink({ item }: { item: NavItem }) {
    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
    const isAi = item.href === "/ai-recommendations";
    const activeBg = isAi ? "#6B4F5B" : "#1A1614";
    return (
      <Link href={item.href} className="flex items-center gap-3 px-3 py-[9px] rounded-lg text-[13.5px] font-medium transition-all"
        style={{ background: isActive ? activeBg : "transparent", color: isActive ? "#FAF5EB" : "#5A4232" }}
        onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = isAi ? "#EDE4EC" : "#F2E8D0"; (e.currentTarget as HTMLElement).style.color = isAi ? "#6B4F5B" : "#1A1614"; } }}
        onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#5A4232"; } }}>
        <span className="flex-shrink-0">{item.icon}</span>
        <span className="flex-1">{item.label}</span>
        {item.badge !== undefined && (
          <span className="text-[10px] font-semibold px-[7px] py-[2px] rounded-full" style={{ background: "#D9896A", color: "white" }}>{item.badge}</span>
        )}
      </Link>
    );
  }

  function RepLink({ rep }: { rep: SalesRep }) {
    const href = `/saljare/${rep.id}`;
    const isActive = pathname === href || pathname.startsWith(href + "/");
    const initials = rep.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
    return (
      <Link href={href} className="flex items-center gap-2.5 px-3 py-[8px] rounded-lg text-[13px] font-medium transition-all"
        style={{ background: isActive ? "#1A1614" : "transparent", color: isActive ? "#FAF5EB" : "#5A4232" }}
        onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "#F2E8D0"; (e.currentTarget as HTMLElement).style.color = "#1A1614"; } }}
        onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#5A4232"; } }}>
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: rep.color, fontSize: 9, fontWeight: 700 }}>{initials}</div>
        <span className="flex-1 truncate">{rep.name}</span>
      </Link>
    );
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center justify-between px-2 mb-2">
        <Logo size="desktop" />
        {/* Close button — mobile only */}
        <button
          className="md:hidden flex items-center justify-center w-8 h-8 rounded-full"
          style={{ background: "#F2E8D0", border: "none", cursor: "pointer", color: "#1A1614" }}
          onClick={() => setMobileOpen(false)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {mainNav.map((item) => <NavLink key={item.href} item={item} />)}

        <div className="flex items-center justify-between px-3 mt-4 mb-1">
          <span className="text-[11px] uppercase tracking-[0.12em] font-medium" style={{ color: "#8A6E55" }}>Säljare</span>
          <Link href="/saljare/ny" className="text-[11px] font-semibold transition-colors" style={{ color: "#8A6E55" }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1A1614")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#8A6E55")}>
            + Lägg till
          </Link>
        </div>

        {salesReps.length === 0 ? (
          <Link href="/saljare/ny" className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12.5px] transition-all" style={{ color: "#8A6E55", border: "1px dashed #DDD0B5" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
            Lägg till första säljaren
          </Link>
        ) : (
          salesReps.map((rep) => <RepLink key={rep.id} rep={rep} />)
        )}

        <div className="text-[11px] uppercase tracking-[0.12em] font-medium px-3 mt-4 mb-1" style={{ color: "#8A6E55" }}>Insikter</div>
        {insightsNav.map((item) => <NavLink key={item.href} item={item} />)}

        <div className="text-[11px] uppercase tracking-[0.12em] font-medium px-3 mt-4 mb-1" style={{ color: "#8A6E55" }}>Konfiguration</div>
        {configNav.map((item) => <NavLink key={item.href} item={item} />)}
      </nav>

      {/* User footer */}
      <div className="flex items-center gap-2.5 px-3 py-4" style={{ borderTop: "1px solid #DDD0B5" }}>
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0" style={{ background: "linear-gradient(135deg, #D9896A, #6B4F5B)" }}>{userInitials}</div>
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate" style={{ color: "#1A1614" }}>{userEmail.split("@")[0] || "Användare"}</div>
          <div className="text-[11px] truncate" style={{ color: "#8A6E55" }}>{brandName}</div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4"
        style={{ height: 52, background: "#FAF5EB", borderBottom: "1px solid #DDD0B5" }}>
        <Logo size="mobile" />
        <button onClick={() => setMobileOpen(true)} className="flex flex-col justify-center gap-[5px] w-9 h-9 rounded-lg"
          style={{ background: "transparent", border: "none", cursor: "pointer", padding: "8px 6px" }}>
          <span className="block h-[1.5px] w-full rounded" style={{ background: "#1A1614" }} />
          <span className="block h-[1.5px] w-full rounded" style={{ background: "#1A1614" }} />
          <span className="block h-[1.5px] w-3/4 rounded" style={{ background: "#1A1614" }} />
        </button>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40" style={{ background: "rgba(26,22,20,0.4)" }} onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — mobile: fixed overlay, desktop: sticky */}
      <aside
        className={`
          flex flex-col gap-6
          fixed md:sticky
          top-0 left-0 bottom-0 md:top-0
          h-screen
          z-50 md:z-auto
          overflow-y-auto
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{ width: 240, padding: "28px 20px", background: "#FAF5EB", borderRight: "1px solid #DDD0B5", flexShrink: 0 }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
