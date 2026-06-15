"use client";

import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

function AvertoMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      aria-hidden="true"
    >
      <rect
        width="22"
        height="22"
        rx="6"
        fill="currentColor"
        fillOpacity="0.12"
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

interface SiteNavProps {
  active?: "features" | "pricing" | "docs";
}

export default function SiteNav({ active }: SiteNavProps) {
  const linkClass = (id?: string) =>
    `text-[13px] font-medium transition-colors ${
      active === id
        ? "text-[var(--text)]"
        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
    }`;

  return (
    <header
      className="fixed top-0 w-full z-50 border-b border-[var(--border)]"
      style={{
        background: "var(--nav-bg)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-[64px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 text-[var(--text)]">
          <AvertoMark />
          <span className="font-semibold text-[15px] tracking-tight">
            Averto
          </span>
        </Link>

        {/* Center links */}
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/#features" className={linkClass("features")}>
            Features
          </Link>
          <Link href="/docs" className={linkClass("docs")}>
            Docs
          </Link>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden sm:block px-4 py-2 text-[13px] font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 active:scale-[0.97] transition-all"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
