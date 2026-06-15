'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

interface ModelOption {
  value: string;
  label: string;
  provider: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'OpenAI' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'Google' },
  { value: 'llama-3.3-70b', label: 'LLaMA 3.3 70B', provider: 'Groq' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
];

interface ModelSettingsProps {
  chatbotId: string;
  currentModel?: string;
  currentApiKey?: string;
  onSave: () => void;
}

type ToastType = 'success' | 'error';

export default function ModelSettings({
  chatbotId,
  currentModel,
  currentApiKey,
  onSave,
}: ModelSettingsProps) {
  const hasCustomKey = Boolean(currentApiKey);

  const [usePlatformKeys, setUsePlatformKeys] = useState(!hasCustomKey);
  const [selectedModel, setSelectedModel] = useState(
    currentModel || MODEL_OPTIONS[0].value,
  );
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!usePlatformKeys && !apiKey.trim()) {
      showToast('Please enter your API key', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          usePlatformKeys
            ? { customModel: null, customApiKey: null }
            : { customModel: selectedModel, customApiKey: apiKey.trim() },
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast((data as { error?: string }).error || 'Failed to save', 'error');
        return;
      }
      showToast(
        usePlatformKeys
          ? 'Using platform keys'
          : 'Custom API key saved',
        'success',
      );
      onSave();
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try {
      const res = await apiFetch(`/api/chatbots/${chatbotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customModel: null, customApiKey: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast((data as { error?: string }).error || 'Failed to clear', 'error');
        return;
      }
      setUsePlatformKeys(true);
      setApiKey('');
      showToast('Reverted to platform keys', 'success');
      onSave();
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      setClearing(false);
    }
  };

  const selectedOption = MODEL_OPTIONS.find(m => m.value === selectedModel) ?? MODEL_OPTIONS[0];

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl text-[13px] font-medium animate-slide-in-right ${
            toast.type === 'success'
              ? 'bg-[var(--surface)] border-[var(--success)] text-[var(--success)]'
              : 'bg-[var(--surface)] border-[var(--danger)] text-[var(--danger)]'
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-5">
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--text)]">Model &amp; API key</h3>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
            Use platform keys or provide your own for more control
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setUsePlatformKeys(true)}
            className={`flex-1 py-2 text-[12px] font-medium rounded-md transition-all ${
              usePlatformKeys
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Use platform keys
            <span className="ml-1 text-[10px] opacity-60">(default)</span>
          </button>
          <button
            type="button"
            onClick={() => setUsePlatformKeys(false)}
            className={`flex-1 py-2 text-[12px] font-medium rounded-md transition-all ${
              !usePlatformKeys
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            Use my own API key
          </button>
        </div>

        {usePlatformKeys ? (
          <div className="px-4 py-3.5 rounded-lg bg-[var(--bg)] border border-[var(--border)]">
            <p className="text-[13px] text-[var(--text-secondary)]">
              ChatEmbed will handle model selection and API costs automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Model selector */}
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                Model
              </label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={e => setSelectedModel(e.target.value)}
                  className="w-full appearance-none px-3 py-2.5 text-[13px] rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)] transition-colors pr-8 cursor-pointer"
                >
                  {MODEL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.provider})
                    </option>
                  ))}
                </select>
                <svg
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-1.5">
                Provider: <span className="text-[var(--text-secondary)]">{selectedOption.provider}</span>
              </p>
            </div>

            {/* API Key input */}
            <div>
              <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1.5">
                API key
                {hasCustomKey && (
                  <span className="ml-2 text-[10px] font-normal text-[var(--success)]">
                    ● Key saved
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={hasCustomKey ? '••••••••••••  (enter to replace)' : `Enter your ${selectedOption.provider} API key`}
                  className="w-full px-3 py-2.5 pr-10 text-[13px] rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--border-strong)] transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {showApiKey ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Security note */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg)]">
              <svg className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                Your API key is stored encrypted. We use it only for this chatbot&apos;s responses.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-fg)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          {hasCustomKey && (
            <button
              onClick={handleClear}
              disabled={clearing}
              className="px-4 py-2.5 text-[13px] font-medium rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--danger)] hover:border-red-500/30 disabled:opacity-50 transition-all"
            >
              {clearing ? 'Clearing…' : 'Clear custom key'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
