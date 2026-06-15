"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiLogin } from "@/lib/api";
import SmoothInput from "@/components/SmoothInput";

// ── Page ───────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiLogin(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      {/* ── Left: video panel ─────────────────────────────────────────────── */}
      <div className="relative hidden lg:block w-1/2 overflow-hidden bg-[var(--bg-elevated)]">
        {/* Background video */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
            type="video/mp4"
          />
        </video>

        {/* Overlay: slight dark tint for legibility */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{ background: "rgba(9,9,9,0.38)" }}
        />

        {/* Right-edge fade into form side */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background:
              "linear-gradient(to right, transparent 60%, var(--bg) 100%)",
          }}
        />

        {/* Bottom vignette */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background:
              "linear-gradient(to bottom, transparent 70%, rgba(9,9,9,0.7) 100%)",
          }}
        />

        {/* Quote overlay */}
        <div className="absolute bottom-12 left-0 right-20 px-14 z-20">
          <blockquote className="text-[var(--text-secondary)] text-[14px] leading-relaxed">
            "Your knowledge base, always answering."
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
              Welcome back
            </h1>
            <p className="mt-2 text-[14px] text-[var(--text-muted)]">
              Sign in to your workspace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[13px] animate-fade-in">
                {error}
              </div>
            )}

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
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-widest">
                  Password
                </label>
                <button
                  type="button"
                  className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <SmoothInput
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-3 mt-1 text-[14px] font-semibold rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-60 active:scale-[0.97] transition-all"
            >
              {loading ? (
                <>
                  <Spinner />
                  Signing in
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-7 text-center text-[13px] text-[var(--text-muted)]">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-[var(--text)] font-medium hover:underline"
            >
              Sign up
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
