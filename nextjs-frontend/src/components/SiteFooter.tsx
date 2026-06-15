"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

function AvertoMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <rect
        width="22"
        height="22"
        rx="6"
        fill="currentColor"
        fillOpacity="0.10"
      />
      <path
        d="M11 5L15.5 16H6.5L11 5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M8.2 13h5.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

const FOOTER_LINKS = {
  Product: [
    { href: "/#features", label: "Features" },
    { href: "/docs", label: "Docs" },
  ],
  Legal: [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
  ],
  Company: [
    { href: "mailto:hello@averto.ai", label: "Contact" },
    { href: "mailto:hello@averto.ai", label: "About" },
  ],
  Connect: [
    { href: "https://github.com", label: "GitHub" },
    { href: "https://twitter.com", label: "Twitter" },
  ],
};

export default function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-10">
        {/* Brand row */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 mb-3 text-[var(--text)]"
          >
            <AvertoMark />
            <span className="font-semibold text-[14px]">Averto</span>
          </Link>
          <p className="text-[13px] text-[var(--text-muted)] leading-relaxed max-w-[220px]">
            AI knowledge base for any website. No code required.
          </p>
        </div>

        {/* 4-column link grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {(
            Object.entries(FOOTER_LINKS) as [
              string,
              { href: string; label: string }[],
            ][]
          ).map(([group, links]) => (
            <div key={group}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] mb-4">
                {group}
              </p>
              <ul className="space-y-3">
                {links.map(({ href, label }) => (
                  <li key={label}>
                    {href.startsWith("http") || href.startsWith("mailto") ? (
                      <a
                        href={href}
                        target={href.startsWith("http") ? "_blank" : undefined}
                        rel={
                          href.startsWith("http")
                            ? "noopener noreferrer"
                            : undefined
                        }
                        className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
                      >
                        {label}
                      </a>
                    ) : (
                      <Link
                        href={href}
                        className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
                      >
                        {label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <p className="text-[12px] text-[var(--text-muted)]">
            2026 Averto. All rights reserved.
          </p>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
