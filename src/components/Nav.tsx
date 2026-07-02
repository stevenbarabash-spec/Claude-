"use client";

import Link from "next/link";
import { useState } from "react";
import { navItems } from "@/lib/data";

export default function Nav() {
  const [openDesktop, setOpenDesktop] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur border-b border-hairline">
      {/* Logo row */}
      <div className="flex items-center justify-center py-5">
        <Link
          href="/"
          onClick={() => {
            setMobileOpen(false);
          }}
          className="font-display text-2xl md:text-3xl tracking-wide-nav text-brand"
        >
          GREENWICH&nbsp;DENTAL&nbsp;GROUP
        </Link>
      </div>

      {/* Desktop nav row */}
      <nav className="hidden md:flex items-center justify-center gap-8 border-t border-hairline py-3 text-xs tracking-wide-nav uppercase text-brand">
        {navItems.map((item) => (
          <div
            key={item.label}
            className="relative"
            onMouseEnter={() => setOpenDesktop(item.label)}
            onMouseLeave={() => setOpenDesktop(null)}
          >
            <Link
              href={item.href}
              className="py-2 inline-block hover:text-brand-light transition-colors"
            >
              {item.label}
            </Link>
            {item.children && openDesktop === item.label && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full min-w-[220px] bg-white shadow-lg border border-hairline py-2">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className="block px-5 py-2.5 normal-case tracking-normal text-sm text-foreground hover:bg-brand-pale hover:text-brand transition-colors"
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Mobile toggle */}
      <div className="md:hidden absolute right-4 top-5">
        <button
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex flex-col gap-1.5 p-2"
        >
          <span className="block h-0.5 w-6 bg-brand" />
          <span className="block h-0.5 w-6 bg-brand" />
          <span className="block h-0.5 w-6 bg-brand" />
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-hairline bg-white">
          {navItems.map((item) => (
            <div key={item.label} className="border-b border-hairline">
              <div className="flex items-center justify-between">
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 px-5 py-3 text-sm tracking-wide-nav uppercase text-brand"
                >
                  {item.label}
                </Link>
                {item.children && (
                  <button
                    aria-label={`Expand ${item.label}`}
                    onClick={() =>
                      setMobileExpanded((v) =>
                        v === item.label ? null : item.label
                      )
                    }
                    className="px-5 py-3 text-brand"
                  >
                    {mobileExpanded === item.label ? "−" : "+"}
                  </button>
                )}
              </div>
              {item.children && mobileExpanded === item.label && (
                <div className="bg-brand-pale">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={() => setMobileOpen(false)}
                      className="block px-8 py-2.5 text-sm text-foreground"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
