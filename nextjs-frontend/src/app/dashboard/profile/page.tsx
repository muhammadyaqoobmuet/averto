"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { apiFetch } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";
import { 
  User, 
  ShieldCheck, 
  Palette, 
  EnvelopeSimple, 
  Warning, 
  LockKey,
  Eye,
  EyeSlash 
} from "@phosphor-icons/react";

// ── Types ──────────────────────────────────────────────────────────────────

type ProfileTab = "profile" | "security" | "appearance";

interface Toast {
  message: string;
  type: "success" | "error";
}

// ── Shared input style ─────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 text-[13px] rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--text-muted)] focus:ring-[1.5px] focus:ring-[var(--border-strong)] transition-all placeholder:text-[var(--text-muted)]";

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
    <div className="space-y-1.5">
      <label className="block text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
        {label}
        {hint && (
          <span className="text-[var(--text-muted)] font-normal ml-1 lowercase">
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
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all p-1 rounded-md hover:bg-[var(--surface-hover)] cursor-pointer"
        >
          {show ? <EyeSlash size={16} /> : <Eye size={16} />}
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
      whileHover={{ scale: loading || disabled ? 1 : 1.01 }}
      whileTap={{ scale: loading || disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={loading || disabled}
      className="btn-primary px-5 py-2.5 rounded-xl text-[12.5px] font-semibold"
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
        <p className="text-[13px] font-semibold text-[var(--text)]">{label}</p>
        {hint && (
          <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{hint}</p>
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
      className="relative px-10 py-10 w-full max-w-2xl mx-auto"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 38 }}
    >
      {/* Premium ambient top glow background */}
      <div className="absolute inset-x-0 top-0 pointer-events-none overflow-hidden -z-10 h-[300px]">
        <div 
          className="absolute top-[-15%] left-1/2 -translate-x-1/2 w-[500px] h-[200px] rounded-full blur-[80px]"
          style={{
            background: "radial-gradient(circle, rgba(200, 169, 102, 0.08) 0%, rgba(200, 169, 102, 0) 70%)"
          }}
        />
      </div>

      {/* Toast notifications */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, x: 24, y: 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: "spring", stiffness: 400, damping: 36 }}
            className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl text-[13px] font-medium backdrop-blur-md ${
              toast.type === "success"
                ? "bg-[var(--surface)]/95 border-[var(--success)]/30 text-[var(--success)] shadow-green-500/5"
                : "bg-[var(--surface)]/95 border-[var(--danger)]/30 text-[var(--danger)] shadow-red-500/5"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">
          Account Settings
        </h1>
        <p className="text-[13px] text-[var(--text-secondary)] mt-1">
          Manage your personal details, credentials, and app preferences.
        </p>
      </div>

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
        className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--border)] bg-gradient-to-b from-white/[0.015] to-transparent dark:from-white/[0.03] bg-[var(--surface)] hover:border-[var(--border-strong)] transition-all shadow-[inset_0_1px_rgba(255,255,255,0.02)] mb-8"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="avatar"
            className="w-12 h-12 rounded-full object-cover border border-[var(--border-strong)] shrink-0 shadow-sm"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex items-center justify-center text-[16px] font-bold text-[var(--text-secondary)] shrink-0 shadow-inner">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-[var(--text)] tracking-tight truncate">
            {name || "Unnamed user"}
          </p>
          <p className="text-[12px] text-[var(--text-secondary)] font-mono opacity-80 truncate mt-0.5">
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
        className="flex border-b border-[var(--border)] mb-8 gap-2"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-3 text-[13px] font-semibold transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "text-[var(--text)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.id === "profile" && <User size={15} weight={activeTab === tab.id ? "bold" : "regular"} />}
            {tab.id === "security" && <ShieldCheck size={15} weight={activeTab === tab.id ? "bold" : "regular"} />}
            {tab.id === "appearance" && <Palette size={15} weight={activeTab === tab.id ? "bold" : "regular"} />}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-[-1px] left-0 right-0 h-[2.5px] bg-[var(--text)] rounded-full"
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
            className="space-y-6"
          >
            <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-white/[0.015] to-transparent dark:from-white/[0.03] bg-[var(--surface)] overflow-hidden hover:border-[var(--border-strong)] transition-all">
              <div className="px-6 pt-5 pb-4 border-b border-[var(--border)]">
                <h2 className="text-[14.5px] font-semibold text-[var(--text)] tracking-tight">
                  Profile Information
                </h2>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                  Update your display name and avatar details.
                </p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
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
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      disabled
                      className={`${inputCls} cursor-not-allowed opacity-50 bg-[var(--bg-elevated)]`}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] opacity-60">
                      <EnvelopeSimple size={15} />
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] italic">
                    Contact support team directly to request an email update.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                    Avatar URL{" "}
                    <span className="text-[var(--text-muted)] font-normal lowercase">
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
              <div className="px-6 pb-5 flex justify-end border-t border-[var(--border)] pt-4">
                <SaveBtn
                  loading={savingProfile}
                  label="Save changes"
                  onClick={handleSaveProfile}
                />
              </div>
            </div>

            {/* Account deletion info */}
            <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-white/[0.015] to-transparent dark:from-white/[0.03] bg-[var(--surface)] hover:border-[var(--border-strong)] transition-all px-6 py-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/8 border border-red-500/15 flex items-center justify-center shrink-0">
                <Warning size={18} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-[14.5px] font-semibold text-[var(--text)] tracking-tight">
                  Delete Account
                </h2>
                <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed mt-1">
                  To permanently delete your active account and wipe all compiled chatbot databases, contact our support team.
                </p>
                <a
                  href="mailto:hello@averto.ai"
                  className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text)] hover:underline transition-all"
                >
                  hello@averto.ai
                </a>
              </div>
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
            <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-white/[0.015] to-transparent dark:from-white/[0.03] bg-[var(--surface)] overflow-hidden hover:border-[var(--border-strong)] transition-all">
              <div className="px-6 pt-5 pb-4 border-b border-[var(--border)]">
                <h2 className="text-[14.5px] font-semibold text-[var(--text)] tracking-tight">
                  Change Password
                </h2>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                  Create a secure credentials profile key to restrict unauthorized console login access.
                </p>
              </div>
              <div className="px-6 py-5 space-y-4">
                <PasswordField
                  label="Current Password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  show={showCurrentPw}
                  onToggle={() => setShowCurrentPw((v) => !v)}
                />
                <PasswordField
                  label="New Password"
                  hint="(min 6 characters)"
                  value={newPassword}
                  onChange={setNewPassword}
                  show={showNewPw}
                  onToggle={() => setShowNewPw((v) => !v)}
                />
                <div className="space-y-1.5">
                  <label className="block text-[12px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
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
              <div className="px-6 pb-5 flex justify-end border-t border-[var(--border)] pt-4">
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
            <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-b from-white/[0.015] to-transparent dark:from-white/[0.03] bg-[var(--surface)] overflow-hidden hover:border-[var(--border-strong)] transition-all">
              <div className="px-6 pt-5 pb-4 border-b border-[var(--border)]">
                <h2 className="text-[14.5px] font-semibold text-[var(--text)] tracking-tight">
                  Appearance
                </h2>
                <p className="text-[12px] text-[var(--text-secondary)] mt-1">
                  Customize the visual styling of Averto on this device browser.
                </p>
              </div>
              <div className="px-6 py-2">
                <Row
                  label="Theme mode"
                  hint="Switch between dark and light dynamic console interface"
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
