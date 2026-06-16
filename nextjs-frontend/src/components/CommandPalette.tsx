"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  href?: string;
  action?: () => void;
  icon: React.ReactNode;
  shortcut?: string;
  group: string;
}

const iconCls = "w-4 h-4 shrink-0 text-[var(--text-muted)]";

const HomeIcon = () => (
  <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const BotIcon = () => (
  <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H4a2 2 0 01-2-2V6a2 2 0 012-2h16a2 2 0 012 2v9a2 2 0 01-2 2h-1" />
  </svg>
);

const DocsIcon = () => (
  <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const ProfileIcon = () => (
  <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const NewIcon = () => (
  <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router],
  );

  const baseItems: PaletteItem[] = [
    {
      id: "home",
      label: "Overview",
      description: "Go to your chatbot dashboard",
      href: "/dashboard",
      icon: <HomeIcon />,
      group: "Navigation",
    },
    {
      id: "new",
      label: "New chatbot",
      description: "Create a chatbot from a URL",
      href: "/dashboard",
      icon: <NewIcon />,
      group: "Navigation",
    },
    {
      id: "profile",
      label: "Profile",
      description: "Edit your account details",
      href: "/dashboard/profile",
      icon: <ProfileIcon />,
      group: "Navigation",
    },
    {
      id: "docs",
      label: "Documentation",
      description: "Guides, embed code, and API reference",
      href: "/docs",
      icon: <DocsIcon />,
      shortcut: "D",
      group: "Navigation",
    },
  ];

  // Filter by query
  const filtered = query.trim()
    ? baseItems.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          item.description?.toLowerCase().includes(query.toLowerCase()),
      )
    : baseItems;

  // Group items
  const groups = filtered.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  // Flat index for keyboard nav
  const flat = Object.values(groups).flat();

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter": {
        e.preventDefault();
        const item = flat[activeIdx];
        if (item) {
          item.action?.();
          if (item.href) navigate(item.href);
        }
        break;
      }
      case "Escape":
        onClose();
        break;
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            key="palette"
            className="fixed z-50 top-[18%] left-1/2 -translate-x-1/2 w-full max-w-[560px] px-4"
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-2xl shadow-black/40 overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border)]">
                <svg
                  className="w-4 h-4 shrink-0 text-[var(--text-muted)]"
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
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-[14px] text-[var(--text)] placeholder:text-[var(--text-muted)] outline-none"
                />
                <button
                  onClick={onClose}
                  className="shrink-0 w-6 h-6 rounded-md border border-[var(--border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Results */}
              <div
                ref={listRef}
                className="max-h-[340px] overflow-y-auto p-2"
              >
                {flat.length === 0 ? (
                  <div className="py-10 text-center text-[13px] text-[var(--text-muted)]">
                    No results for &quot;{query}&quot;
                  </div>
                ) : (
                  Object.entries(groups).map(([group, items]) => (
                    <div key={group} className="mb-1">
                      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        {group}
                      </p>
                      {items.map((item) => {
                        const idx = flat.indexOf(item);
                        const isActive = idx === activeIdx;
                        return (
                          <button
                            key={item.id}
                            data-idx={idx}
                            onMouseEnter={() => setActiveIdx(idx)}
                            onClick={() => {
                              item.action?.();
                              if (item.href) navigate(item.href);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                              isActive
                                ? "bg-[var(--surface)] text-[var(--text)]"
                                : "text-[var(--text-secondary)] hover:text-[var(--text)]"
                            }`}
                          >
                            <span className={isActive ? "opacity-80" : "opacity-50"}>
                              {item.icon}
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="text-[13px] font-medium">
                                {item.label}
                              </span>
                              {item.description && (
                                <span className="ml-2 text-[12px] text-[var(--text-muted)]">
                                  {item.description}
                                </span>
                              )}
                            </div>
                            {item.shortcut && (
                              <kbd className="shrink-0 w-5 h-5 flex items-center justify-center rounded border border-[var(--border)] text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg)]">
                                {item.shortcut}
                              </kbd>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border)] bg-[var(--surface)]/50">
                <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[10px] font-mono bg-[var(--bg)]">↑</kbd>
                    <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[10px] font-mono bg-[var(--bg)]">↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[10px] font-mono bg-[var(--bg)]">↵</kbd>
                    Go to page
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                  <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[10px] font-mono bg-[var(--bg)]">Esc</kbd>
                  Exit
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
