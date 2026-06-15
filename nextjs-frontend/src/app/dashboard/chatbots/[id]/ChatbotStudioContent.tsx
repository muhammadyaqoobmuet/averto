"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import WidgetPreview from "@/components/WidgetPreview";
import KnowledgeUpload from "@/components/KnowledgeUpload";
import { apiFetch } from "@/lib/api";
import GapTab from "./components/GapTab";
import ActivityTab from "./components/ActivityTab";
import ModelSettings from "./components/ModelSettings";

interface Chatbot {
  id: string;
  name: string;
  websiteUrl: string;
  status: string;
  pagesCrawled: number;
  pageLimit: number;
  apiKey: string;
  welcomeMessage: string;
  themeColor: string;
  systemPrompt: string | null;
  allowedDomains: string[];
  crawlMeta?: CrawlMeta | null;
  customModel?: string;
  customApiKey?: string;
  allowedOrigins?: string[];
}

interface CrawlMeta {
  discovered?: number;
  indexed?: number;
  skipped?: string[];
  failed?: { url: string; error: string }[];
  totalChunks?: number;
  lastCrawlAt?: string;
}

interface MissedQuery {
  id: string;
  query: string;
  topScore: number;
  askedAt: string;
}

interface CrawlPage {
  id: string;
  url: string;
  title: string | null;
  crawledAt: string;
  sourceType: string;
  _count: { chunks: number };
}

interface ActivityMessage {
  id: string;
  role: string;
  content: string;
  topScore: number | null;
  createdAt: string;
  conversation: { sessionId: string };
}

type Tab =
  | "customize"
  | "embed"
  | "insights"
  | "knowledge"
  | "activity"
  | "settings";

const VALID_TABS: Tab[] = [
  "customize",
  "embed",
  "insights",
  "knowledge",
  "activity",
  "settings",
];

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-[var(--warning)]" },
  crawling: { label: "Crawling", color: "text-blue-400" },
  indexing: { label: "Indexing", color: "text-blue-400" },
  ready: { label: "Ready", color: "text-[var(--success)]" },
  failed: { label: "Failed", color: "text-[var(--danger)]" },
};

const PRESET_COLORS = [
  "#18181b",
  "#2563eb",
  "#059669",
  "#dc2626",
  "#7c3aed",
  "#d97706",
];

export default function ChatbotStudioContent() {
  const { id } = useParams();
  const chatbotId =
    typeof id === "string" ? id : Array.isArray(id) ? (id[0] ?? "") : "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [pages, setPages] = useState<CrawlPage[]>([]);
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get("tab");
    return VALID_TABS.includes(t as Tab) ? (t as Tab) : "customize";
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [origin, setOrigin] = useState("");

  const [name, setName] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [themeColor, setThemeColor] = useState("#18181b");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [pageLimit, setPageLimit] = useState(10);
  const [totalChunks, setTotalChunks] = useState(0);
  const [recrawling, setRecrawling] = useState(false);
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null);
  const [allowedOriginsText, setAllowedOriginsText] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, pagesRes, statsRes] = await Promise.all([
        apiFetch(`/api/chatbots/${id}/status`),
        apiFetch(`/api/chatbots/${id}/pages`),
        apiFetch(`/api/chatbots/${id}/stats`),
      ]);

      if (!statusRes.ok) throw new Error();
      const data: Chatbot = await statusRes.json();
      setChatbot(data);
      setName(data.name);
      setWelcomeMessage(data.welcomeMessage);
      setThemeColor(data.themeColor || "#18181b");
      setSystemPrompt(data.systemPrompt || "");
      setPageLimit(data.pageLimit ?? 10);
      setAllowedOriginsText((data.allowedOrigins || []).join("\n"));

      if (pagesRes.ok) {
        setPages(await pagesRes.json());
      }
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setTotalChunks(stats.chunks ?? 0);
      }
    } catch {
      setChatbot(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setOrigin(window.location.origin);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && VALID_TABS.includes(t as Tab)) {
      setTab(t as Tab);
    }
  }, [searchParams]);

  const switchTab = (next: Tab) => {
    setTab(next);
    router.replace(`/dashboard/chatbots/${id}?tab=${next}`, { scroll: false });
  };

  useEffect(() => {
    if (!chatbot) return;
    const needsPoll = ["pending", "crawling", "indexing"].includes(
      chatbot.status,
    );
    if (!needsPoll) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [chatbot, fetchData]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const res = await apiFetch(`/api/chatbots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          welcomeMessage,
          themeColor,
          systemPrompt: systemPrompt || undefined,
          pageLimit,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setChatbot((prev) => (prev ? { ...prev, ...updated } : prev));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm("Remove this source from the knowledge base?")) return;
    setDeletingPageId(pageId);
    try {
      const res = await apiFetch(`/api/chatbots/${id}/pages/${pageId}`, {
        method: "DELETE",
      });
      if (res.ok) fetchData();
    } finally {
      setDeletingPageId(null);
    }
  };

  const handleRecrawl = async () => {
    if (
      !confirm(
        "Re-crawl the website? Crawled pages will be replaced; uploaded files stay.",
      )
    )
      return;
    setRecrawling(true);
    try {
      const res = await apiFetch(`/api/chatbots/${id}/recrawl`, {
        method: "POST",
      });
      if (res.ok) fetchData();
    } finally {
      setRecrawling(false);
    }
  };

  const handleSaveOrigins = async () => {
    const origins = allowedOriginsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    await apiFetch(`/api/chatbots/${chatbotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowedOrigins: origins }),
    });
    fetchData();
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--text)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm">
        Chatbot not found
      </div>
    );
  }

  const status = STATUS_LABEL[chatbot.status] || STATUS_LABEL.pending;
  const scriptCode = `<script
  src="${origin}/widget.js"
  data-api-key="${chatbot.apiKey}"
  data-bot-name="${name}"
  data-welcome-message="${welcomeMessage.replace(/"/g, "&quot;")}"
  data-primary-color="${themeColor}"
  defer
></script>`;

  const tabs: { id: Tab; label: string }[] = [
    { id: "customize", label: "Customize" },
    { id: "knowledge", label: "Knowledge" },
    { id: "insights", label: "Insights" },
    { id: "activity", label: "Activity" },
    { id: "embed", label: "Embed" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="shrink-0 px-8 py-5 border-b border-[var(--border)] flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold tracking-tight text-[var(--text)]">
                {chatbot.name}
              </h1>
              <span className={`text-[11px] font-medium ${status.color}`}>
                {status.label}
              </span>
            </div>
            <p className="text-[13px] text-[var(--text-muted)]">
              {chatbot.websiteUrl}
            </p>
            {chatbot.status === "ready" && (
              <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                {chatbot.pagesCrawled} / {chatbot.pageLimit ?? pageLimit}{" "}
                sources indexed
              </p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 px-4 py-2 rounded-lg text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
          </button>
        </header>

        <div className="shrink-0 px-8 border-b border-[var(--border)]">
          <nav className="flex gap-1 -mb-px">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`px-4 py-3 text-[13px] font-medium border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-[var(--text)] text-[var(--text)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6">
          {tab === "customize" && (
            <div className="max-w-xl space-y-6">
              <section className="space-y-4">
                <h2 className="text-[13px] font-semibold text-[var(--text)]">
                  Appearance
                </h2>
                <div className="space-y-4 p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Bot name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2.5 text-[13px] rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                      Welcome message
                    </label>
                    <textarea
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2.5 text-[13px] rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)] transition-colors resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-2">
                      Brand color
                    </label>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setThemeColor(c)}
                          className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-105 ${
                            themeColor === c
                              ? "border-[var(--text)] scale-105"
                              : "border-transparent"
                          }`}
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="w-full h-9 rounded-lg cursor-pointer bg-transparent"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="text-[13px] font-semibold text-[var(--text)]">
                  Behavior
                </h2>
                <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                    System prompt
                    <span className="text-[var(--text-muted)] font-normal ml-1">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    rows={5}
                    placeholder="You are a helpful support agent for..."
                    className="w-full px-3 py-2.5 text-[13px] rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--border-strong)] transition-colors resize-none font-mono"
                  />
                </div>
              </section>
            </div>
          )}

          {tab === "embed" && (
            <div className="max-w-2xl space-y-5">
              <div>
                <h2 className="text-[13px] font-semibold text-[var(--text)] mb-1">
                  Install on your site
                </h2>
                <p className="text-[13px] text-[var(--text-muted)]">
                  Paste this snippet before the closing{" "}
                  <code className="text-[12px] font-mono text-[var(--text-secondary)]">
                    &lt;/body&gt;
                  </code>{" "}
                  tag.
                </p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
                  <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    Embed code
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(scriptCode);
                    }}
                    className="text-[12px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] px-2.5 py-1 rounded-md hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    Copy
                  </button>
                </div>
                <pre className="p-4 text-[12px] font-mono text-[var(--text-secondary)] overflow-x-auto leading-relaxed">
                  {scriptCode}
                </pre>
              </div>
              <div className="mt-6 p-4 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
                <h4 className="text-[13px] font-semibold text-[var(--text)] mb-2">
                  Embed instructions
                </h4>
                <ol className="text-[13px] text-[var(--text-muted)] space-y-2 list-decimal list-inside">
                  <li>Copy the script tag above</li>
                  <li>
                    Paste it before the closing{" "}
                    <code className="bg-[var(--surface)] px-1 rounded">
                      &lt;/body&gt;
                    </code>{" "}
                    tag on every page
                  </li>
                  <li>
                    Add your domain to Allowed Origins in the Settings tab
                  </li>
                  <li>Test the widget using the Preview panel on the right</li>
                </ol>
                <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-[12px] text-yellow-400">
                    ⚠️ Your website must not be behind Cloudflare bot protection
                    or CAPTCHA for crawling to work.
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                <p className="text-[13px] text-[var(--text-secondary)]">
                  Status:{" "}
                  <span className={`font-medium ${status.color}`}>
                    {status.label}
                  </span>
                  {chatbot.status !== "ready" && (
                    <span className="text-[var(--text-muted)]">
                      {" "}
                      — the widget activates once indexing completes.
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {tab === "insights" && <GapTab chatbotId={chatbotId} />}

          {tab === "knowledge" && (
            <div className="max-w-3xl space-y-6 animate-fade-up">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[13px] font-semibold text-[var(--text)]">
                    Knowledge base
                  </h2>
                  <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                    Crawl your site, upload documents, and build vector
                    embeddings
                  </p>
                </div>
                <button
                  onClick={handleRecrawl}
                  disabled={
                    recrawling ||
                    ["pending", "crawling", "indexing"].includes(chatbot.status)
                  }
                  className="shrink-0 px-3 py-1.5 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-strong)] disabled:opacity-40 transition-all"
                >
                  {recrawling ? "Queuing…" : "Re-crawl site"}
                </button>
              </div>

              {/* Crawl status report */}
              {(chatbot.status === "failed" || chatbot.crawlMeta) && (
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3 animate-fade-up">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                      Crawl report
                    </h3>
                    {chatbot.status === "failed" && (
                      <span className="text-[11px] font-semibold text-[var(--danger)] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
                        Crawl failed
                      </span>
                    )}
                  </div>
                  {chatbot.crawlMeta ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        {
                          label: "Discovered",
                          value: chatbot.crawlMeta.discovered ?? 0,
                          color: "text-blue-400",
                        },
                        {
                          label: "Indexed",
                          value: chatbot.crawlMeta.indexed ?? pages.length,
                          color: "text-emerald-400",
                        },
                        {
                          label: "Skipped",
                          value: chatbot.crawlMeta.skipped?.length ?? 0,
                          color: "text-amber-400",
                        },
                        {
                          label: "Failed",
                          value: chatbot.crawlMeta.failed?.length ?? 0,
                          color: "text-red-400",
                        },
                      ].map((stat) => (
                        <div
                          key={stat.label}
                          className="p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-center"
                        >
                          <p
                            className={`text-[18px] font-bold tabular-nums ${stat.color}`}
                          >
                            {stat.value}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            {stat.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : chatbot.status === "failed" ? (
                    <p className="text-[13px] text-[var(--text-muted)]">
                      Crawling failed. Check that the Python crawler is running
                      on port 8000, then click Re-crawl.
                    </p>
                  ) : null}
                  {chatbot.crawlMeta?.skipped &&
                    chatbot.crawlMeta.skipped.length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-[var(--text-muted)] mb-1.5">
                          Not crawled (over page limit)
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                          {chatbot.crawlMeta.skipped
                            .slice(0, 10)
                            .map((url, i) => (
                              <p
                                key={i}
                                className="text-[11px] text-[var(--text-secondary)] truncate px-2 py-1 rounded bg-[var(--bg)]"
                              >
                                {url}
                              </p>
                            ))}
                          {chatbot.crawlMeta.skipped.length > 10 && (
                            <p className="text-[10px] text-[var(--text-muted)] px-2">
                              +{chatbot.crawlMeta.skipped.length - 10} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  {chatbot.crawlMeta?.failed &&
                    chatbot.crawlMeta.failed.length > 0 && (
                      <div>
                        <p className="text-[11px] font-medium text-[var(--text-muted)] mb-1.5">
                          Failed to crawl
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                          {chatbot.crawlMeta.failed.map((f, i) => (
                            <p
                              key={i}
                              className="text-[11px] text-red-400/80 truncate px-2 py-1 rounded bg-red-500/5"
                            >
                              {f.url} — {f.error}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  <div className="flex items-center gap-4 text-[11px] text-[var(--text-secondary)] pt-1 border-t border-[var(--border)]">
                    <span>{totalChunks} total vectors</span>
                    {chatbot.crawlMeta?.lastCrawlAt && (
                      <span>
                        Last crawl:{" "}
                        {new Date(
                          chatbot.crawlMeta.lastCrawlAt,
                        ).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <KnowledgeUpload
                chatbotId={chatbot.id}
                pageCount={pages.length}
                pageLimit={pageLimit}
                onIndexed={fetchData}
              />

              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-3">
                <label className="block text-[12px] font-medium text-[var(--text-secondary)]">
                  Page limit
                  <span className="text-[var(--text-muted)] font-normal ml-1">
                    (max sources to index)
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={10}
                    max={200}
                    step={5}
                    value={pageLimit}
                    onChange={(e) => setPageLimit(Number(e.target.value))}
                    className="flex-1 accent-[var(--text)]"
                  />
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={pageLimit}
                    onChange={(e) =>
                      setPageLimit(
                        Math.min(
                          200,
                          Math.max(1, Number(e.target.value) || 10),
                        ),
                      )
                    }
                    className="w-20 px-2 py-1.5 text-[13px] text-center rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)]"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Default is 10 pages, max 200. Applies to crawled pages and
                  uploaded files combined.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                    Indexed sources
                  </h3>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {pages.length} total
                  </span>
                </div>

                {pages.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center animate-glow">
                    <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-[var(--text-muted)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                    </div>
                    <p className="text-[14px] font-medium text-[var(--text)]">
                      No sources indexed yet
                    </p>
                    <p className="text-[13px] text-[var(--text-muted)] mt-1">
                      Upload a PDF or wait for the site crawl to finish.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 stagger-children">
                    {pages.map((p) => (
                      <div
                        key={p.id}
                        className="group p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] transition-all duration-200 hover:shadow-md hover:shadow-black/20"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-[13px] font-medium text-[var(--text)] truncate">
                                {p.title || p.url}
                              </p>
                              <span
                                className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
                                  p.sourceType === "upload"
                                    ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                }`}
                              >
                                {p.sourceType === "upload" ? "Upload" : "Crawl"}
                              </span>
                            </div>
                            <p className="text-[12px] text-[var(--text-muted)] truncate mt-0.5">
                              {p.url}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--text-secondary)]">
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-ring" />
                                {p._count.chunks} vectors
                              </span>
                              <span>·</span>
                              <span>
                                {new Date(p.crawledAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeletePage(p.id)}
                            disabled={deletingPageId === p.id}
                            className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-red-500/10 transition-all disabled:opacity-50"
                            title="Remove source"
                          >
                            {deletingPageId === p.id ? (
                              <div className="w-4 h-4 border-2 border-[var(--border-strong)] border-t-[var(--text)] rounded-full animate-spin" />
                            ) : (
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "activity" && <ActivityTab chatbotId={chatbotId} />}

          {tab === "settings" && (
            <div className="space-y-8">
              <ModelSettings
                chatbotId={chatbotId}
                currentModel={chatbot.customModel}
                currentApiKey={chatbot.customApiKey}
                onSave={fetchData}
              />

              {/* CORS / Allowed Origins section */}
              <div>
                <h3 className="text-[14px] font-semibold text-[var(--text)] mb-1">
                  Allowed Origins
                </h3>
                <p className="text-[13px] text-[var(--text-muted)] mb-3">
                  Restrict your widget to specific domains. Add one origin per
                  line (e.g. https://yoursite.com).
                </p>
                <textarea
                  value={allowedOriginsText}
                  onChange={(e) => setAllowedOriginsText(e.target.value)}
                  placeholder={"https://example.com\nhttps://app.example.com"}
                  rows={4}
                  className="w-full px-3 py-2.5 text-[13px] rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)] transition-colors resize-none font-mono"
                />
                <button
                  onClick={handleSaveOrigins}
                  className="mt-2 px-4 py-2 text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-fg)] rounded-lg hover:opacity-90 transition-opacity"
                >
                  Save allowed origins
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="w-[400px] shrink-0 border-l border-[var(--border)] bg-[var(--bg-elevated)] flex flex-col">
        <WidgetPreview
          apiKey={chatbot.apiKey}
          botName={name}
          welcomeMessage={welcomeMessage}
          themeColor={themeColor}
          botStatus={chatbot.status}
        />
      </aside>
    </div>
  );
}
