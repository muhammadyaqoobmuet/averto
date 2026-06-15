"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { apiFetch } from "@/lib/api";
import { Trash, ArrowUpRight } from "@phosphor-icons/react";

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
      className="px-10 py-10 w-full max-w-3xl mx-auto"
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.header
        variants={cardVariants}
        className="flex items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text)]">
            Your chatbots
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
            {loading
              ? "Loading..."
              : chatbots.length === 0
                ? "No chatbots yet"
                : `${chatbots.length} chatbot${chatbots.length !== 1 ? "s" : ""} · click any to open Studio`}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
          className="flex flex-col items-center justify-center py-28 gap-3"
        >
          <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--text)] rounded-full animate-spin" />
          <p className="text-[13px] text-[var(--text-muted)]">
            Loading chatbots...
          </p>
        </motion.div>
      ) : chatbots.length === 0 ? (
        <motion.div
          variants={cardVariants}
          className="flex flex-col items-center justify-center py-24 gap-4 rounded-2xl border border-dashed border-[var(--border)]"
        >
          <div className="w-12 h-12 rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="text-[var(--text-muted)]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"
              />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-[15px] font-semibold text-[var(--text)]">
              No chatbots yet
            </p>
            <p className="text-[13px] text-[var(--text-muted)] mt-1 max-w-xs">
              Add your website URL and we&apos;ll crawl it, index every page,
              and build a chatbot in minutes.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
          >
            Create your first chatbot
          </motion.button>
        </motion.div>
      ) : (
        <motion.div variants={pageVariants} className="space-y-3">
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
                  whileHover={{ y: -1 }}
                  className="group relative rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] hover:shadow-lg transition-shadow"
                  style={{ transition: "border-color 0.15s, box-shadow 0.2s" }}
                >
                  {/* Thin left accent by status */}
                  <div
                    className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${bot.status === "ready" ? "bg-[var(--success)]" : bot.status === "failed" ? "bg-[var(--danger)]" : "bg-blue-400"}`}
                  />

                  <div className="pl-6 pr-5 py-5">
                    <div className="flex items-start gap-4 justify-between">
                      {/* Left: info — clicking opens studio */}
                      <button
                        onClick={() =>
                          router.push(`/dashboard/chatbots/${bot.id}`)
                        }
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-center gap-2.5 mb-1">
                          <h3 className="text-[15px] font-semibold text-[var(--text)] truncate">
                            {bot.name}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.badge}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`}
                            />
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-[13px] text-[var(--text-muted)] truncate">
                          {bot.websiteUrl}
                        </p>
                        {bot.status === "ready" && (
                          <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                            {bot.pagesCrawled} pages indexed
                          </p>
                        )}
                        {["crawling", "indexing", "pending"].includes(
                          bot.status,
                        ) && (
                          <p className="text-[12px] text-blue-400 mt-1 flex items-center gap-1.5">
                            <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                            Processing your site...
                          </p>
                        )}
                      </button>

                      {/* Right: actions */}
                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() =>
                            router.push(`/dashboard/chatbots/${bot.id}`)
                          }
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[12px] font-semibold bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
                        >
                          Open Studio
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M2 10L10 2M10 2H5M10 2V7"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </motion.button>

                        <motion.button
                          whileHover={{
                            scale: 1.05,
                            backgroundColor: "rgba(239,68,68,0.1)",
                          }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleDelete(bot.id)}
                          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
                          title="Delete chatbot"
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={handleCloseModal}
            />

            {/* Panel */}
            <motion.div
              key="modal-panel"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 38 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none"
            >
              <div
                className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-md shadow-2xl pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-[17px] font-semibold text-[var(--text)] mb-5">
                  New chatbot
                </h2>

                <form onSubmit={handleCreate} className="space-y-4">
                  {createError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[13px]"
                    >
                      {createError}
                    </motion.div>
                  )}

                  {/* Name */}
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2.5 text-[13px] rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
                      placeholder="Support Bot"
                    />
                  </div>

                  {/* Crawl mode toggle */}
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-2">
                      Crawl mode
                    </label>
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                      {[
                        { label: "Single URL (auto-crawl)", value: false },
                        { label: "Specific URLs", value: true },
                      ].map(({ label, value }) => (
                        <button
                          key={String(value)}
                          type="button"
                          onClick={() => setMultipleUrlMode(value)}
                          className={`relative flex-1 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                            multipleUrlMode === value
                              ? "text-[var(--text)]"
                              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          }`}
                        >
                          {multipleUrlMode === value && (
                            <motion.div
                              layoutId="crawl-mode-pill"
                              className="absolute inset-0 bg-[var(--surface)] rounded-md shadow-sm"
                              transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 40,
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
                      >
                        <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                          Website URL
                        </label>
                        <input
                          type="url"
                          required
                          value={newUrl}
                          onChange={(e) => setNewUrl(e.target.value)}
                          className="w-full px-3 py-2.5 text-[13px] rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
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
                      >
                        <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                          URLs{" "}
                          <span className="text-[var(--text-muted)] font-normal">
                            (one per line)
                          </span>
                        </label>
                        <textarea
                          required
                          value={multipleUrls}
                          onChange={(e) => setMultipleUrls(e.target.value)}
                          rows={5}
                          className="w-full px-3 py-2.5 text-[13px] rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)] transition-colors resize-none font-mono"
                          placeholder={
                            "https://yoursite.com/page1\nhttps://yoursite.com/page2"
                          }
                        />
                        <p className="text-[11px] text-[var(--text-muted)] mt-1">
                          First URL is used as the primary domain.
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Cloudflare warning */}
                  <div className="flex items-start gap-2 px-3 py-2.5 bg-yellow-500/8 border border-yellow-500/20 rounded-lg">
                    <span className="text-[13px] shrink-0">⚠️</span>
                    <p className="text-[12px] text-yellow-400 leading-relaxed">
                      Sites protected by Cloudflare or CAPTCHA cannot be
                      crawled.
                    </p>
                  </div>

                  {/* Page limit */}
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Page limit{" "}
                      <span className="text-[var(--text-muted)] font-normal">
                        (default 10, max 200)
                      </span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={200}
                        step={5}
                        value={pageLimit}
                        onChange={(e) => setPageLimit(Number(e.target.value))}
                        className="flex-1 accent-[var(--text)]"
                      />
                      <span className="text-[13px] font-semibold text-[var(--text)] tabular-nums w-10 text-right">
                        {pageLimit}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                      Max pages to crawl plus room for uploaded PDFs and text
                      files.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="flex-1 py-2.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      Cancel
                    </button>
                    <motion.button
                      type="submit"
                      disabled={creating}
                      whileHover={{ scale: creating ? 1 : 1.01 }}
                      whileTap={{ scale: creating ? 1 : 0.98 }}
                      className="flex-1 py-2.5 text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-fg)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
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
