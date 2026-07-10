"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";
import { HERO_BG } from "./constants";
import { lp } from "./styles";
import { Bullet, SectionHead } from "./ui";

const CARD_STACK_TOP = 155;
const SCROLL_VH_PER_CARD = 100;
const SETTLE_VH = 90; // ← extra scroll after last card lands

const CARDS = [
  {
    label: "Workflow Automation",
    h3: "Run ops on autopilot.",
    desc: "Replace brittle Zaps and one-off scripts with agentic workflows that branch, reason, and recover. Build in minutes with natural-language steps.",
    bullets: [
      "Visual builder with version history",
      "Retries, fallbacks, and human approvals",
      "Run logs & spend tracking per step",
    ],
    visual: <WorkflowVisual />,
    reverse: false,
  },
  {
    label: "Customer Support",
    h3: "Resolve tickets, automatically.",
    desc: "Agents triage, draft, and close tickets the moment they land — pulling from your knowledge base, order history, and CRM to answer with full context.",
    bullets: [
      "Tier-1 deflection across email, chat, and Slack",
      "Auto-tagging, sentiment, and SLA tracking",
      "Hand-off to humans with full context",
    ],
    visual: <ChatVisual />,
    reverse: true,
  },
  {
    label: "Data & Insights",
    h3: "See what your agents do.",
    desc: "Every conversation, action, and outcome becomes structured data. Track resolution rates, time saved, and where to deploy next — in one dashboard.",
    bullets: [
      "Real-time dashboards out of the box",
      "Topic clustering and trend detection",
      "Export to Snowflake, BigQuery, S3",
    ],
    visual: <MetricVisual />,
    reverse: false,
  },
] as const;

// Derived — pass these into StackCard instead of computing inline
const CARDS_HEIGHT = CARDS.length * SCROLL_VH_PER_CARD; // 300vh
const TOTAL_HEIGHT = CARDS_HEIGHT + SETTLE_VH;           // 390vh
const ENTER_SCALE  = CARDS_HEIGHT / TOTAL_HEIGHT;        // ≈0.769
// All enter animations complete at 76.9% of scroll progress.
// The remaining 23.1% = card 3 sits settled before stack exits.

function WorkflowVisual() {
  const steps = [
    "New lead in HubSpot",
    "Enrich + score with AI",
    "Notify owner in Slack",
    "Sync to Salesforce",
  ];

  return (
    <div className="flex w-full max-w-[200px] flex-col gap-[7px]">
      {steps.map((s) => (
        <div
          key={s}
          className="flex items-center gap-2.5 rounded-lg border border-dashed border-lp-border bg-lp-bg py-[7px] pr-3.5 pl-[7px]"
        >
          <div className="flex size-[30px] shrink-0 items-center justify-center rounded-[5px] border border-dashed border-lp-border bg-black/5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#969696" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2L12 22M8.5 6L15.5 6" />
            </svg>
          </div>
          <span className="flex-1 font-display text-sm font-semibold text-lp-text">{s}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="#d6d0c8" strokeWidth="1.5" />
            <path d="M9 12l2 2 4-4" stroke="#f24100" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ))}
    </div>
  );
}

function ChatVisual() {
  const messages = [
    "Ticket #4821: refund request",
    "Customer VIP – handle with priority",
    "Draft → send reply in 30s",
  ];

  return (
    <div className="w-full max-w-[380px] rounded-[15px] border bg-[var(--lp-card-bg)] p-5" style={{ borderColor: "var(--lp-card-border)" }}>
      <div className="mb-3 flex gap-2">
        <div className="rounded-[30px] border border-dashed border-lp-border bg-black/8 px-2.5 py-1.5 font-body text-[11px] text-lp-text">
          GPT 5.5
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {messages.map((t) => (
          <div
            key={t}
            className="rounded-lg border border-dashed border-lp-border bg-lp-bg px-3.5 py-2.5 font-body text-[13px] text-lp-muted"
          >
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricVisual() {
  const pts = [20, 35, 28, 50, 45, 65, 55, 80, 72, 90];
  const W = 300;
  const H = 120;
  const maxY = 90;
  const path = pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i / (pts.length - 1)) * W} ${H - (v / maxY) * H}`)
    .join(" ");
  const fill = path + ` L${W} ${H} L0 ${H} Z`;
  const months = ["Feb", "Mar", "Apr", "May", "Jun"];

  return (
    <div className="w-full max-w-[380px] rounded-xl border bg-[var(--lp-card-bg)] p-5" style={{ borderColor: "var(--lp-card-border)" }}>
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-sm font-semibold text-lp-text">
          Monthly efficiency
        </span>
        <span className="font-body text-xs font-semibold text-lp-accent">
          ▲ 23.4%
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        <defs>
          <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f24100" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f24100" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#metricGrad)" />
        <path
          d={path}
          fill="none"
          stroke="#f24100"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-2 flex justify-between">
        {months.map((m) => (
          <span key={m} className="font-body text-[10px] text-lp-border">
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

function FeatureCardContent({
  label,
  h3,
  desc,
  bullets,
  visual,
  reverse = false,
}: {
  label: string;
  h3: string;
  desc: string;
  bullets: readonly string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 my-4 overflow-hidden rounded-[15px] border border-dashed border-lp-border bg-lp-bg shadow-[0_2px_24px_rgba(0,0,0,0.04)]">
      <div
        className={cn(
          "bg-lp-surface p-11",
          reverse ? "order-1" : "order-0",
        )}
      >
        <span className={lp.label}>{label}</span>
        <h3 className="mt-2 mb-2 font-display text-[clamp(20px,2vw,24px)] leading-[1.25] font-medium tracking-[-0.04em] text-lp-text">
          {h3}
        </h3>
        <p className="mb-0 font-body text-[15px] leading-normal text-lp-muted">
          {desc}
        </p>
        {bullets.map((b) => (
          <Bullet key={b} text={b} />
        ))}
      </div>

      <div
        className={cn(
          "relative flex min-h-[580px] items-center justify-center overflow-hidden p-7",
          reverse
            ? "order-0 border-r border-dashed border-lp-border"
            : "order-1 border-l border-dashed border-lp-border",
        )}
        style={{ minHeight: 490 }}
      >
        <img
          src={HERO_BG}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full object-cover"
        />
        <div className="relative z-[1]">{visual}</div>
      </div>
    </div>
  );
}

function StackCard({
  label, h3, desc, bullets, visual, reverse = false,
  cardIndex, totalCards, scrollYProgress, enterScale,
}: {
  label: string; h3: string; desc: string;
  bullets: readonly string[]; visual: React.ReactNode; reverse?: boolean;
  cardIndex: number; totalCards: number;
  scrollYProgress: MotionValue<number>;
  enterScale: number; // ← new prop
}) {
  const isBase = cardIndex === 0;
  const isLast = cardIndex === totalCards - 1;
  const transitions = totalCards - 1; // 2

  // Scale enter range to fit within first ENTER_SCALE portion of progress
  const enterStart = isBase ? 0 : (cardIndex - 1) / transitions * enterScale;
  const enterEnd   = isBase ? 0 :  cardIndex      / transitions * enterScale;

  const y = useTransform(
    scrollYProgress,
    isBase ? [0, 1] : [enterStart, enterEnd],
    isBase ? ["0%", "0%"] : ["100%", "0%"],
  );

  // Scale down while NEXT card enters, not while self enters
  const scaleStart = isBase ? 0          : enterEnd;
  const scaleEnd   = isBase ? enterScale / (totalCards - 1)        // card 0: 0 → 0.385
                            : Math.min(enterEnd + enterScale / (totalCards - 1), 1);

  const scale = useTransform(
    scrollYProgress,
    isLast ? [0, 1] : [scaleStart, scaleEnd],
    isLast ? [1, 1] : [1, 0.95],
  );

  return (
    <motion.div
      style={{
        position: isBase ? "relative" : "absolute",
        top: 0, left: 0, right: 0,
        y, scale,
        zIndex: cardIndex + 1,
        transformOrigin: "center top",
      }}
      className="w-full will-change-transform"
    >
      <FeatureCardContent
        label={label} h3={h3} desc={desc}
        bullets={bullets} visual={visual} reverse={reverse}
      />
    </motion.div>
  );
}


function MobileCard({
  label,
  h3,
  desc,
  bullets,
  visual,
  reverse = false,
}: {
  label: string;
  h3: string;
  desc: string;
  bullets: readonly string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="w-full">
      <FeatureCardContent
        label={label}
        h3={h3}
        desc={desc}
        bullets={bullets}
        visual={visual}
        reverse={reverse}
      />
    </div>
  );
}

export function FeatureStackSection() {
  const scrollTrackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: raw } = useScroll({
    target: scrollTrackRef,
    offset: ["start start", "end start"],
  });
  const scrollYProgress = useSpring(raw, {
    stiffness: 70,
    damping: 20,
    restDelta: 0.001,
  });

  const CARDS_HEIGHT = CARDS.length * SCROLL_VH_PER_CARD; // 300
  const TOTAL_HEIGHT = CARDS_HEIGHT + SETTLE_VH;           // 390
  const enterScale   = CARDS_HEIGHT / TOTAL_HEIGHT;        // 0.769

  // Exit starts at 0.90 — well after last card settles at 0.769
  // Drifts stack up -40px then scroll releases naturally
  const stackExit = useTransform(scrollYProgress, [0.90, 1.0], [0, -40]);

  return (
    <div className="mx-auto max-w-[1300px] border-x border-dashed border-lp-border px-10 py-[100px]">
      <SectionHead
        compact
        badge="features"
        h2="AI Agent Platform that works for you."
        sub="Purpose-built capabilities that eliminate manual work across your entire operation."
      />

      <div className="flex flex-col gap-[10px] lg:hidden">
        {CARDS.map((card) => (
          <MobileCard key={card.label} {...card} />
        ))}
      </div>

      <div
        ref={scrollTrackRef}
        className="relative hidden lg:block"
        style={{ height: `${TOTAL_HEIGHT}vh` }} // ← 390vh, not 300vh
      >
        <div
          className="sticky overflow-hidden pb-8"
          style={{ top: CARD_STACK_TOP }}
        >
          <motion.div
            style={{ y: stackExit }}
            className="relative w-full"
          >
            {CARDS.map((card, i) => (
              <StackCard
                key={card.label}
                {...card}
                cardIndex={i}
                totalCards={CARDS.length}
                scrollYProgress={scrollYProgress}
                enterScale={enterScale} // ← pass down
              />
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  );
}