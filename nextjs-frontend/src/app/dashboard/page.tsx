"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { Trash, ArrowUpRight, Globe, Robot } from "@phosphor-icons/react";

interface Chatbot {
  id: string;
  name: string;
  websiteUrl: string;
  status: string;
  pagesCrawled: number;
  apiKey: string;
  createdAt: string;
}

// ── Status styling ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { dot: string; badge: string; label: string }
> = {
  pending: {
    dot: "bg-[var(--warning)]",
    badge: "bg-yellow-500/10 text-yellow-500",
    label: "Pending",
  },
  crawling: {
    dot: "bg-blue-400 animate-pulse",
    badge: "bg-blue-500/10 text-blue-400",
    label: "Crawling",
  },
  indexing: {
    dot: "bg-blue-400 animate-pulse",
    badge: "bg-blue-500/10 text-blue-400",
    label: "Indexing",
  },
  ready: {
    dot: "bg-[var(--success)]",
    badge: "bg-green-500/10 text-green-500",
    label: "Ready",
  },
  failed: {
    dot: "bg-[var(--danger)]",
    badge: "bg-red-500/10 text-red-400",
    label: "Failed",
  },
};

function statusCfg(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
}

// ── Animations ─────────────────────────────────────────────────────────────

const pageVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 40,
      staggerChildren: 0.06,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 38 },
  },
};

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--text)] rounded-full animate-spin" />
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [multipleUrlMode, setMultipleUrlMode] = useState(false);
  const [multipleUrls, setMultipleUrls] = useState("");
  const [pageLimit, setPageLimit] = useState(10);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const getOrgId = () =>
    typeof window !== "undefined" ? localStorage.getItem("orgId") : null;

  const fetchChatbots = useCallback(async () => {
    const orgId = getOrgId();
    if (!orgId) {
      router.push("/login");
      return;
    }

    const res = await apiFetch(`/api/chatbots?orgId=${orgId}`);
    if (!res.ok) {
      if (res.status === 401) router.push("/login");
      return;
    }
    const data = await res.json();
    setChatbots(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchChatbots();
  }, [fetchChatbots]);

  useEffect(() => {
    const needsPoll = chatbots.some((b) =>
      ["pending", "crawling", "indexing"].includes(b.status),
    );
    if (!needsPoll) return;
    const interval = setInterval(fetchChatbots, 5000);
    return () => clearInterval(interval);
  }, [chatbots, fetchChatbots]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    const orgId = getOrgId();

    const parsedUrls = multipleUrlMode
      ? multipleUrls
          .split("\n")
          .map((u) => u.trim())
          .filter(Boolean)
      : [newUrl];
    const websiteUrl = parsedUrls[0] || newUrl;

    try {
      const body: {
        name: string;
        websiteUrl: string;
        orgId: string | null;
        pageLimit: number;
        urls?: string[];
      } = { name: newName, websiteUrl, orgId, pageLimit };

      if (multipleUrlMode && parsedUrls.length > 0) body.urls = parsedUrls;

      const res = await apiFetch("/api/chatbots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(
          (data as { error?: string }).error || "Failed to create",
        );
        return;
      }
      setShowModal(false);
      setNewName("");
      setNewUrl("");
      setMultipleUrls("");
      setMultipleUrlMode(false);
      setPageLimit(10);
      fetchChatbots();
      router.push(`/dashboard/chatbots/${(data as { id: string }).id}`);
    } catch {
      setCreateError("Network error");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this chatbot and all its data?")) return;
    await apiFetch(`/api/chatbots/${id}`, { method: "DELETE" });
    fetchChatbots();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setCreateError("");
    setNewName("");
    setNewUrl("");
    setMultipleUrls("");
    setMultipleUrlMode(false);
    setPageLimit(10);
  };

  return (
    <motion.div
      className="relative px-10 py-10 w-full max-w-3xl mx-auto"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Premium background ambient glow */}
      <div className="absolute inset-x-0 top-0 pointer-events-none overflow-hidden -z-10 h-[400px]">
        <div 
          className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[250px] rounded-full blur-[80px]"
          style={{
            background: "radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0) 70%)"
          }}
        />
      </div>

      {/* Header */}
      <motion.header
        variants={cardVariants}
        className="flex items-center justify-between gap-4 mb-10 border-b border-[var(--border)] pb-6"
      >
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">
            Your chatbots
          </h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1.5 flex items-center gap-2">
            {!loading && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent-warm)] shadow-[0_0_8px_var(--accent-warm)]" />}
            {loading
              ? "Loading your assistants..."
              : chatbots.length === 0
                ? "No chatbots yet"
                : `${chatbots.length} active chatbot${chatbots.length !== 1 ? "s" : ""} · Click to open studio`}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.01, y: -0.5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowModal(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0">
            <line
              x1="7"
              y1="1"
              x2="7"
              y2="13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="1"
              y1="7"
              x2="13"
              y2="7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          New chatbot
        </motion.button>
      </motion.header>

      {/* Body */}
      {loading ? (
        <motion.div
          variants={cardVariants}
          className="flex flex-col items-center justify-center py-32 gap-4"
        >
          <div className="w-6 h-6 border-2 border-[var(--border-strong)] border-t-[var(--text-secondary)] rounded-full animate-spin" />
          <p className="text-[13px] text-[var(--text-muted)] tracking-wide">
            Retrieving chatbots...
          </p>
        </motion.div>
      ) : chatbots.length === 0 ? (
        <motion.div
          variants={cardVariants}
          className="flex flex-col items-center justify-center py-24 px-6 gap-6 rounded-2xl border border-dashed border-[var(--border-strong)] bg-gradient-to-b from-[rgba(255,255,255,0.015)] to-transparent relative overflow-hidden bento-dot-pattern"
        >
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] flex items-center justify-center shadow-lg shadow-black/5 dark:shadow-black/20">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-[var(--text-secondary)]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
              />
            </svg>
          </div>
          <div className="text-center space-y-1.5 max-w-sm">
            <p className="text-[15px] font-semibold text-[var(--text)] tracking-tight">
              No chatbots yet
            </p>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              Add your website URL and we&apos;ll crawl it, index every page,
              and build a custom RAG chatbot in minutes.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowModal(true)}
            className="btn-primary px-5 py-2.5 rounded-xl text-[13px] font-semibold"
          >
            Create your first chatbot
          </motion.button>
        </motion.div>
      ) : (
        <motion.div variants={pageVariants} className="space-y-4">
          <AnimatePresence>
            {chatbots.map((bot) => {
              const cfg = statusCfg(bot.status);
              return (
                <motion.div
                  key={bot.id}
                  variants={cardVariants}
                  layout
                  exit={{
                    opacity: 0,
                    y: -6,
                    scale: 0.98,
                    transition: { duration: 0.2 },
                  }}
                  className="group relative rounded-2xl border border-[var(--border)] bg-gradient-to-b from-white/[0.015] to-transparent dark:from-white/[0.03] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.08),inset_0_1px_rgba(255,255,255,0.05)] dark:hover:shadow-[0_16px_32px_rgba(0,0,0,0.3),inset_0_1px_rgba(255,255,255,0.07)] transition-all duration-300"
                >
                  <div className="px-6 py-5">
                    <div className="flex items-center gap-4 justify-between">
                      {/* Left: Info Block & Icon Container */}
                      <button
                        onClick={() =>
                          router.push(`/dashboard/chatbots/${bot.id}`)
                        }
                        className="flex-1 text-left min-w-0 flex items-center gap-4 group/btn cursor-pointer"
                      >
                        {/* Status Graphic box */}
                        <div className="w-11 h-11 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex items-center justify-center shrink-0 shadow-[inset_0_1px_rgba(255,255,255,0.02)] group-hover/btn:scale-[1.03] transition-transform duration-300">
                          {bot.status === "ready" ? (
                            <Globe size={18} className="text-[var(--text-secondary)] group-hover/btn:text-[var(--text)] transition-colors" />
                          ) : (
                            <Robot size={18} className="text-[var(--text-secondary)] group-hover/btn:text-[var(--text)] transition-colors" />
                          )}
                        </div>

                        {/* Text fields */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-[14.5px] font-semibold text-[var(--text)] tracking-tight truncate transition-colors">
                              {bot.name}
                            </h3>
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${cfg.badge}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`}
                              />
                              {cfg.label}
                            </span>
                          </div>
                          
                          <p className="text-[12px] text-[var(--text-secondary)] truncate font-mono opacity-80">
                            {bot.websiteUrl}
                          </p>
                          
                          {bot.status === "ready" && (
                            <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 flex items-center gap-1.5 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] shadow-[0_0_8px_var(--success)] shrink-0 animate-pulse" />
                              {bot.pagesCrawled} pages indexed
                            </p>
                          )}
                          {["crawling", "indexing", "pending"].includes(
                            bot.status,
                          ) && (
                            <p className="text-[11px] text-blue-400 mt-1.5 flex items-center gap-1.5 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                              Processing your knowledge base...
                            </p>
                          )}
                        </div>
                      </button>

                      {/* Right: Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        <motion.button
                          whileHover={{ scale: 1.02, y: -0.5 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() =>
                            router.push(`/dashboard/chatbots/${bot.id}`)
                          }
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold border border-[var(--border-strong)] bg-gradient-to-b from-white/[0.02] to-transparent dark:from-white/[0.04] hover:bg-[var(--surface-hover)] hover:border-[var(--text-muted)] text-[var(--text)] transition-all shadow-sm cursor-pointer"
                        >
                          Open Studio
                          <ArrowUpRight size={11} weight="bold" className="opacity-80" />
                        </motion.button>

                        <motion.button
                          whileHover={{
                            scale: 1.05,
                            backgroundColor: "rgba(239, 68, 68, 0.08)",
                          }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDelete(bot.id)}
                          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] border border-transparent hover:border-red-500/10 transition-all cursor-pointer"
                          title="Delete chatbot"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Modal ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <motion.div
              key="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
              onClick={handleCloseModal}
            />

            {/* Panel */}
            <motion.div
              key="modal-panel"
              initial={{ opacity: 0, scale: 0.97, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 12 }}
              transition={{ type: "spring", stiffness: 400, damping: 36 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none"
            >
              <div
                className="bg-gradient-to-b from-[var(--surface)] to-[var(--bg-elevated)] border border-[var(--border-strong)] rounded-2xl p-6 w-full max-w-md shadow-2xl pointer-events-auto shadow-black/30 dark:shadow-black/60"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-[var(--border)]">
                  <h2 className="text-[16.5px] font-semibold text-[var(--text)] tracking-tight">
                    Create new chatbot
                  </h2>
                  <button 
                    onClick={handleCloseModal}
                    className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                  {createError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[13px] font-medium"
                    >
                      {createError}
                    </motion.div>
                  )}

                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-[13px] rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--text-muted)] focus:ring-[1.5px] focus:ring-[var(--border-strong)] transition-all placeholder:text-[var(--text-muted)]"
                      placeholder="Support Bot"
                    />
                  </div>

                  {/* Crawl mode toggle */}
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Crawl mode
                    </label>
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                      {[
                        { label: "Single URL (auto-crawl)", value: false },
                        { label: "Specific URLs", value: true },
                      ].map(({ label, value }) => (
                        <button
                          key={String(value)}
                          type="button"
                          onClick={() => setMultipleUrlMode(value)}
                          className={`relative flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                            multipleUrlMode === value
                              ? "text-[var(--text)]"
                              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          }`}
                        >
                          {multipleUrlMode === value && (
                            <motion.div
                              layoutId="crawl-mode-pill"
                              className="absolute inset-0 bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-sm"
                              transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 38,
                              }}
                            />
                          )}
                          <span className="relative z-10">{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* URL inputs */}
                  <AnimatePresence mode="wait">
                    {!multipleUrlMode ? (
                      <motion.div
                        key="single-url"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-1.5"
                      >
                        <label className="block text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                          Website URL
                        </label>
                        <input
                          type="url"
                          required
                          value={newUrl}
                          onChange={(e) => setNewUrl(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-[13px] rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--text-muted)] focus:ring-[1.5px] focus:ring-[var(--border-strong)] transition-all placeholder:text-[var(--text-muted)]"
                          placeholder="https://yoursite.com"
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="multi-url"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="space-y-1.5"
                      >
                        <label className="block text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                          URLs{" "}
                          <span className="text-[var(--text-muted)] font-normal lowercase">
                            (one per line)
                          </span>
                        </label>
                        <textarea
                          required
                          value={multipleUrls}
                          onChange={(e) => setMultipleUrls(e.target.value)}
                          rows={4}
                          className="w-full px-3.5 py-2.5 text-[12px] rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--text-muted)] focus:ring-[1.5px] focus:ring-[var(--border-strong)] transition-all resize-none font-mono placeholder:text-[var(--text-muted)]"
                          placeholder={
                            "https://yoursite.com/page1\nhttps://yoursite.com/page2"
                          }
                        />
                        <p className="text-[10px] text-[var(--text-muted)] italic">
                          First URL is used as the primary domain.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Cloudflare warning */}
                  <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-500/8 border border-amber-500/15 rounded-xl">
                    <span className="text-[12px] shrink-0">⚠️</span>
                    <p className="text-[11px] text-amber-500/90 leading-relaxed font-medium">
                      Pages protected by Cloudflare Bot Shield or CAPTCHAs cannot be crawled.
                    </p>
                  </div>

                  {/* Page limit */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        Page limit
                      </label>
                      <span className="text-[11px] font-semibold text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] px-2 py-0.5 rounded-md tabular-nums">
                        {pageLimit} pages
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={200}
                        step={5}
                        value={pageLimit}
                        onChange={(e) => setPageLimit(Number(e.target.value))}
                        className="flex-1 accent-[var(--accent-warm)]"
                      />
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                      Defines the maximum crawl depth limit. Includes uploaded context assets.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="flex-1 py-2.5 text-[12.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <motion.button
                      type="submit"
                      disabled={creating}
                      whileHover={{ scale: creating ? 1 : 1.01 }}
                      whileTap={{ scale: creating ? 1 : 0.98 }}
                      className="btn-primary flex-1 py-2.5 text-[12.5px] font-semibold rounded-xl"
                    >
                      {creating ? "Creating..." : "Create"}
                    </motion.button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
