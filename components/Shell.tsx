"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { config } from "@/lib/config";
import { JarvisPanel } from "./jarvis/JarvisPanel";

const TABS = [
  { href: "/", label: "HOME" },
  { href: "/crm", label: "CRM" },
  { href: "/finance", label: "FINANCE" },
  { href: "/health", label: "HEALTH" },
  { href: "/review", label: "REVIEW" },
  { href: "/brain", label: "BRAIN" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const initials = config.owner.fullName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (pathname === "/login") return <>{children}</>;

  return (
    <>
      <nav className="rail">
        <Link href="/" className="rail-brand">
          <span className="dot" />
          {config.brand} <span className="ver">// {config.version}</span>
        </Link>
        <div className="rail-tabs">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={`rail-tab ${pathname === t.href ? "active" : ""}`}>
              {t.label}
            </Link>
          ))}
        </div>
        <div className="rail-meta">
          <span suppressHydrationWarning>
            {now
              ? now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase()
              : ""}
          </span>
          <span suppressHydrationWarning className="num">
            {now ? now.toTimeString().slice(0, 8) : "--:--:--"}
          </span>
          <span className="rail-avatar">{initials}</span>
        </div>
      </nav>
      <main className="page">{children}</main>
      <JarvisPanel />
    </>
  );
}
