"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ConvMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

// Shape returned by GET /api/chatbots/:id/conversations
interface Conversation {
  id: string;
  sessionId: string;
  startedAt: string;
  messageCount: number;
  lastMessage: {
    content: string;
    createdAt: string;
    role: "user" | "assistant";
  } | null;
}

interface ActivityTabProps {
  chatbotId: string;
}

export default function ActivityTab({ chatbotId }: ActivityTabProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, ConvMessage[]>>({});
  const [loadingMessages, setLoadingMessages] = useState<string | null>(null);

  const fetchConversations = useCallback(
    async (pageNum: number, append = false) => {
      const token = localStorage.getItem("accessToken");
      if (!token) return;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const res = await fetch(
          `${API_URL}/api/chatbots/${chatbotId}/conversations?page=${pageNum}&limit=20`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;

        const raw = await res.json();
        // API returns { data: [...], total, page, limit, totalPages }
        const list: Conversation[] = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.data)
            ? raw.data
            : [];

        if (append) {
          setConversations((prev) => [...prev, ...list]);
        } else {
          setConversations(list);
        }

        setTotalPages(raw.totalPages ?? 1);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [chatbotId],
  );

  useEffect(() => {
    fetchConversations(1, false);
  }, [fetchConversations]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchConversations(next, true);
  };

  const fetchMessages = async (convId: string) => {
    if (messages[convId]) return; // already loaded
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    setLoadingMessages(convId);
    try {
      const res = await fetch(
        `${API_URL}/api/chatbots/${chatbotId}/conversations/${convId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const data: ConvMessage[] = await res.json();
      setMessages((prev) => ({ ...prev, [convId]: data }));
    } catch {
      /* ignore */
    } finally {
      setLoadingMessages(null);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchMessages(id);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-5 h-5 border-2 border-[var(--border-strong)] border-t-[var(--text)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5 animate-fade-up">
      <div>
        <h2 className="text-[13px] font-semibold text-[var(--text)]">
          Conversations
        </h2>
        <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
          Full message threads from your widget
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
          <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
            <svg
              className="w-5 h-5 text-[var(--text-muted)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-[var(--text)]">
            No conversations yet
          </p>
          <p className="text-[13px] text-[var(--text-muted)] mt-1 max-w-sm mx-auto">
            Share your chatbot widget to get started. Conversations will appear
            here in real time.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const msgCount = conv.messageCount ?? 0;
            const lastMsg = conv.lastMessage;
            const isExpanded = expandedId === conv.id;
            const convMessages = messages[conv.id];
            const isLoadingMsg = loadingMessages === conv.id;

            return (
              <div
                key={conv.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--border-strong)] transition-colors"
              >
                {/* Conversation header — click to expand */}
                <button
                  onClick={() => toggleExpand(conv.id)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left"
                >
                  {/* Session indicator */}
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-[var(--text-muted)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12px] font-mono text-[var(--text-secondary)] truncate">
                        {conv.sessionId.length > 16
                          ? `${conv.sessionId.slice(0, 8)}…${conv.sessionId.slice(-6)}`
                          : conv.sessionId}
                      </span>
                      <span className="shrink-0 text-[10px] font-medium text-[var(--text-muted)] px-1.5 py-0.5 rounded-full bg-[var(--bg)] border border-[var(--border)]">
                        {msgCount} msg{msgCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                    {lastMsg && (
                      <p className="text-[12px] text-[var(--text-muted)] truncate">
                        <span
                          className={`font-medium mr-1 ${lastMsg.role === "user" ? "text-[var(--text-secondary)]" : "text-[var(--success)]"}`}
                        >
                          {lastMsg.role === "user" ? "User:" : "Bot:"}
                        </span>
                        {lastMsg.content}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {new Date(conv.startedAt).toLocaleDateString()}
                    </span>
                    <svg
                      className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {/* Expanded message thread */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] space-y-3 bg-[var(--bg)]">
                    {isLoadingMsg ? (
                      <div className="flex justify-center py-4">
                        <div className="w-4 h-4 border-2 border-[var(--border-strong)] border-t-[var(--text)] rounded-full animate-spin" />
                      </div>
                    ) : !convMessages || convMessages.length === 0 ? (
                      <p className="text-[12px] text-[var(--text-muted)] py-3 text-center">
                        No messages in this conversation
                      </p>
                    ) : (
                      convMessages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed ${
                              msg.role === "user"
                                ? "bg-[var(--text)] text-[var(--accent-fg)] rounded-tr-sm"
                                : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-tl-sm"
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))
                    )}
                    <p className="text-[10px] text-[var(--text-muted)] text-center pt-1">
                      {new Date(conv.startedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            );
          })}

          {/* Load more */}
          {page < totalPages && (
            <div className="pt-2 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-strong)] disabled:opacity-50 transition-all"
              >
                {loadingMore ? (
                  <>
                    <div className="w-3.5 h-3.5 border border-[var(--border-strong)] border-t-[var(--text-secondary)] rounded-full animate-spin" />
                    Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
