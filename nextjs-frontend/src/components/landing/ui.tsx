"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { CDN, FAQ_ITEMS, REVEAL_EASE, TW_PHRASES } from "./constants";
import { lp } from "./styles";

/* ─── Animation wrapper ──────────────────────────────── */

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.7, delay, ease: REVEAL_EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Primitives ─────────────────────────────────────── */

export function Badge({ label }: { label: string }) {
  return (
    <div className={lp.pill}>
      <div className="flex items-center gap-0.5">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-[9px] w-0.5",
              i === 0 ? "bg-lp-accent" : "bg-black/5",
            )}
          />
        ))}
      </div>
      <span className={lp.label}>{label}</span>
    </div>
  );
}

export function SectionHead({
  badge,
  h2,
  sub,
  align = "center",
  compact = false,
}: {
  badge: string;
  h2: string;
  sub?: string;
  align?: "center" | "left";
  compact?: boolean;
}) {
  return (
    <Reveal
      className={cn(
        align === "center" ? "text-center" : "text-left",
        compact ? "mb-5" : "mb-[50px]",
      )}
    >
      <Badge label={badge} />
      <h2
        className={cn(
          lp.headingDisplay,
          compact
            ? "mt-2.5 mb-2.5 text-[clamp(28px,3.2vw,44px)] tracking-[-1.6px] leading-[1.1]"
            : "mt-4 mb-4 text-[clamp(36px,4vw,56px)] tracking-[-1.6px] leading-[1.1]",
        )}
      >
        {h2}
      </h2>
      {sub && (
        <p
          className={cn(
            lp.body,
            "max-w-[600px]",
            align === "center" && "mx-auto",
          )}
        >
          {sub}
        </p>
      )}
    </Reveal>
  );
}

export function Bullet({ text, dark = false }: { text: string; dark?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 border-t border-dashed py-3.5",
        dark ? "border-white/10" : "border-lp-border",
      )}
    >
      <div
        className={cn(
          "flex size-[22px] shrink-0 items-center justify-center rounded-[5px] border border-dashed",
          dark
            ? "border-white/15 bg-white/8"
            : "border-black/10 bg-white",
        )}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M2.25 12.75L9 19.5L21.75 4.5"
            stroke="#f24100"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span
        className={cn(
          "font-body text-[15px] leading-[1.4]",
          dark ? "text-white/65" : "text-lp-muted",
        )}
      >
        {text}
      </span>
    </div>
  );
}

export function DarkBtn({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full bg-lp-dark py-3 pr-5 pl-6 font-body text-sm font-semibold text-white no-underline"
    >
      {label}
      <span className="flex size-5 items-center justify-center overflow-hidden rounded-full">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
          <path
            d="M7 17L17 7M17 7H7M17 7V17"
            stroke="white"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}

export function OutlineBtn({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-dashed border-lp-border bg-transparent py-3 pr-5 pl-6 font-body text-sm font-semibold text-lp-text no-underline"
    >
      {label}
      <span className="flex size-5 items-center justify-center overflow-hidden rounded-full">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
          <path
            d="M7 17L17 7M17 7H7M17 7V17"
            stroke="var(--lp-text)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </Link>
  );
}

export function StarRating({ rating = "5.0" }: { rating?: string }) {
  return (
    <div className="mb-5 flex items-center gap-1">
      <span className="font-body text-[11px] text-lp-muted">{rating}</span>
      <svg width="14" height="14" viewBox="0 0 14 14">
        <path
          d="M7 0.668L8.646 5.403L13.657 5.505L9.663 8.534L11.114 13.332L7 10.468L2.886 13.332L4.337 8.534L0.343 5.505L5.354 5.403Z"
          fill="#f24100"
        />
      </svg>
      <span className="font-body text-[11px] text-lp-muted">Rating</span>
    </div>
  );
}

/* ─── Typewriter ─────────────────────────────────────── */

export function TypewriterCursor() {
  const reduced = useReducedMotion();
  const [displayed, setDisplayed] = useState("");
  const s = useRef({ pi: 0, ci: 0, del: false });

  useEffect(() => {
    if (reduced) return;
    let alive = true;
    let tid: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (!alive) return;
      const { pi, ci, del } = s.current;
      const phrase = TW_PHRASES[pi];
      if (!del) {
        if (ci < phrase.length) {
          s.current.ci++;
          setDisplayed(phrase.slice(0, s.current.ci));
          tid = setTimeout(tick, 68);
        } else {
          tid = setTimeout(() => {
            s.current.del = true;
            tick();
          }, 1700);
        }
      } else {
        if (ci > 0) {
          s.current.ci--;
          setDisplayed(phrase.slice(0, s.current.ci));
          tid = setTimeout(tick, 36);
        } else {
          s.current.del = false;
          s.current.pi = (pi + 1) % TW_PHRASES.length;
          tid = setTimeout(tick, 380);
        }
      }
    };

    tid = setTimeout(tick, 900);
    return () => {
      alive = false;
      clearTimeout(tid);
    };
  }, [reduced]);

  return (
    <div className="mb-3 flex min-h-5 items-center gap-0.5">
      <span className="overflow-hidden font-body text-sm whitespace-nowrap text-lp-text">
        {displayed}
      </span>
      <span className="animate-lp-blink ml-px font-body text-sm leading-none text-lp-text">
        |
      </span>
    </div>
  );
}

/* ─── Integration cell ───────────────────────────────── */

export function IntCell({
  bg,
  curr,
  next,
}: {
  bg: string;
  curr: string;
  next: string;
}) {
  return (
    <div
      className={cn(
        "group relative flex h-[145px] items-center justify-center overflow-hidden border-r border-b border-dashed border-lp-border",
        bg === "transparent" ? "bg-lp-bg" : "bg-lp-surface",
      )}
    >
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center p-6 transition-transform duration-[400ms]",
          lp.motionEase,
          "group-hover:-translate-y-full",
        )}
      >
        <img
          src={`${CDN}${curr}`}
          alt=""
          className="max-h-[60%] max-w-[60%] object-contain"
        />
      </div>
      <div
        className={cn(
          "absolute inset-0 flex translate-y-full items-center justify-center p-6 transition-transform duration-[400ms]",
          lp.motionEase,
          "group-hover:translate-y-0",
        )}
      >
        <img
          src={`${CDN}${next}`}
          alt=""
          className="max-h-[60%] max-w-[60%] object-contain"
        />
      </div>
    </div>
  );
}

/* ─── FAQ ────────────────────────────────────────────── */

export function FAQAccordion() {
  const [open, setOpen] = useState<number | null>(0);
  const reduced = useReducedMotion();

  return (
    <div className="overflow-hidden rounded-[15px] border border-dashed border-lp-border">
      {FAQ_ITEMS.map((item, i) => (
        <div
          key={i}
          className={cn(
            "bg-lp-surface",
            i < FAQ_ITEMS.length - 1 && "border-b border-dashed border-lp-border",
            i === 0 && "rounded-t-[10px]",
            i === FAQ_ITEMS.length - 1 && "rounded-b-[10px]",
          )}
        >
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full cursor-pointer items-center justify-between gap-6 border-none bg-transparent px-6 py-5 text-left"
          >
            <span className="font-display text-[17px] leading-[1.3] font-medium tracking-[-0.02em] text-lp-text">
              {item.q}
            </span>
            <div className="flex size-[35px] shrink-0 items-center justify-center rounded-full border border-dashed border-lp-border bg-lp-bg">
              <motion.div
                animate={{ rotate: open === i ? 45 : 0 }}
                transition={
                  reduced
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 380, damping: 22 }
                }
              >
                <svg width="14" height="14" viewBox="0 0 14 14">
                  <line x1="7" y1="0" x2="7" y2="14" stroke="var(--lp-icon-stroke)" strokeWidth="1.6" strokeLinecap="round" />
                  <line x1="0" y1="7" x2="14" y2="7" stroke="var(--lp-icon-stroke)" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </motion.div>
            </div>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                key="body"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={
                  reduced
                    ? { duration: 0.15 }
                    : {
                      height: { type: "spring", stiffness: 380, damping: 38 },
                      opacity: { duration: 0.2 },
                    }
                }
                className="overflow-hidden"
              >
                <div className="border-t border-dashed border-lp-border px-6 pb-5">
                  <p className="pt-4 font-body text-base leading-[1.6] text-lp-muted">
                    {item.a}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ─── Review card ────────────────────────────────────── */

export function ReviewCard({
  quote,
  name,
  role,
  avatar,
  rating = "5.0",
}: {
  quote: string;
  name: string;
  role: string;
  avatar: string;
  rating?: string;
}) {
  return (
    <div className="flex w-[470px] shrink-0 flex-col gap-[30px] rounded-[10px] border border-dashed border-white/10 bg-lp-surface p-[30px]">
      <div>
        <StarRating rating={rating} />
        <p className="font-display text-[17px] leading-[1.3] font-medium tracking-[-0.02em] text-lp-dark">
          &ldquo;{quote}&rdquo;
        </p>
      </div>
      <div className="flex items-center gap-3 rounded-full border border-dashed border-white/10 p-2.5">
        <img
          src={avatar}
          alt={name}
          className="size-[50px] shrink-0 rounded-full object-cover"
        />
        <div className="flex-1">
          <p className="font-display text-[15px] leading-[1.1] font-medium tracking-[-0.5px] text-lp-dark">
            {name}
          </p>
          <p className="mt-0.5 font-body text-[11px] text-lp-muted">{role}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Social link button ─────────────────────────────── */

export function SocialLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-dashed border-lp-border bg-lp-bg"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M4.5 3.75L9 9.75L4.5 16.5H9L12 12.75L15 16.5H19.5L15 9.75L19.5 3.75H15L12 7.5L9 3.75Z"
          stroke="#969696"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
