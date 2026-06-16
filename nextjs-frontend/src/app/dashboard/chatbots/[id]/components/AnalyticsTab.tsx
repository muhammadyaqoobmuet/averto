"use client";

import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface AnalyticsTabProps {
  chatbotId: string;
}

interface Stats {
  messages: number;
  missedQueries: number;
  pages: number;
  chunks: number;
  conversations: number;
}

interface ActivityMessage {
  id: string;
  role: string;
  content: string;
  topScore: number | null;
  createdAt: string;
  conversation: { sessionId: string };
}

interface MissedQuery {
  id: string;
  query: string;
  topScore: number;
  askedAt: string;
}

interface DateCount {
  date: string;
  count: number;
  raw: Date;
}

const CONFIDENCE_COLORS = {
  High: "#22c55e",
  Medium: "#f59e0b",
  Low: "#ef4444",
};

/* ── Custom Tooltip ──────────────────────────────────────────── */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#18181b] border border-[rgba(255,255,255,0.09)] rounded-lg px-3 py-2 text-[12px] text-[var(--text)]">
      {label && <div className="text-[var(--text-muted)] mb-0.5">{label}</div>}
      <div className="font-semibold">{payload[0].value} messages</div>
    </div>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#18181b] border border-[rgba(255,255,255,0.09)] rounded-lg px-3 py-2 text-[12px] text-[var(--text)]">
      <div className="font-semibold">
        {payload[0].name}: {payload[0].value}
      </div>
    </div>
  );
}

/* ── Skeleton ────────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="max-w-3xl space-y-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[90px] rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse"
          />
        ))}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="h-[240px] rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
        <div className="h-[240px] rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
      </div>
    </div>
  );
}

/* ── Stat card ───────────────────────────────────────────────── */
function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description?: string;
}) {
  return (
    <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide mb-1.5">
        {label}
      </div>
      <div className="text-[28px] font-bold text-[var(--text)] tabular-nums leading-none mb-1">
        {value.toLocaleString()}
      </div>
      {description && (
        <div className="text-[12px] text-[var(--text-muted)]">{description}</div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function AnalyticsTab({ chatbotId }: AnalyticsTabProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityMessage[]>([]);
  const [_missedQueries, setMissedQueries] = useState<MissedQuery[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      setLoading(false);
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch(`${API_URL}/api/chatbots/${chatbotId}/stats`, { headers }),
      fetch(`${API_URL}/api/chatbots/${chatbotId}/activity`, { headers }),
      fetch(`${API_URL}/api/chatbots/${chatbotId}/missed-queries`, { headers }),
    ])
      .then(async ([statsRes, activityRes, missedRes]) => {
        if (statsRes.ok) setStats(await statsRes.json());
        if (activityRes.ok) {
          const raw = await activityRes.json();
          setActivity(Array.isArray(raw) ? raw : (raw.data ?? []));
        }
        if (missedRes.ok) {
          const raw = await missedRes.json();
          setMissedQueries(Array.isArray(raw) ? raw : (raw.data ?? []));
        }
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => setLoading(false));
  }, [chatbotId]);

  if (loading) return <Skeleton />;

  /* ── Confidence distribution ──────────────────────────────── */
  const assistantMessages = activity.filter(
    (m) => m.role === "assistant" && m.topScore !== null,
  );
  const high = assistantMessages.filter((m) => (m.topScore ?? 0) >= 0.72).length;
  const medium = assistantMessages.filter(
    (m) => (m.topScore ?? 0) >= 0.35 && (m.topScore ?? 0) < 0.72,
  ).length;
  const low = assistantMessages.filter((m) => (m.topScore ?? 0) < 0.35).length;

  const pieData = [
    { name: "High", value: high },
    { name: "Medium", value: medium },
    { name: "Low", value: low },
  ].filter((d) => d.value > 0);

  /* ── Messages over time ───────────────────────────────────── */
  const countMap = new Map<string, { count: number; raw: Date }>();
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - 14);

  activity.forEach((m) => {
    const d = new Date(m.createdAt);
    if (d < cutoff) return;
    const key = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const entry = countMap.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      countMap.set(key, { count: 1, raw: d });
    }
  });

  const timelineData: DateCount[] = Array.from(countMap.entries())
    .map(([date, { count, raw }]) => ({ date, count, raw }))
    .sort((a, b) => a.raw.getTime() - b.raw.getTime());

  const hasStats = stats !== null;
  const hasConfidence = pieData.length > 0;
  const hasTimeline = timelineData.length > 0;
  const hasAnyData = hasStats || hasConfidence || hasTimeline;

  if (!hasAnyData) {
    return (
      <div className="max-w-3xl flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mb-4">
          <svg
            className="w-6 h-6 text-[var(--text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
            />
          </svg>
        </div>
        <p className="text-[14px] font-medium text-[var(--text)]">
          No data yet
        </p>
        <p className="text-[13px] text-[var(--text-muted)] mt-1 max-w-xs">
          Start chatting to see analytics. Metrics will appear here once your
          chatbot receives messages.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8 animate-fade-up">
      {/* ── Section 1: Stat cards ─────────────────────────────── */}
      <section>
        <h2 className="text-[13px] font-semibold text-[var(--text)] mb-3">
          Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total messages" value={stats?.messages ?? 0} />
          <StatCard label="Conversations" value={stats?.conversations ?? 0} />
          <StatCard label="Knowledge pages" value={stats?.pages ?? 0} />
          <StatCard
            label="Gap queries"
            value={stats?.missedQueries ?? 0}
            description="Queries below 35% confidence"
          />
        </div>
      </section>

      {/* ── Sections 2 + 3: side-by-side charts ──────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Confidence distribution */}
        <section className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <h2 className="text-[13px] font-semibold text-[var(--text)] mb-3">
            Confidence distribution
          </h2>

          {hasConfidence ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={
                          CONFIDENCE_COLORS[
                            entry.name as keyof typeof CONFIDENCE_COLORS
                          ]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex items-center gap-4 justify-center mt-2 flex-wrap">
                {(
                  [
                    { key: "High", count: high },
                    { key: "Medium", count: medium },
                    { key: "Low", count: low },
                  ] as { key: keyof typeof CONFIDENCE_COLORS; count: number }[]
                ).map(({ key, count }) => (
                  <span
                    key={key}
                    className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ background: CONFIDENCE_COLORS[key] }}
                    />
                    {key} {count}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[13px] text-[var(--text-muted)]">
              No scored responses yet
            </div>
          )}
        </section>

        {/* Messages over time */}
        <section className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <h2 className="text-[13px] font-semibold text-[var(--text)] mb-3">
            Messages over time
          </h2>

          {hasTimeline ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart
                data={timelineData}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c8a966" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#c8a966" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide={true} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="#c8a966"
                  strokeWidth={1.5}
                  fill="url(#areaGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#c8a966", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-[13px] text-[var(--text-muted)]">
              No messages in the last 14 days
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
