"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { apiFetch } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

// ── Types ──────────────────────────────────────────────────────────────────

type ProfileTab = "profile" | "security" | "appearance";

interface Toast {
  message: string;
  type: "success" | "error";
}

// ── Shared input style ─────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2.5 text-[13px] rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)] transition-colors";

// ── Animations ─────────────────────────────────────────────────────────────

const tabContentVariants: Variants = {
  hidden: (dir: number) => ({ opacity: 0, x: dir * 18 }),
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 380, damping: 38 },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: -dir * 18,
    transition: { duration: 0.15 },
  }),
};

// ── Sub-components ─────────────────────────────────────────────────────────

function EyeOff() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  );
}

function EyeOn() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function PasswordField({
  label,
  hint,
  value,
  onChange,
  show,
  onToggle,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
        {label}
        {hint && (
          <span className="text-[var(--text-muted)] font-normal ml-1">
            {hint}
          </span>
        )}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} pr-10`}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {show ? <EyeOff /> : <EyeOn />}
        </button>
      </div>
    </div>
  );
}

function SaveBtn({
  loading,
  label,
  onClick,
  disabled,
}: {
  loading: boolean;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: loading || disabled ? 1 : 1.02 }}
      whileTap={{ scale: loading || disabled ? 1 : 0.97 }}
      onClick={onClick}
      disabled={loading || disabled}
      className="px-5 py-2 rounded-lg text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 disabled:opacity-50 transition-opacity"
    >
      {loading ? "Saving..." : label}
    </motion.button>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 border-b border-[var(--border)] last:border-0">
      <div>
        <p className="text-[13px] font-medium text-[var(--text)]">{label}</p>
        {hint && (
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{hint}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "appearance", label: "Appearance" },
];

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<ProfileTab>("profile");
  const prevTabIndex = useRef(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setName(u.name || "");
        setEmail(u.email || "");
        setAvatarUrl(u.avatarUrl || "");
      } catch {
        /* ignore */
      }
    }
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await apiFetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatarUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(
          (data as { error?: string }).error || "Failed to save profile",
          "error",
        );
        return;
      }
      const updated = await res.json();
      const stored = localStorage.getItem("user");
      if (stored) {
        try {
          const u = JSON.parse(stored);
          localStorage.setItem("user", JSON.stringify({ ...u, ...updated }));
        } catch {
          /* ignore */
        }
      }
      showToast("Profile updated successfully", "success");
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      showToast("New password must be at least 6 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await apiFetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(
          (data as { error?: string }).error || "Failed to change password",
          "error",
        );
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password changed successfully", "success");
    } catch {
      showToast("Network error. Please try again.", "error");
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = name?.[0]?.toUpperCase() || email?.[0]?.toUpperCase() || "U";

  const switchTab = (tab: ProfileTab) => {
    const oldIdx = TABS.findIndex((t) => t.id === activeTab);
    const newIdx = TABS.findIndex((t) => t.id === tab);
    prevTabIndex.current = newIdx > oldIdx ? 1 : -1;
    setActiveTab(tab);
  };

  return (
    <motion.div
      className="px-10 py-10 w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 38 }}
    >
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, x: 24, y: 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: "spring", stiffness: 400, damping: 36 }}
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl text-[13px] font-medium ${
              toast.type === "success"
                ? "bg-[var(--surface)] border-[var(--success)] text-[var(--success)]"
                : "bg-[var(--surface)] border-[var(--danger)] text-[var(--danger)]"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Identity card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          type: "spring",
          stiffness: 380,
          damping: 38,
          delay: 0.04,
        }}
        className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] mb-6"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="avatar"
            className="w-12 h-12 rounded-full object-cover border border-[var(--border)] shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[var(--border-strong)] flex items-center justify-center text-[18px] font-semibold text-[var(--text-secondary)] shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[var(--text)] truncate">
            {name || "Unnamed user"}
          </p>
          <p className="text-[13px] text-[var(--text-muted)] truncate mt-0.5">
            {email}
          </p>
        </div>
      </motion.div>

      {/* Tab bar */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          type: "spring",
          stiffness: 380,
          damping: 38,
          delay: 0.08,
        }}
        className="flex border-b border-[var(--border)] mb-6"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`relative px-5 py-2.5 text-[13px] font-medium transition-colors ${
              activeTab === tab.id
                ? "text-[var(--text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[var(--text)] rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 42 }}
              />
            )}
          </button>
        ))}
      </motion.div>

      {/* Tab content */}
      <AnimatePresence mode="wait" custom={prevTabIndex.current}>
        {activeTab === "profile" && (
          <motion.div
            key="profile"
            custom={prevTabIndex.current}
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-5"
          >
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="px-6 pt-5 pb-4 border-b border-[var(--border)]">
                <h2 className="text-[14px] font-semibold text-[var(--text)]">
                  Profile information
                </h2>
                <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                  Update your display name and avatar.
                </p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputCls}
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className={`${inputCls} cursor-not-allowed opacity-50`}
                  />
                  <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                    Contact support to change your email address.
                  </p>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                    Avatar URL{" "}
                    <span className="text-[var(--text-muted)] font-normal">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className={inputCls}
                    placeholder="https://example.com/avatar.jpg"
                  />
                </div>
              </div>
              <div className="px-6 pb-5 flex justify-end">
                <SaveBtn
                  loading={savingProfile}
                  label="Save changes"
                  onClick={handleSaveProfile}
                />
              </div>
            </div>

            {/* Account deletion info — no button, just contact info */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-5">
              <h2 className="text-[14px] font-semibold text-[var(--text)] mb-1">
                Delete account
              </h2>
              <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
                To permanently delete your account and all associated data,
                contact the project owner.
              </p>
              <a
                href="mailto:hello@averto.ai"
                className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                hello@averto.ai
              </a>
            </div>
          </motion.div>
        )}

        {activeTab === "security" && (
          <motion.div
            key="security"
            custom={prevTabIndex.current}
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="px-6 pt-5 pb-4 border-b border-[var(--border)]">
                <h2 className="text-[14px] font-semibold text-[var(--text)]">
                  Change password
                </h2>
                <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                  Choose a strong password you don&apos;t use elsewhere.
                </p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <PasswordField
                  label="Current password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  show={showCurrentPw}
                  onToggle={() => setShowCurrentPw((v) => !v)}
                />
                <PasswordField
                  label="New password"
                  hint="(min 6 characters)"
                  value={newPassword}
                  onChange={setNewPassword}
                  show={showNewPw}
                  onToggle={() => setShowNewPw((v) => !v)}
                />
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                    Confirm new password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputCls}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="px-6 pb-5 flex justify-end">
                <SaveBtn
                  loading={savingPassword}
                  label="Change password"
                  onClick={handleChangePassword}
                  disabled={
                    !currentPassword || !newPassword || !confirmPassword
                  }
                />
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "appearance" && (
          <motion.div
            key="appearance"
            custom={prevTabIndex.current}
            variants={tabContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="px-6 pt-5 pb-4 border-b border-[var(--border)]">
                <h2 className="text-[14px] font-semibold text-[var(--text)]">
                  Appearance
                </h2>
                <p className="text-[13px] text-[var(--text-muted)] mt-0.5">
                  Customize how Averto looks for you.
                </p>
              </div>
              <div className="px-6 py-2">
                <Row
                  label="Theme"
                  hint="Switch between light and dark interface"
                >
                  <ThemeToggle />
                </Row>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
