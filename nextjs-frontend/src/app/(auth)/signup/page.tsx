"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiLogin } from "@/lib/api";
import SmoothInput from "@/components/SmoothInput";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ── Types ──────────────────────────────────────────────────────────────────

interface OrbitDef {
  r: number;
  dots: number;
  speed: number;
  color: string;
  dotR: number;
  ccw: boolean;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // 1. Create account
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Signup failed");

      // 2. Auto-login (sets localStorage + auth_check cookie)
      await apiLogin(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      {/* ── Left: orbital art panel ───────────────────────────────────────── */}
      <div className="relative hidden lg:block w-1/2 overflow-hidden bg-[var(--bg-elevated)]">
        <OrbitalArt />

        {/* Right-edge fade */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background:
              "linear-gradient(to right, transparent 58%, var(--bg) 100%)",
          }}
        />
        {/* Top / bottom vignette */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background:
              "linear-gradient(to bottom, var(--bg-elevated) 0%, transparent 13%, transparent 87%, var(--bg-elevated) 100%)",
          }}
        />

        {/* Quote */}
        <div className="absolute bottom-12 left-0 right-20 px-14 z-20">
          <blockquote className="text-[var(--text-secondary)] text-[14px] leading-relaxed italic">
            "Build smarter. Engage faster."
          </blockquote>
          <p className="mt-2 text-[var(--text-muted)] text-[11px] tracking-widest uppercase font-medium">
            Averto
          </p>
        </div>
      </div>

      {/* ── Right: form panel ─────────────────────────────────────────────── */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-8 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          {/* Logo */}
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 mb-10 text-[var(--text)]"
          >
            <svg
              width="28"
              height="28"
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
            <span className="font-semibold text-[15px] tracking-tight">
              Averto
            </span>
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight">
              Create account
            </h1>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">
              Start building chatbots for free
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[13px] animate-fade-in">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                Name
              </label>
              <SmoothInput
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                Email
              </label>
              <SmoothInput
                type="text"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-2">
                Password
              </label>
              <SmoothInput
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 mt-1 text-[14px] font-semibold rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {loading ? (
                <>
                  <Spinner />
                  Creating account…
                </>
              ) : (
                "Create account"
              )}
            </button>
          </form>

          <p className="mt-7 text-center text-[13px] text-[var(--text-muted)]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-[var(--text)] font-medium hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="7.5"
        cy="7.5"
        r="5.5"
        stroke="currentColor"
        strokeOpacity="0.3"
        strokeWidth="2"
      />
      <path
        d="M7.5 2a5.5 5.5 0 0 1 5.5 5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Orbital System SVG Art ─────────────────────────────────────────────────

function OrbitalArt() {
  const orbits: OrbitDef[] = [
    {
      r: 48,
      dots: 2,
      speed: 22,
      color: "rgba(99,102,241,0.88)",
      dotR: 4,
      ccw: false,
    },
    {
      r: 88,
      dots: 3,
      speed: 16,
      color: "rgba(139,92,246,0.75)",
      dotR: 3,
      ccw: true,
    },
    {
      r: 130,
      dots: 4,
      speed: 28,
      color: "rgba(99,102,241,0.65)",
      dotR: 3,
      ccw: false,
    },
    {
      r: 175,
      dots: 2,
      speed: 14,
      color: "rgba(167,139,250,0.58)",
      dotR: 4.5,
      ccw: true,
    },
    {
      r: 220,
      dots: 3,
      speed: 36,
      color: "rgba(99,102,241,0.45)",
      dotR: 2.5,
      ccw: false,
    },
  ];

  // Pre-flatten dot grid
  const gridDots = Array.from({ length: 300 }, (_, i) => ({
    row: Math.floor(i / 15),
    col: i % 15,
  }));

  // Pre-flatten orbiting dots
  const orbitingDots = orbits.flatMap((o, oi) =>
    Array.from({ length: o.dots }, (_, di) => ({
      key: `od${oi}-${di}`,
      r: o.r,
      dotR: o.dotR,
      color: o.color,
      animName: o.ccw ? "orb-ccw" : "orb-cw",
      speed: o.speed,
      delay: -(o.speed / o.dots) * di,
    })),
  );

  return (
    <div className="absolute inset-0">
      <svg
        viewBox="0 0 500 700"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="orb-bg-grad" cx="50%" cy="50%" r="58%">
            <stop offset="0%" stopColor="rgba(99,102,241,0.22)" />
            <stop offset="100%" stopColor="rgba(99,102,241,0)" />
          </radialGradient>

          <radialGradient id="orb-core-grad" cx="38%" cy="35%" r="62%">
            <stop offset="0%" stopColor="rgba(225,225,255,1)" />
            <stop offset="55%" stopColor="rgba(99,102,241,0.92)" />
            <stop offset="100%" stopColor="rgba(55,50,185,0.85)" />
          </radialGradient>

          <filter
            id="orb-f-core"
            x="-120%"
            y="-120%"
            width="340%"
            height="340%"
          >
            <feGaussianBlur stdDeviation="7" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="orb-f-dot" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <style>{`
            @keyframes orb-cw  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); }  }
            @keyframes orb-ccw { from { transform: rotate(0deg); }   to { transform: rotate(-360deg); } }
            @keyframes orb-core-pulse {
              0%, 100% { opacity: 0.78; transform: scale(1); }
              50%      { opacity: 1;    transform: scale(1.1); }
            }
            @keyframes orb-ring-breathe {
              0%, 100% { opacity: 0.18; }
              50%      { opacity: 0.35; }
            }
          `}</style>
        </defs>

        {/* Ambient glow */}
        <rect width="500" height="700" fill="url(#orb-bg-grad)" />

        {/* Background dot grid */}
        {gridDots.map(({ row, col }) => (
          <circle
            key={`g${row}-${col}`}
            cx={col * 35 + 10}
            cy={row * 36 + 10}
            r={0.8}
            fill="rgba(150,150,195,0.1)"
          />
        ))}

        {/* All orbital elements centered at (250, 350) */}
        <g transform="translate(250,350)">
          {/* Orbit rings */}
          {orbits.map((o, i) => (
            <circle
              key={`or${i}`}
              cx={0}
              cy={0}
              r={o.r}
              fill="none"
              stroke="rgba(99,102,241,0.18)"
              strokeWidth={i % 2 === 0 ? 1 : 0.5}
              style={{
                animation: `orb-ring-breathe ${3 + i * 0.4}s ease-in-out infinite`,
                animationDelay: `${i * 0.35}s`,
              }}
            />
          ))}

          {/* Orbiting dots */}
          {orbitingDots.map((dot) => (
            <g
              key={dot.key}
              style={{
                animation: `${dot.animName} ${dot.speed}s linear infinite`,
                animationDelay: `${dot.delay}s`,
                transformOrigin: "0px 0px",
              }}
            >
              <circle
                cx={dot.r}
                cy={0}
                r={dot.dotR}
                fill={dot.color}
                filter="url(#orb-f-dot)"
              />
            </g>
          ))}

          {/* Core glow layers */}
          <circle cx={0} cy={0} r={34} fill="rgba(99,102,241,0.08)" />
          <circle cx={0} cy={0} r={24} fill="rgba(99,102,241,0.15)" />

          {/* Core sphere */}
          <g filter="url(#orb-f-core)">
            <circle
              cx={0}
              cy={0}
              r={17}
              fill="url(#orb-core-grad)"
              style={{
                animation: "orb-core-pulse 3s ease-in-out infinite",
                transformOrigin: "0px 0px",
              }}
            />
          </g>

          {/* Specular highlight */}
          <circle cx={-4} cy={-5} r={5.5} fill="rgba(255,255,255,0.88)" />
        </g>
      </svg>
    </div>
  );
}
