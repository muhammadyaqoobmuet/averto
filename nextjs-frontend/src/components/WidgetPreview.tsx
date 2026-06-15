"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { motion } from "framer-motion";
import AudioWave from "./AudioWave";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface SourceDetail {
  url: string;
  heading?: string;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
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
  botStatus?: string;
}

// ── Streaming blur text ──────────────────────────────────────────────────
// Wraps only the freshest chunk in the blur animation so each arriving
// piece of text materialises from blurry to sharp, exactly like Grok.
function StreamingText({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  const prev = useRef("");

  // Stable = what was rendered last frame; fresh = the new chunk.
  const stable = isStreaming ? prev.current : "";
  const fresh =
    isStreaming && content.startsWith(stable)
      ? content.slice(stable.length)
      : "";

  // Keep the ref in sync AFTER every render so the next render sees the
  // correct baseline. useLayoutEffect runs synchronously before paint.
  useLayoutEffect(() => {
    prev.current = isStreaming ? content : "";
  });

  if (!isStreaming) return <>{content}</>;

  return (
    <>
      {stable}
      {fresh ? (
        // key changes per chunk so the span re-mounts and replays the animation
        <motion.span
          key={stable.length}
          initial={{ filter: "blur(10px)", opacity: 0 }}
          animate={{ filter: "blur(0px)", opacity: 1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: "inline" }}
        >
          {fresh}
        </motion.span>
      ) : null}
    </>
  );
}

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

export default function WidgetPreview({
  apiKey,
  botName,
  welcomeMessage,
  themeColor,
  botStatus,
}: WidgetPreviewProps) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !apiKey) return;

    const query = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: query }]);
    setLoading(true);

    // Add an empty assistant message that we'll fill in as chunks stream in
    const assistantIndex = messages.length + 1; // user msg just added
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

      // Read the SSE stream incrementally
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
              done?: boolean;
              sources?: string[];
              sourceDetails?: SourceDetail[];
              confidence?: number;
              lowConfidence?: boolean;
              error?: string;
            };

            if (payload.error) throw new Error(payload.error);

            if (payload.chunk) {
              // Append streaming chunk to the last assistant message
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

            if (payload.done) {
              // Finalize with sources + confidence
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
        // Replace the empty streaming placeholder with the error
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

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
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
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse-ring" />
              Indexing
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse-ring" />
              Ready
            </>
          )}
        </span>
      </div>

      <div
        className="mx-4 mt-4 rounded-2xl border border-[var(--border)] overflow-hidden flex flex-col flex-1 min-h-0 shadow-2xl transition-shadow hover:shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
        style={{ background: "#ffffff" }}
      >
        <div
          className="px-4 py-3.5 flex items-center gap-3 transition-colors duration-300"
          style={{ background: themeColor }}
        >
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-semibold text-white">
            {botName.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">
              {botName}
            </p>
            <p className="text-[11px] text-white/70">
              Ask anything about the site
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-zinc-50 custom-scrollbar min-h-[280px]">
          {notReady && (
            <div className="text-center py-6 animate-fade-in">
              <div className="w-8 h-8 mx-auto mb-2 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
              <p className="text-[12px] text-zinc-500">
                Crawling and indexing your site…
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex animate-fade-up ${m.role === "user" ? "justify-end" : "justify-start"}`}
              style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s` }}
            >
              <div className="max-w-[90%] space-y-1.5">
                <div
                  className={`px-3.5 py-2.5 text-[13px] leading-relaxed rounded-2xl transition-all ${
                    m.role === "user"
                      ? "text-white rounded-br-md"
                      : "bg-white text-zinc-800 border border-zinc-200/80 rounded-bl-md shadow-sm"
                  }`}
                  style={
                    m.role === "user" ? { background: themeColor } : undefined
                  }
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

                {m.role === "assistant" &&
                  m.confidence !== undefined &&
                  m.confidence > 0 && (
                    <div className="flex items-center gap-2 px-1 animate-slide-in-right">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${confidenceColor(m.confidence)}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {confidenceLabel(m.confidence)} ·{" "}
                        {(m.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}

                {m.sourceDetails && m.sourceDetails.length > 0 && (
                  <div className="space-y-1 px-1 animate-fade-in">
                    <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
                      Sources
                    </p>
                    {m.sourceDetails.slice(0, 4).map((s, si) => (
                      <a
                        key={si}
                        href={s.url.startsWith("upload://") ? undefined : s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[11px] text-blue-600 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-50 px-2 py-1 rounded-md transition-colors group"
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
                        <span className="text-[10px] text-zinc-400 tabular-nums shrink-0">
                          {(s.score * 100).toFixed(0)}%
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-white border border-zinc-200/80 px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-3">
                <AudioWave color={themeColor} />
                <span className="text-[12px] text-zinc-500">
                  Searching knowledge base…
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-3 border-t border-zinc-200/80 bg-white flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={notReady ? "Waiting for indexing…" : "Ask a question…"}
            disabled={loading || !!notReady}
            className="flex-1 text-[13px] px-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-300 focus:bg-white transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !!notReady}
            className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 transition-all hover:brightness-110 active:scale-95"
            style={{ background: themeColor }}
          >
            Send
          </button>
        </form>
      </div>

      <p className="text-[10px] text-[var(--text-muted)] text-center px-4 py-3">
        Answers include source links & confidence scores
      </p>
    </div>
  );
}
