"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import {
  Brain,
  Cpu,
  PaintBrush,
  ChartBar,
  Code,
  FileText,
  ArrowRight,
  Globe,
  Stack,
  ChatCircle,
  Check,
} from "@phosphor-icons/react";

// ─────────────────────────────────────────
//  Infinite ticker / marquee
// ─────────────────────────────────────────
function Ticker() {
  const row =
    "Voyage AI · pgvector · Gemini · LangChain · PostgreSQL · BullMQ · Crawl4AI · OpenAI · Groq · Pinecone · Redis · Supabase · ";

  return (
    <div
      className="overflow-hidden border-y border-[var(--border)] py-4 select-none"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div
        className="text-[11px] font-medium tracking-[0.14em] uppercase text-[var(--text-muted)]"
        style={{
          display: "inline-block",
          whiteSpace: "nowrap",
          animation: "ticker 38s linear infinite",
        }}
      >
        <span className="pr-16">{row}</span>
        <span className="pr-16">{row}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  FAQ data
// ─────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "What websites does Averto work with?",
    a: "Any publicly accessible website, including JavaScript-rendered SPAs, blogs, documentation sites, and marketing pages. If it has a URL and is publicly reachable, Averto can crawl it. Sites protected by Cloudflare Bot Protection or CAPTCHAs cannot be crawled.",
  },
  {
    q: "How long does crawling take?",
    a: "Typically 1-3 minutes for 10 pages and up to 10 minutes for 200 pages, depending on site complexity and server response time.",
  },
  {
    q: "Can I use my own AI API keys?",
    a: "Yes. Pro users can bring their own OpenAI, Gemini, or Groq API keys. Your keys are AES-256 encrypted at rest and are never logged or shared.",
  },
  {
    q: "How do I embed the widget on my site?",
    a: "Copy the embed snippet from your dashboard and paste it before the closing body tag. Works with any HTML page, React, Vue, Webflow, Squarespace, or WordPress site.",
  },
  {
    q: "Is my data secure?",
    a: "All vector embeddings are stored in your private pgvector database. Conversations are ephemeral by default and are never shared across accounts or used to train models.",
  },
  {
    q: "What languages are supported?",
    a: "English gives the highest accuracy. The AI responds in the visitor's language when the source content supports it, adapting to whatever language the user asks in.",
  },
];

function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);
  const reduced = useReducedMotion();

  return (
    <div>
      {FAQ_ITEMS.map((item, i) => (
        <div key={i} className="border-b border-[var(--border)]">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-6 py-5 text-left cursor-pointer"
          >
            <span className="text-[15px] font-medium text-[var(--text)] leading-snug">
              {item.q}
            </span>
            <motion.span
              animate={{ rotate: open === i ? 45 : 0 }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 380, damping: 22 }
              }
              className="flex-shrink-0 w-5 h-5 rounded-full border border-[var(--border-strong)] flex items-center justify-center text-[var(--text-muted)]"
              aria-hidden="true"
            >
              <svg width="9" height="9" viewBox="0 0 10 10">
                <line
                  x1="5"
                  y1="0"
                  x2="5"
                  y2="10"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <line
                  x1="0"
                  y1="5"
                  x2="10"
                  y2="5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div
                key={`faq-body-${i}`}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={
                  reduced
                    ? { duration: 0.15 }
                    : {
                        height: {
                          type: "spring",
                          stiffness: 380,
                          damping: 38,
                          mass: 0.8,
                        },
                        opacity: { duration: 0.18 },
                      }
                }
                style={{ overflow: "hidden" }}
              >
                <motion.p
                  initial={reduced ? false : { x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          type: "spring",
                          stiffness: 600,
                          damping: 14,
                          mass: 0.5,
                          delay: 0.06,
                        }
                  }
                  className="pb-5 text-[14px] text-[var(--text-secondary)] leading-relaxed"
                >
                  {item.a}
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
//  CheckMark
// ─────────────────────────────────────────
function CheckMark({ warm }: { warm?: boolean }) {
  return (
    <span
      className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
      style={{
        background: warm ? "rgba(200,169,102,0.12)" : "rgba(34,197,94,0.10)",
      }}
    >
      <Check
        size={9}
        weight="bold"
        color={warm ? "var(--accent-warm)" : "var(--success)"}
      />
    </span>
  );
}

// ─────────────────────────────────────────
//  Scroll-reveal hook
// ─────────────────────────────────────────
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 },
    );

    const el = ref.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  return ref;
}

function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useScrollReveal();
  return (
    <div ref={ref} className={`section-reveal ${className}`}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────
//  Page
// ─────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] overflow-x-hidden">
      <SiteNav />

      <main>
        {/* ══════════════════════════════════════
            HERO
        ══════════════════════════════════════ */}
        <section className="min-h-[100dvh] flex items-center pt-[64px]">
          <div className="max-w-6xl mx-auto px-6 w-full grid md:grid-cols-2 gap-12 lg:gap-16 items-center py-20">
            {/* Left: copy */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--border)] text-[11px] font-medium tracking-[0.14em] uppercase text-[var(--text-muted)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse-ring inline-block" />
                Intelligent knowledge base
              </div>

              <h1 className="text-[38px] md:text-[48px] lg:text-[56px] font-semibold tracking-tight leading-[1.1]">
                Your content.
                <br />
                <span className="font-semibold opacity-[0.52]">
                  Your AI assistant.
                </span>
              </h1>

              <p className="text-[18px] text-[var(--text-secondary)] leading-[1.65] max-w-[420px] font-normal">
                Crawl your site, index every page, and deploy a chatbot that
                answers visitors instantly. No code required.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 active:scale-[0.97] transition-all"
                >
                  Start for free
                  <ArrowRight size={14} weight="bold" />
                </Link>
                <a
                  href="#features"
                  className="px-6 py-3 rounded-xl text-[14px] font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-all"
                >
                  How it works
                </a>
              </div>

              <p className="text-[12px] text-[var(--text-muted)]">
                No credit card required. Free tier: 1 chatbot, 10 pages.
              </p>
            </div>

            {/* Right: hero image */}
            <div className="relative hidden md:block">
              <div
                className="relative rounded-2xl overflow-hidden border border-[var(--border)]"
                style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.45)" }}
              >
                <Image
                  src="/newlandingimage.png"
                  alt="Averto AI assistant"
                  width={640}
                  height={560}
                  className="w-full h-auto object-cover"
                  priority
                />
              </div>
              {/* Subtle glow behind image */}
              <div
                className="absolute -inset-8 -z-10 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 50%, rgba(200,169,102,0.06) 0%, transparent 72%)",
                  filter: "blur(24px)",
                }}
              />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            COVER IMAGE
        ══════════════════════════════════════ */}
        <section className="pb-14 px-6">
          <Reveal className="max-w-7xl mx-auto">
            <div
              className="relative rounded-3xl overflow-hidden border border-[var(--border-strong)]"
              style={{
                height: "clamp(420px, 48vw, 620px)",
                boxShadow:
                  "0 32px 80px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.25)",
              }}
            >
              <Image
                src="/app-preview.png"
                alt="Averto"
                fill
                className="object-cover object-top"
                sizes="(max-width: 768px) 100vw, 95vw"
              />
            </div>
          </Reveal>
        </section>

        {/* ══════════════════════════════════════
            TECH TICKER
        ══════════════════════════════════════ */}
        <Ticker />

        {/* ══════════════════════════════════════
            HOW IT WORKS
        ══════════════════════════════════════ */}
        <section id="features" className="py-28 px-6">
          <div className="max-w-6xl mx-auto">
            <Reveal className="mb-16 space-y-3">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                Simple by design
              </h2>
              <p className="text-[16px] text-[var(--text-muted)] max-w-[380px] leading-relaxed">
                Three steps from URL to live chatbot.
              </p>
            </Reveal>

            {/* Steps: horizontal timeline */}
            <div className="grid md:grid-cols-3 gap-px bg-[var(--border)] rounded-2xl overflow-hidden">
              {[
                {
                  num: "01",
                  title: "Crawl",
                  desc: "Paste your URL. Our crawler visits every page and extracts clean, structured content automatically.",
                  Icon: Globe,
                },
                {
                  num: "02",
                  title: "Index",
                  desc: "Content is chunked and embedded with Voyage AI into a pgvector database for best-in-class semantic search.",
                  Icon: Stack,
                },
                {
                  num: "03",
                  title: "Chat",
                  desc: "Users ask questions. Our hybrid RAG pipeline retrieves context and generates precise, grounded answers.",
                  Icon: ChatCircle,
                },
              ].map((step, i) => (
                <Reveal key={i}>
                  <div className="group p-8 h-full bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors duration-200">
                    <div className="flex items-start justify-between mb-8">
                      <span className="text-[11px] font-mono font-semibold tracking-[0.16em] text-[var(--text-muted)]">
                        {step.num}
                      </span>
                      <div className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors">
                        <step.Icon size={17} />
                      </div>
                    </div>
                    <h3 className="text-[20px] font-semibold mb-2.5">
                      {step.title}
                    </h3>
                    <p className="text-[14px] text-[var(--text-muted)] leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            FEATURES — BENTO GRID
        ══════════════════════════════════════ */}
        <section className="py-24 px-6 bg-[var(--bg-elevated)]">
          <div className="max-w-6xl mx-auto">
            <Reveal className="mb-14 space-y-3">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                Built for serious products
              </h2>
              <p className="text-[16px] text-[var(--text-muted)] max-w-[360px] leading-relaxed">
                Every feature you need to ship a production-grade knowledge
                base.
              </p>
            </Reveal>

            {/* Bento grid: 3-col on desktop, stacked on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* F1 — Large (2 cols): Hybrid RAG */}
              <Reveal className="md:col-span-2">
                <div className="relative h-full min-h-[200px] p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden bento-dot-pattern">
                  <div className="relative z-10">
                    <div className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] mb-5">
                      <Brain size={17} />
                    </div>
                    <h3 className="text-[18px] font-semibold mb-2">
                      Hybrid RAG
                    </h3>
                    <p className="text-[14px] text-[var(--text-muted)] leading-relaxed max-w-sm">
                      Dense + sparse retrieval fused with RRF ranking for the
                      highest accuracy answers from your content.
                    </p>
                  </div>
                  {/* Abstract visual */}
                  <div
                    className="absolute bottom-0 right-0 w-48 h-48 pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(circle at 80% 80%, rgba(200,169,102,0.08) 0%, transparent 70%)",
                    }}
                  />
                </div>
              </Reveal>

              {/* F2 — Small (1 col): Multi-model AI */}
              <Reveal>
                <div className="h-full min-h-[200px] p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors duration-200">
                  <div className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] mb-5">
                    <Cpu size={17} />
                  </div>
                  <h3 className="text-[18px] font-semibold mb-2">
                    Multi-model AI
                  </h3>
                  <p className="text-[14px] text-[var(--text-muted)] leading-relaxed">
                    Use platform keys or bring your own OpenAI, Gemini, or Groq
                    API key. Zero lock-in.
                  </p>
                </div>
              </Reveal>

              {/* F3 — Small (1 col): Custom Widget */}
              <Reveal>
                <div className="h-full min-h-[200px] p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors duration-200">
                  <div className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] mb-5">
                    <PaintBrush size={17} />
                  </div>
                  <h3 className="text-[18px] font-semibold mb-2">
                    Custom Widget
                  </h3>
                  <p className="text-[14px] text-[var(--text-muted)] leading-relaxed">
                    Full style control: colors, welcome message, system prompt,
                    and avatar. Your brand, your widget.
                  </p>
                </div>
              </Reveal>

              {/* F4 — Large (2 cols): Zero Code Embed */}
              <Reveal className="md:col-span-2">
                <div className="relative h-full min-h-[200px] p-8 rounded-2xl border border-[var(--border)] overflow-hidden bento-warm-tint">
                  <div className="relative z-10">
                    <div className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] mb-5">
                      <Code size={17} />
                    </div>
                    <h3 className="text-[18px] font-semibold mb-2">
                      Zero Code Embed
                    </h3>
                    <p className="text-[14px] text-[var(--text-muted)] leading-relaxed max-w-sm">
                      One script tag. Works on any website, any framework:
                      React, Vue, Webflow, Squarespace, WordPress.
                    </p>
                  </div>
                  {/* Code snippet decoration */}
                  <div
                    className="absolute bottom-5 right-6 font-mono text-[11px] text-[var(--text-muted)] opacity-40 select-none pointer-events-none"
                    aria-hidden="true"
                  >
                    {'<script src="averto.js" />'}
                    <br />
                    {'<averto-widget id="..." />'}
                  </div>
                </div>
              </Reveal>

              {/* F5 — Small (1 col): Knowledge Gaps */}
              <Reveal>
                <div className="h-full min-h-[200px] p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] transition-colors duration-200">
                  <div className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] mb-5">
                    <ChartBar size={17} />
                  </div>
                  <h3 className="text-[18px] font-semibold mb-2">
                    Knowledge Gaps
                  </h3>
                  <p className="text-[14px] text-[var(--text-muted)] leading-relaxed">
                    Track every question your chatbot couldn't answer. Download
                    weekly reports to improve your content.
                  </p>
                </div>
              </Reveal>

              {/* F6 — Large (2 cols): File Upload */}
              <Reveal className="md:col-span-2">
                <div className="relative h-full min-h-[200px] p-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                  <div className="relative z-10">
                    <div className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] mb-5">
                      <FileText size={17} />
                    </div>
                    <h3 className="text-[18px] font-semibold mb-2">
                      File Upload
                    </h3>
                    <p className="text-[14px] text-[var(--text-muted)] leading-relaxed max-w-sm">
                      Add PDFs, markdown files, or plain text documents to
                      extend your knowledge base beyond web pages.
                    </p>
                  </div>
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1/3 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(to left, rgba(200,169,102,0.04) 0%, transparent 100%)",
                    }}
                  />
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════
            FAQ
        ══════════════════════════════════════ */}
        <section id="faq" className="py-24 px-6 bg-[var(--bg-elevated)]">
          <div className="max-w-2xl mx-auto">
            <Reveal className="mb-14 space-y-3">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                Common questions
              </h2>
            </Reveal>
            <Reveal>
              <FAQSection />
            </Reveal>
          </div>
        </section>

        {/* ══════════════════════════════════════
            BOTTOM CTA
        ══════════════════════════════════════ */}
        <section className="py-28 px-6">
          <Reveal className="max-w-xl mx-auto text-center space-y-6">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
              Ready to make your
              <br />
              <span className="text-[var(--text-secondary)]">
                site smarter?
              </span>
            </h2>
            <p className="text-[16px] text-[var(--text-muted)] leading-relaxed">
              Join teams already using Averto. Set up in under 5 minutes.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-[14px] font-semibold bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 active:scale-[0.97] transition-all"
              >
                Start for free
                <ArrowRight size={14} weight="bold" />
              </Link>
              <a
                href="mailto:hello@averto.ai"
                className="px-7 py-3.5 rounded-xl text-[14px] font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text)] transition-all"
              >
                Talk to us
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
