import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2.5 text-[var(--text)]">
          <svg
            width="20"
            height="20"
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
          <span className="font-semibold text-[14px] tracking-tight">
            Averto
          </span>
        </div>

        <nav className="flex items-center gap-6 text-[13px] text-[var(--text-muted)]">
          <Link href="/privacy" className="hover:text-[var(--text-secondary)] transition-colors">
            Privacy
          </Link>
          <a
            href="mailto:support@averto.ai"
            className="hover:text-[var(--text-secondary)] transition-colors"
          >
            Contact
          </a>
        </nav>

        <p className="text-[12px] text-[var(--text-muted)]">
          &copy; {new Date().getFullYear()} Averto. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
