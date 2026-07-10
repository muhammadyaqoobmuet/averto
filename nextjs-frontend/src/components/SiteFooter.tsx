"use client";

import { useState } from "react";
import Link from "next/link";

const CDN = "https://framerusercontent.com/images/";
const HERO_BG = CDN + "vv6ShYQM1T5frNtHgyN67Y8mFo.png";
const GRAIN = CDN + "rR6HYXBrMmX4cRpXfXUOvpvpB0.png";

const NAV_LINKS = [
  { label: "Home",      href: "/" },
  { label: "About",     href: "/about" },
  { label: "Plans",     href: "/plans" },
  { label: "Changelog", href: "/changelog" },
  { label: "Blog",      href: "/blog" },
  { label: "Contact",   href: "/contact" },
];

const LEGAL_LINKS = [
  { label: "Privacy policy",   href: "/legals/privacy-policy" },
  { label: "Terms of service", href: "/legals/terms-of-service" },
  { label: "404 Page",         href: "/404" },
];

const SOCIAL_LINKS = [
  { label: "X (Twitter)", href: "https://x.com/DesignByMarso" },
  { label: "LinkedIn",    href: "https://www.linkedin.com/in/designedbymarso/" },
  { label: "YouTube",     href: "https://www.youtube.com/" },
];

// Animated underline link — matches Framer's sliding orange line on hover
function NavLink({ href, children, external = false }: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const inner = (
    <span className="group flex flex-col gap-[3px]">
      <span className="font-body text-sm font-semibold tracking-[-0.02em] text-lp-muted group-hover:text-lp-text transition-colors duration-150">
        {children}
      </span>
      {/* orange underline — scaleX 0→1 on hover */}
      <span className="block h-[1.5px] w-full origin-left scale-x-0 bg-lp-accent transition-transform duration-200 group-hover:scale-x-100" />
    </span>
  );

  if (external)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="no-underline">
        {inner}
      </a>
    );

  return (
    <Link href={href} className="no-underline">
      {inner}
    </Link>
  );
}

export default function SiteFooter() {
  const [email, setEmail] = useState("");

  return (
    <footer className="bg-lp-bg font-body border-t border-dashed border-lp-border ">

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden max-w-[1300px] mx-auto ">
        <img src={HERO_BG} alt="" aria-hidden className="absolute inset-0 size-full object-cover opacity-75 pointer-events-none select-none" />
        <img src={GRAIN}   alt="" aria-hidden className="absolute inset-0 size-full object-cover opacity-15 mix-blend-multiply pointer-events-none select-none" />

        <div className="relative z-[1] mx-auto max-w-[1300px] px-10 py-24 border-x border-dashed border-lp-border text-center">
          <h2 className="font-display font-medium text-[clamp(36px,4vw,56px)] tracking-[-0.04em] leading-[1.15] text-lp-text mb-4">
            Deploy AI agents that work for you, 24/7.
          </h2>
          <p className="font-body text-[18px] text-lp-muted max-w-[480px] mx-auto mb-8 leading-[1.65]">
            Averto helps teams build chatbots, voice agents, and workflow automations — all in one intelligent platform.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/signup" className="bg-lp-text text-white font-body font-semibold text-[15px] rounded-full px-7 py-3 no-underline transition-opacity hover:opacity-80">
              Get started
            </Link>
            <Link href="/contact" className="bg-transparent text-lp-text font-body font-semibold text-[15px] rounded-full px-7 py-3 border border-dashed border-lp-border no-underline transition-opacity hover:opacity-70">
              Talk to sales
            </Link>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1300px] px-10 border-x border-dashed border-lp-border">

        {/* Newsletter */}
        <div className="py-9 border-b border-dashed border-lp-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-body font-bold text-[15px] text-lp-text mb-1">Newsletter</p>
            <p className="font-body text-sm text-lp-muted">Weekly AI tips, in 5 minutes.</p>
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); setEmail(""); }}
            className="flex items-center gap-2"
          >
            <input
              type="email"
              placeholder="Your Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="font-body text-sm text-lp-text bg-lp-surface backdrop-blur-[5px] border border-dashed border-lp-border rounded-full px-5 py-2.5 outline-none w-[220px] placeholder:text-lp-muted"
            />
            <button
              type="submit"
              className="bg-lp-text text-white font-body font-semibold text-sm rounded-full px-5 py-2.5 cursor-pointer hover:opacity-80 transition-opacity"
            >
              Send
            </button>
          </form>
        </div>

        {/* Link columns */}
        <div className="py-12 border-b border-dashed border-lp-border grid grid-cols-1 sm:grid-cols-3 gap-10">
          {[
            { title: "Navigation", links: NAV_LINKS,   external: false },
            { title: "Legal",      links: LEGAL_LINKS, external: false },
            { title: "Socials",    links: SOCIAL_LINKS, external: true },
          ].map(({ title, links, external }) => (
            <div key={title}>
              <p className="font-body text-[11px] font-bold uppercase tracking-[0.12em] text-lp-muted mb-4">
                {title}
              </p>
              <div className="flex flex-col gap-3">
                {links.map((item) => (
                  <NavLink key={item.label} href={item.href} external={external}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom bar — 3 cols matching Framer layout */}
        <div className="py-5 flex items-center justify-between">
          <p className="font-body text-[13px] text-lp-muted">©2026 Averto.</p>

          
            <a href="https://www.framer.com/@designedbymarso/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-[13px] text-lp-muted hover:text-lp-text transition-colors duration-150 no-underline"
          >
            Designed By Marso
          </a>

          
            <a href="https://framer.link/marso32"
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-[13px] text-lp-muted hover:text-lp-text transition-colors duration-150 no-underline"
            >
              Built in Framer
            </a>
          </div>
        </div>
      </footer>
    );
  }