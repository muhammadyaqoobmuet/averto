'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface MissedQuery {
  id: string;
  query: string;
  topScore: number;
  askedAt: string;
}

type SortField = 'query' | 'topScore' | 'askedAt';
type SortDir = 'asc' | 'desc';

// Common stop words to exclude from keyword analysis
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'it', 'in', 'of', 'to', 'and', 'or', 'for', 'on',
  'at', 'i', 'how', 'what', 'why', 'when', 'where', 'can', 'do', 'does', 'my',
  'with', 'that', 'this', 'you', 'your', 'are', 'was', 'be', 'by', 'from',
  'as', 'have', 'had', 'has', 'not', 'so', 'about', 'will', 'would', 'could',
  'should', 'there', 'their', 'they', 'we', 'me', 'him', 'her', 'its', 'our',
  'up', 'out', 'use', 'get', 'go', 'if', 'which', 'any', 'all', 'been',
]);

interface GapTabProps {
  chatbotId: string;
}

export default function GapTab({ chatbotId }: GapTabProps) {
  const [allMissed, setAllMissed] = useState<MissedQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('askedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [downloading, setDownloading] = useState(false);

  const fetchMissedQueries = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/chatbots/${chatbotId}/missed-queries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: MissedQuery[] = await res.json();
        setAllMissed(Array.isArray(data) ? data : []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [chatbotId]);

  useEffect(() => {
    fetchMissedQueries();
  }, [fetchMissedQueries]);

  // Filter to confidence < 25%
  const gaps = useMemo(
    () => allMissed.filter(q => q.topScore < 0.25),
    [allMissed],
  );

  // Stats
  const totalGaps = gaps.length;
  const avgScore = totalGaps > 0
    ? Math.round(gaps.reduce((sum, q) => sum + q.topScore * 100, 0) / totalGaps)
    : 0;

  const topKeywords = useMemo(() => {
    const counts: Record<string, number> = {};
    gaps.forEach(q => {
      q.query
        .toLowerCase()
        .split(/\W+/)
        .forEach(word => {
          if (word.length > 2 && !STOP_WORDS.has(word)) {
            counts[word] = (counts[word] || 0) + 1;
          }
        });
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }, [gaps]);

  // Sorted table
  const sortedGaps = useMemo(() => {
    return [...gaps].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'query') return dir * a.query.localeCompare(b.query);
      if (sortField === 'topScore') return dir * (a.topScore - b.topScore);
      return dir * (new Date(a.askedAt).getTime() - new Date(b.askedAt).getTime());
    });
  }, [gaps, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${API_URL}/api/chatbots/${chatbotId}/gap-report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gap-report-${chatbotId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    } finally {
      setDownloading(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {sortDir === 'asc' ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        )}
      </svg>
    );
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-semibold text-[var(--text)]">Gap analysis</h2>
          <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
            Queries where the chatbot struggled to find an answer
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading || totalGaps === 0}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-strong)] disabled:opacity-40 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {downloading ? 'Downloading…' : 'Download CSV'}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5">
        <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-[12px] text-blue-400 leading-relaxed">
          Gaps are queries where the chatbot had less than 25% confidence. Review these to improve your knowledge base.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Total gaps</p>
          <p className="text-[22px] font-bold text-[var(--danger)] tabular-nums">{totalGaps}</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Avg score</p>
          <p className="text-[22px] font-bold text-[var(--text)] tabular-nums">{avgScore}%</p>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <p className="text-[11px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Top keywords</p>
          {topKeywords.length > 0 ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {topKeywords.map(kw => (
                <span key={kw} className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text-secondary)]">
                  {kw}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--text-muted)]">—</p>
          )}
        </div>
      </div>

      {/* Table */}
      {totalGaps === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
          <p className="text-[14px] font-medium text-[var(--text)]">No gaps detected</p>
          <p className="text-[13px] text-[var(--text-muted)] mt-1">
            Your chatbot is answering all queries with sufficient confidence.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)]">
            <button
              onClick={() => handleSort('query')}
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors text-left"
            >
              Query <SortIcon field="query" />
            </button>
            <button
              onClick={() => handleSort('topScore')}
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Confidence <SortIcon field="topScore" />
            </button>
            <button
              onClick={() => handleSort('askedAt')}
              className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Date <SortIcon field="askedAt" />
            </button>
          </div>

          {/* Table rows */}
          <div className="divide-y divide-[var(--border)]">
            {sortedGaps.map(q => {
              const pct = Math.round(q.topScore * 100);
              const badgeColor = pct < 15
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-orange-500/10 text-orange-400 border-orange-500/20';
              return (
                <div
                  key={q.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 bg-[var(--bg)] hover:bg-[var(--surface)] transition-colors"
                >
                  <p className="text-[13px] text-[var(--text)] truncate pr-2">{q.query}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-semibold tabular-nums ${badgeColor}`}>
                    {pct}%
                  </span>
                  <span className="text-[12px] text-[var(--text-muted)] whitespace-nowrap">
                    {new Date(q.askedAt).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
