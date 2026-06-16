"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import CommandPalette from "./CommandPalette";

export default function DashboardHeader() {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [user, setUser] = useState<{
    name?: string;
    email?: string;
    avatarUrl?: string;
  } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Global Cmd+K / Ctrl+K shortcut
  const handleGlobalKey = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") setPaletteOpen(false);
    },
    [],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [handleGlobalKey]);

  const initial =
    user?.name?.[0] || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <>
      <header className="h-12 shrink-0 border-b border-[var(--border)] bg-[var(--bg-elevated)] flex items-center gap-3 px-5">
        {/* Search trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex items-center gap-2.5 flex-1 max-w-[280px] h-8 px-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] text-[13px] hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)] transition-all group"
        >
          <svg
            className="w-3.5 h-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span className="flex-1 text-left">Search resources...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono text-[var(--text-muted)] opacity-60 group-hover:opacity-100 transition-opacity">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right icons */}
        <div className="flex items-center gap-1">
          {/* User avatar */}
          <button
            onClick={() => router.push("/dashboard/profile")}
            className="w-8 h-8 rounded-full border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors flex items-center justify-center overflow-hidden"
            title="Profile"
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[12px] font-semibold text-[var(--text-secondary)] bg-[var(--surface)] w-full h-full flex items-center justify-center">
                {initial}
              </span>
            )}
          </button>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
