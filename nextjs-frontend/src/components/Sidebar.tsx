"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
  useParams,
  useSearchParams,
} from "next/navigation";
import { useState, useEffect, useCallback, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AudioWave from "./AudioWave";
import { apiFetch } from "@/lib/api";

interface BotStats {
  messages: number;
  missedQueries: number;
  pages: number;
  chunks: number;
  conversations: number;
  status: string;
  pagesCrawled: number;
}

interface BotStatus {
  name: string;
  status: string;
}

function SidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const chatbotId = params.id as string | undefined;
  const currentTab = searchParams.get("tab") || "customize";

  const [user, setUser] = useState<{
    name?: string;
    email?: string;
    avatarUrl?: string;
  } | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [stats, setStats] = useState<BotStats | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const fetchBotData = useCallback(async () => {
    if (!chatbotId) return;
    try {
      const [statusRes, statsRes] = await Promise.all([
        apiFetch(`/api/chatbots/${chatbotId}/status`),
        apiFetch(`/api/chatbots/${chatbotId}/stats`),
      ]);
      if (statusRes.ok) setBotStatus(await statusRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      /* ignore */
    }
  }, [chatbotId]);

  useEffect(() => {
    fetchBotData();
    if (!chatbotId) return;
    const interval = setInterval(fetchBotData, 10000);
    return () => clearInterval(interval);
  }, [chatbotId, fetchBotData]);

  const handleLogout = async () => {
    document.cookie = "auth_check=; path=/; max-age=0";
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    localStorage.clear();
    router.push("/login");
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const botNavItems = chatbotId
    ? [
      { name: "Customize", tab: "customize", icon: "palette" },
      { name: "Knowledge", tab: "knowledge", icon: "book" },
      { name: "Insights", tab: "insights", icon: "chart" },
      { name: "Activity", tab: "activity", icon: "activity" },
      { name: "Embed", tab: "embed", icon: "code" },
      { name: "Settings", tab: "settings", icon: "settings" },
    ]
    : [];

  const statusColor: Record<string, string> = {
    ready: "bg-[var(--success)]",
    failed: "bg-[var(--danger)]",
    pending: "bg-[var(--warning)]",
    crawling: "bg-blue-400",
    indexing: "bg-blue-400",
  };

  return (
    <motion.aside
      className="w-72 shrink-0 border-r border-[var(--border)] flex flex-col h-screen sticky top-0 bg-[var(--bg-elevated)]"
      initial={{ x: -12, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 40, mass: 0.8 }}
    >
      <div className="px-5 py-5 border-b border-[var(--border)]">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <svg
            width="28"
            height="28"
            viewBox="0 0 22 22"
            fill="none"
            aria-hidden="true"
            className="text-[var(--accent)] transition-transform group-hover:scale-105"
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
          <span className="font-semibold text-[15px] tracking-tight text-[var(--text)]">
            Averto
          </span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
        <nav className="space-y-0.5">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            General
          </p>

          {/* Overview */}
          <div className="relative">
            {pathname === "/dashboard" && (
              <motion.div
                layoutId="general-active"
                className="absolute inset-0 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <Link
              href="/dashboard"
              className={`relative z-10 flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${pathname === "/dashboard"
                  ? "text-[var(--text)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
            >
              <svg
                className="w-4 h-4 opacity-60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              Overview
            </Link>
          </div>

          {/* Profile */}
          <div className="relative">
            {isActive("/dashboard/profile") && (
              <motion.div
                layoutId="general-active"
                className="absolute inset-0 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            <Link
              href="/dashboard/profile"
              className={`relative z-10 flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${isActive("/dashboard/profile")
                  ? "text-[var(--text)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                }`}
            >
              <svg
                className="w-4 h-4 opacity-60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Profile
            </Link>
          </div>

          {/* Docs — external link */}
          <div className="relative">
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors text-[var(--text-secondary)] hover:text-[var(--text)]"
            >
              <svg
                className="w-4 h-4 opacity-60"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              Docs
              <svg
                className="w-3 h-3 ml-auto opacity-40"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </nav>

        <AnimatePresence>
          {chatbotId && botStatus && (
            <motion.div
              key="bot-stats"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 400, damping: 40 }}
              className="mx-1 p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)]"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-semibold text-[var(--text)] truncate max-w-[140px]">
                  {botStatus.name}
                </p>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[var(--text-secondary)] capitalize">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${statusColor[botStatus.status] || statusColor.pending}`}
                  />
                  {botStatus.status}
                </span>
              </div>
              {stats && (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Pages", value: stats.pages },
                    { label: "Chunks", value: stats.chunks },
                    { label: "Messages", value: stats.messages },
                    { label: "Gaps", value: stats.missedQueries },
                  ].map((s) => (
                    <div
                      key={s.label}
                      className="px-2.5 py-2 rounded-lg bg-[var(--bg)] border border-[var(--border)]"
                    >
                      <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">
                        {s.label}
                      </p>
                      <p className="text-[15px] font-semibold text-[var(--text)] tabular-nums">
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {chatbotId && (
          <nav className="space-y-0.5">
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Widget Studio
            </p>
            {botNavItems.map((item) => {
              const href = `/dashboard/chatbots/${chatbotId}?tab=${item.tab}`;
              const active =
                pathname.includes(chatbotId) && currentTab === item.tab;
              return (
                <div key={item.tab} className="relative">
                  {active && (
                    <motion.div
                      layoutId="bot-active"
                      className="absolute inset-0 bg-[var(--surface)] border border-[var(--border)] rounded-lg"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 40,
                      }}
                    />
                  )}
                  <Link
                    href={href}
                    className={`relative z-10 flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${active
                        ? "text-[var(--text)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                      }`}
                  >
                    <NavIcon type={item.icon} />
                    {item.name}
                  </Link>
                </div>
              );
            })}
          </nav>
        )}

        {chatbotId && (
          <div className="mx-1 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/50">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-medium text-[var(--text-muted)]">
                Live status
              </p>
              <AudioWave color="var(--text-muted)" bars={4} />
            </div>
            <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
              Test your bot in the preview panel. Changes sync when you save.
            </p>
          </div>
        )}
      </div>

      {/* Bottom utility links */}
      <div className="px-3 pt-3 pb-1 border-t border-[var(--border)]">
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors group"
        >
          <svg
            className="w-4 h-4 opacity-60 group-hover:opacity-80 transition-opacity"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.75}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          Documentation
          <svg
            className="w-3 h-3 ml-auto opacity-30 group-hover:opacity-60 transition-opacity"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      </div>

      <div className="p-3 border-t border-[var(--border)]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]"
        >
          <div className="flex items-center gap-2.5 mb-3">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="avatar"
                className="w-7 h-7 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[var(--border-strong)] flex items-center justify-center text-[11px] font-semibold text-[var(--text-secondary)] shrink-0">
                {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate text-[var(--text)]">
                {user?.name || "User"}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {user?.email}
              </p>
            </div>
          </div>

          {showLogoutConfirm ? (
            <div className="flex items-center justify-center gap-2 py-0.5">
              <span className="text-[11px] text-[var(--text-secondary)]">
                Sure?
              </span>
              <button
                onClick={handleLogout}
                className="text-[12px] font-semibold text-[var(--danger)] hover:opacity-80 transition-opacity px-2 py-1 rounded-lg"
              >
                Yes
              </button>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--surface-hover)]"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full py-1.5 text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
            >
              Sign out
            </button>
          )}
        </motion.div>
      </div>
    </motion.aside>
  );
}

function NavIcon({ type }: { type: string }) {
  const cls = "w-4 h-4 opacity-60";
  switch (type) {
    case "book":
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
      );
    case "chart":
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      );
    case "activity":
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      );
    case "code":
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
          />
        </svg>
      );
    case "settings":
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      );
    default:
      return (
        <svg
          className={cls}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
      );
  }
}

export default function Sidebar() {
  return (
    <Suspense
      fallback={
        <aside className="w-72 shrink-0 border-r border-[var(--border)] h-screen bg-[var(--bg-elevated)]" />
      }
    >
      <SidebarContent />
    </Suspense>
  );
}
