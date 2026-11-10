"use client";

import { useEffect, useState } from "react";

export type CanteenLink = { href: string; label: string; active?: boolean };

export function CanteenHeader({
  links,
  actionLabel,
  onAction,
}: {
  links: CanteenLink[];
  actionLabel?: string;
  onAction?: () => void;
}) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cx_theme");
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        document.documentElement.dataset.theme = saved;
      }
    } catch { /* Keep the default theme if browser storage is blocked. */ }
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("cx_theme", next); } catch { /* Theme remains active for this page. */ }
  }

  return (
    <header className="cx-header cx-ops-header">
      <div className="cx-header-inner">
        <a href="/" className="cx-brand" aria-label="CanteenX home">
          <span className="cx-brand-mark">C</span>
          <span>Canteen<span className="cx-brand-x">X</span><small>CUI ISLAMABAD</small></span>
        </a>
        <nav className="cx-nav cx-ops-nav" aria-label="Main navigation">
          {links.map((link) => (
            <a key={link.href} className={link.active ? "cx-nav-link active" : "cx-nav-link"} href={link.href} aria-current={link.active ? "page" : undefined}>
              {link.label}
            </a>
          ))}
          <button className="cx-icon-button" onClick={toggleTheme} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}>
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>
          {actionLabel && <button className="cx-header-action" onClick={onAction}>{actionLabel}</button>}
        </nav>
      </div>
    </header>
  );
}

function MoonIcon() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z" /></svg>;
}

function SunIcon() {
  return <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" /></svg>;
}
