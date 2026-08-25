"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import AudioWave from "@/components/AudioWave";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WidgetConfig {
  /** Launcher button color — defaults to themeColor */
  bubbleColor?: string;
  /** Background colour of the messages area */
  chatBgColor?: string;
  position?: "bottom-right" | "bottom-left";
  borderRadius?: "sharp" | "soft" | "rounded" | "pill";
  darkMode?: boolean;
  blur?: boolean;
  showBranding?: boolean;
}

interface SourceDetail {
  url: string;
  heading?: string;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  sources?: string[];
  sourceDetails?: SourceDetail[];
  confidence?: number;
  lowConfidence?: boolean;
}

interface WidgetPreviewProps {
  apiKey: string;
  botName: string;
  welcomeMessage: string;
  themeColor: string;
  widgetConfig?: WidgetConfig;
  botStatus?: string;
}

// ── Border-radius presets ─────────────────────────────────────────────────────

const RADIUS: Record<NonNullable<WidgetConfig["borderRadius"]>, number> = {
  sharp: 6,
  soft: 12,
  rounded: 16,
  pill: 24,
};

// Helper to parse markdown-like bold (**bold**) and render it using robust React components
function parseBoldText(text: string): React.ReactNode[] {
  const regex = /\*\*(.*?)\*\*/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchIndex = match.index;
    if (matchIndex > lastIndex) {
      nodes.push(text.substring(lastIndex, matchIndex));
    }
    nodes.push(
      <strong key={matchIndex} className="font-semibold">
        {match[1]}
      </strong>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

// Helper to parse lists, link markers, bold text and newlines inline, to ensure seamless streaming compatibility
function parseMarkdownInline(text: string): React.ReactNode {
  if (!text) return null;

  const lines = text.split("\n");
  const result: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    // Matches bullets starting with optional whitespace, then - or * or • followed by a space
    const bulletMatch = line.match(/^(\s*)([-*•])\s+(.*)$/);
    const content = bulletMatch ? bulletMatch[3] : line;
    const inlineNodes = parseBoldText(content);

    if (bulletMatch) {
      result.push(
        <span key={`line-${lineIdx}`} className="inline-block pl-2 my-0.5 w-full">
          <span className="inline-block mr-1.5 opacity-70">•</span>
          {inlineNodes}
        </span>
      );
    } else {
      result.push(<span key={`line-${lineIdx}`}>{inlineNodes}</span>);
    }

    if (lineIdx < lines.length - 1) {
      result.push(<br key={`br-${lineIdx}`} />);
    }
  });

  return <>{result}</>;
}

// ── StreamingText ─────────────────────────────────────────────────────────────
// Wraps only the freshest chunk in a blur-fade animation so each arriving
// piece of text materialises from blurry → sharp, exactly like Grok.

function StreamingText({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  const prev = useRef("");

  const stable = isStreaming ? prev.current : "";
  const fresh =
    isStreaming && content.startsWith(stable)
      ? content.slice(stable.length)
      : "";

  // Keep the ref in sync AFTER every render so the next render sees the
  // correct baseline.  useLayoutEffect runs synchronously before paint.
  useLayoutEffect(() => {
    prev.current = isStreaming ? content : "";
  });

  if (!isStreaming) return <>{parseMarkdownInline(content)}</>;

  return (
    <>
      {parseMarkdownInline(stable)}
      {fresh ? (
        // key changes per chunk so the span re-mounts and replays the animation
        <motion.span
          key={stable.length}
          initial={{ filter: "blur(10px)", opacity: 0 }}
          animate={{ filter: "blur(0px)", opacity: 1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: "inline" }}
        >
          {parseMarkdownInline(fresh)}
        </motion.span>
      ) : null}
    </>
  );
}

// ── Confidence helpers ────────────────────────────────────────────────────────

function confidenceColor(score: number): string {
  if (score >= 0.72) return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (score >= 0.45) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-red-600 bg-red-50 border-red-200";
}

function confidenceLabel(score: number): string {
  if (score >= 0.72) return "High confidence";
  if (score >= 0.45) return "Medium confidence";
  return "Low confidence";
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WidgetPreview({
  apiKey,
  botName,
  welcomeMessage,
  themeColor,
  widgetConfig = {},
  botStatus,
}: WidgetPreviewProps) {
  const {
    bubbleColor,
    chatBgColor,
    position = "bottom-right",
    borderRadius: radiusKey = "rounded",
    darkMode = false,
    blur = false,
    showBranding = true,
  } = widgetConfig;

  const r = RADIUS[radiusKey]; // px value for the chosen preset
  const fabColor = bubbleColor || themeColor;

  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: welcomeMessage },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const notReady = botStatus && !["ready", "indexing"].includes(botStatus);

  useEffect(() => {
    setMessages([{ role: "assistant", content: welcomeMessage }]);
  }, [welcomeMessage]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // ── SSE streaming (unchanged logic) ─────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !apiKey) return;

    const query = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    // Add an empty assistant placeholder we'll fill as chunks stream in
    const assistantIndex = messages.length + 1;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          sessionId: "preview-session",
          apiKey,
          stream: true,
        }),
      });

      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Request failed" }));
        throw new Error(data.error || "Request failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) throw new Error("No response stream");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6)) as {
              chunk?: string;
              thinking?: string;
              done?: boolean;
              sources?: string[];
              sourceDetails?: SourceDetail[];
              confidence?: number;
              lowConfidence?: boolean;
              error?: string;
            };

            if (payload.error) throw new Error(payload.error);

            if (payload.chunk) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + payload.chunk,
                  };
                }
                return updated;
              });
            }

            if (payload.thinking) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    thinking: payload.thinking,
                  };
                }
                return updated;
              });
            }

            if (payload.done) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    sources: payload.sources,
                    sourceDetails: payload.sourceDetails,
                    confidence: payload.confidence,
                    lowConfidence: payload.lowConfidence,
                  };
                }
                return updated;
              });
            }
          } catch {
            // Malformed JSON line — skip
          }
        }
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Connection error. Is the backend running?";
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && last.content === "") {
          updated[updated.length - 1] = { role: "assistant", content: message };
        } else {
          updated.push({ role: "assistant", content: message });
        }
        return updated;
      });
    } finally {
      setLoading(false);
      void assistantIndex; // silence unused-var lint
    }
  };

  // ── Derived styles ────────────────────────────────────────────────────────────

  /** Semi-transparent when blur is active, opaque otherwise */
  const windowBg = blur
    ? darkMode
      ? "rgba(15, 15, 23, 0.78)"
      : "rgba(255, 255, 255, 0.74)"
    : darkMode
      ? "#0f0f17"
      : "#ffffff";

  const windowStyle: React.CSSProperties = {
    borderRadius: r,
    background: windowBg,
    ...(blur
      ? {
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }
      : {}),
    borderColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.09)",
  };

  const msgAreaBg = chatBgColor
    ? chatBgColor
    : darkMode
      ? "#0a0a12"
      : "#f4f4f8";

  const botBubbleStyle: React.CSSProperties = {
    background: darkMode ? "#1e1e2e" : "#ffffff",
    color: darkMode ? "#e2e8f0" : "#18181b",
    border: darkMode
      ? "1px solid rgba(255,255,255,0.08)"
      : "1px solid rgba(0,0,0,0.08)",
    borderRadius: `${r}px ${r}px ${r}px 4px`,
  };

  const userBubbleStyle: React.CSSProperties = {
    background: themeColor,
    color: "#ffffff",
    borderRadius: `${r}px ${r}px 4px ${r}px`,
  };

  const inputAreaStyle: React.CSSProperties = {
    background: darkMode ? "#13131f" : "#ffffff",
    borderTop: darkMode
      ? "1px solid rgba(255,255,255,0.07)"
      : "1px solid rgba(0,0,0,0.08)",
  };

  const inputFieldStyle: React.CSSProperties = {
    borderRadius: r,
    background: darkMode ? "#1e1e2e" : "#f4f4f8",
    color: darkMode ? "#e2e8f0" : "#18181b",
    border: darkMode
      ? "1px solid rgba(255,255,255,0.1)"
      : "1px solid rgba(0,0,0,0.09)",
  };

  const sendBtnStyle: React.CSSProperties = {
    borderRadius: r,
    background: themeColor,
    color: "#ffffff",
  };

  const loadingBubbleStyle: React.CSSProperties = {
    background: darkMode ? "#1e1e2e" : "#ffffff",
    border: darkMode
      ? "1px solid rgba(255,255,255,0.08)"
      : "1px solid rgba(0,0,0,0.08)",
    borderRadius: `${r}px ${r}px ${r}px 4px`,
  };

  const sourceMutedColor = darkMode
    ? "rgba(226,232,240,0.38)"
    : "rgba(0,0,0,0.35)";

  const sourcePillStyle: React.CSSProperties = {
    background: darkMode ? "rgba(99,102,241,0.13)" : "rgba(59,130,246,0.07)",
    color: darkMode ? "#818cf8" : "#3b82f6",
    borderRadius: Math.min(r, 8),
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* ── Panel header (outside the chat window) ──────────────────────────── */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--text-muted)]">
            Live preview
          </p>
          <p className="text-sm font-semibold text-[var(--text)] mt-0.5">
            {botName}
          </p>
        </div>

        <span className="inline-flex items-center gap-2 text-[11px] font-medium text-[var(--text-secondary)]">
          {loading ? (
            <>
              <AudioWave color={themeColor} bars={4} />
              <span>Thinking</span>
            </>
          ) : notReady ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Indexing
            </>
          ) : (
            <>
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--success, #22c55e)" }}
              />
              Ready
            </>
          )}
        </span>
      </div>

      {/* ── Scrollable preview area ──────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 flex flex-col p-4 gap-3 overflow-hidden">
        {/* Decorative gradient backdrop — only visible when blur=true so the
            frosted-glass effect has a colourful surface to refract against.   */}
        {blur && (
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, #6366f130 0%, #8b5cf630 45%, #ec489930 100%)",
              zIndex: 0,
            }}
          />
        )}

        {/* ── Chat window ─────────────────────────────────────────────────────── */}
        <div
          className="relative z-10 flex flex-col flex-1 min-h-0 overflow-hidden border shadow-2xl transition-shadow hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
          style={windowStyle}
        >
          {/* Header bar */}
          <div
            className="px-4 py-3.5 flex items-center gap-3 shrink-0 transition-colors duration-300"
            style={{
              background: themeColor,
              borderRadius: `${r}px ${r}px 0 0`,
            }}
          >
            <div
              className="w-8 h-8 shrink-0 flex items-center justify-center text-sm font-semibold text-white"
              style={{
                background: "rgba(255,255,255,0.2)",
                borderRadius: "50%",
              }}
            >
              {botName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight truncate">
                {botName}
              </p>
              <p className="text-[11px] text-white/70">
                Ask anything about the site
              </p>
            </div>
          </div>

          {/* Messages area */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar min-h-0"
            style={{ background: msgAreaBg }}
          >
            {notReady && (
              <div className="text-center py-6">
                <div className="w-8 h-8 mx-auto mb-2 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
                <p className="text-[12px] text-zinc-500">
                  Crawling and indexing your site…
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[90%] space-y-1.5">
                  {/* Collapsible thinking — above the bubble */}
                  {m.role === "assistant" && m.thinking && m.thinking.trim() && (
                    <details className="group" style={{ marginBottom: 2 }}>
                      <summary
                        className="text-[10px] font-medium cursor-pointer select-none flex items-center gap-1"
                        style={{ color: darkMode ? "rgba(226,232,240,0.35)" : "rgba(24,24,27,0.3)" }}
                      >
                        <svg className="w-2.5 h-2.5 transition-transform group-open:rotate-90" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        Thinking
                      </summary>
                      <div
                        className="mt-1 px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap rounded-md"
                        style={{
                          background: darkMode ? "rgba(99,102,241,0.06)" : "rgba(99,102,241,0.03)",
                          color: darkMode ? "rgba(226,232,240,0.5)" : "rgba(24,24,27,0.4)",
                        }}
                      >
                        {m.thinking}
                      </div>
                    </details>
                  )}

                  {/* Bubble */}
                  <div
                    className="px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm"
                    style={m.role === "user" ? userBubbleStyle : botBubbleStyle}
                  >
                    <StreamingText
                      content={m.content}
                      isStreaming={
                        loading &&
                        i === messages.length - 1 &&
                        m.role === "assistant"
                      }
                    />
                  </div>

                  {/* Confidence badge */}
                  {m.role === "assistant" &&
                    m.confidence !== undefined &&
                    m.confidence > 0 && (
                      <div className="flex items-center gap-2 px-1">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${confidenceColor(m.confidence)}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                          {confidenceLabel(m.confidence)} ·{" "}
                          {(m.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}

                  {/* Source links */}
                  {m.sourceDetails && m.sourceDetails.length > 0 && (
                    <div className="space-y-1 px-1">
                      <p
                        className="text-[10px] font-medium uppercase tracking-wide"
                        style={{ color: sourceMutedColor }}
                      >
                        Sources
                      </p>
                      {m.sourceDetails.slice(0, 4).map((s, si) => (
                        <a
                          key={si}
                          href={
                            s.url.startsWith("upload://") ? undefined : s.url
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[11px] px-2 py-1 transition-colors group"
                          style={sourcePillStyle}
                        >
                          <svg
                            className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                          <span className="truncate flex-1">
                            {s.heading || s.url.replace("upload://", "")}
                          </span>
                          <span className="text-[10px] tabular-nums shrink-0 opacity-50">
                            {(s.score * 100).toFixed(0)}%
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing / streaming indicator */}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="px-4 py-3 flex items-center gap-3"
                  style={loadingBubbleStyle}
                >
                  <AudioWave color={themeColor} />
                  <span
                    className="text-[12px]"
                    style={{
                      color: darkMode
                        ? "rgba(226,232,240,0.55)"
                        : "rgba(24,24,27,0.5)",
                    }}
                  >
                    Searching knowledge base…
                  </span>
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Input area */}
          <div
            className="px-3 pt-3 flex flex-col gap-2 shrink-0"
            style={{
              ...inputAreaStyle,
              paddingBottom: "0.5rem",
            }}
          >
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  notReady ? "Waiting for indexing…" : "Ask a question…"
                }
                disabled={loading || !!notReady}
                className="flex-1 text-[13px] px-3 py-2.5 focus:outline-none transition-colors disabled:opacity-50"
                style={inputFieldStyle}
              />
              <button
                type="submit"
                disabled={loading || !!notReady}
                className="px-4 py-2.5 text-[13px] font-semibold disabled:opacity-50 transition-all hover:brightness-110 active:scale-95"
                style={sendBtnStyle}
              >
                Send
              </button>
            </form>

            {/* Branding footer (inside the window, below input) */}
            <p
              className="text-center text-[10px] pb-1"
              style={{
                color: darkMode
                  ? "rgba(226,232,240,0.28)"
                  : "rgba(24,24,27,0.32)",
              }}
            >
              Powered by <span className="font-semibold text-indigo-500 hover:text-indigo-400 transition-colors cursor-pointer">averto</span>
            </p>
          </div>
        </div>

        {/* ── Mini FAB preview ─────────────────────────────────────────────────
            Shows users how the launcher button will look.
            Position mirrors the widgetConfig.position setting.              */}
        <div
          className="relative z-10 flex items-center gap-2 shrink-0"
          style={{
            justifyContent:
              position === "bottom-left" ? "flex-start" : "flex-end",
          }}
        >
          <span
            className="text-[10px] font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Launcher
          </span>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            aria-label="Launcher button preview"
            className="w-10 h-10 flex items-center justify-center text-white shadow-lg"
            style={{
              background: fabColor,
              // Pill/rounded → circular; sharp/soft → slight squircle feel
              borderRadius: radiusKey === "sharp" ? 8 : "50%",
            }}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
