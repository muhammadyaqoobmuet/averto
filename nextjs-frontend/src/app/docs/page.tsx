import type { Metadata } from 'next';
import Link from 'next/link';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Docs — ChatEmbed',
  description: 'Get started with ChatEmbed in minutes. Quick start, configuration, API reference, and troubleshooting.',
};

// ─────────────────────────────────────────
//  Reusable prose wrappers
// ─────────────────────────────────────────
function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-2xl font-semibold tracking-tight mt-14 mb-5 scroll-mt-24"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[16px] font-semibold mt-8 mb-3">{children}</h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] text-[var(--text-secondary)] leading-7 mb-4">
      {children}
    </p>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[12px] font-mono text-[var(--text-secondary)]">
      {children}
    </code>
  );
}

function CodeBlock({ lang, children }: { lang: string; children: string }) {
  return (
    <div className="my-5 rounded-xl border border-[var(--border)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--surface)] border-b border-[var(--border)]">
        <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {lang}
        </span>
      </div>
      <pre className="p-5 overflow-x-auto bg-[var(--bg-elevated)]">
        <code className="text-[13px] font-mono text-[var(--text-secondary)] leading-6 whitespace-pre">
          {children}
        </code>
      </pre>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 flex gap-3 p-4 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/5">
      <span className="text-[var(--warning)] mt-0.5 flex-shrink-0">⚠</span>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{children}</p>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 flex gap-3 p-4 rounded-xl border border-[var(--accent-blue)]/30 bg-[var(--accent-blue)]/5">
      <span className="text-[var(--accent-blue)] mt-0.5 flex-shrink-0">💡</span>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{children}</p>
    </div>
  );
}

// ─────────────────────────────────────────
//  Sidebar TOC links
// ─────────────────────────────────────────
const TOC = [
  { id: 'quick-start',   label: 'Quick Start' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'api-reference', label: 'API Reference' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
];

// ─────────────────────────────────────────
//  Page
// ─────────────────────────────────────────
export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SiteNav active="docs" />

      <div className="max-w-6xl mx-auto px-6 pt-28 pb-20 flex gap-12">

        {/* Sidebar */}
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] mb-3">
              On this page
            </p>
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] py-1 transition-colors"
              >
                {item.label}
              </a>
            ))}
            <div className="pt-6 border-t border-[var(--border)] mt-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)] mb-3">
                Resources
              </p>
              <Link href="/#pricing" className="block text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] py-1 transition-colors">
                Pricing
              </Link>
              <a href="mailto:hello@chatembed.ai" className="block text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] py-1 transition-colors">
                Support
              </a>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 max-w-2xl">

          {/* Page title */}
          <div className="mb-10">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)] mb-3">
              Documentation
            </p>
            <h1 className="text-4xl font-semibold tracking-tight mb-4">
              Getting started
            </h1>
            <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed">
              ChatEmbed turns any website into a conversational knowledge base. This guide walks you from zero to a live chatbot widget in under 5 minutes.
            </p>
          </div>

          <div className="h-px bg-[var(--border)] mb-10" />

          {/* ── QUICK START ── */}
          <H2 id="quick-start">Quick Start</H2>

          <P>
            After signing up and creating your first chatbot, you&apos;ll see an <strong>Embed</strong> tab in the dashboard. Copy the script snippet and paste it anywhere before the closing <Code>&lt;/body&gt;</Code> tag on your page.
          </P>

          <CodeBlock lang="html">{`<!-- ChatEmbed widget -->
<script
  src="https://cdn.chatembed.ai/widget.js"
  data-chatbot-id="YOUR_CHATBOT_ID"
  defer
></script>`}</CodeBlock>

          <P>
            That&apos;s it. The widget renders as a floating button in the bottom-right corner. Click it to open the chat panel.
          </P>

          <Tip>
            You can place the script tag in a shared layout file (e.g. <Code>_document.tsx</Code> in Next.js or <Code>index.html</Code> in Vite) so it loads on every page automatically.
          </Tip>

          <H3>Using npm (optional)</H3>
          <P>
            If you prefer a module import over a script tag, an npm package is available for React and Vue projects.
          </P>
          <CodeBlock lang="bash">{`npm install @chatembed/react`}</CodeBlock>
          <CodeBlock lang="tsx">{`import { ChatEmbedWidget } from '@chatembed/react';

export default function App() {
  return (
    <>
      {/* your app */}
      <ChatEmbedWidget chatbotId="YOUR_CHATBOT_ID" />
    </>
  );
}`}</CodeBlock>

          <div className="h-px bg-[var(--border)] my-10" />

          {/* ── CONFIGURATION ── */}
          <H2 id="configuration">Configuration</H2>

          <P>
            The widget is configured entirely via <Code>data-*</Code> attributes on the script tag (or as props when using the npm package). All attributes are optional — sensible defaults are applied from your dashboard settings.
          </P>

          <div className="my-6 rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)]">Attribute</th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)]">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)]">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  ['data-chatbot-id', 'string', 'Required. Your chatbot\'s unique ID from the dashboard.'],
                  ['data-position', '"bottom-right" | "bottom-left"', 'Widget anchor position. Default: "bottom-right".'],
                  ['data-primary-color', 'hex string', 'Accent color for the widget header and CTA button.'],
                  ['data-welcome-message', 'string', 'First message shown when the chat opens.'],
                  ['data-placeholder', 'string', 'Input placeholder text. Default: "Ask a question…"'],
                  ['data-hide-branding', 'boolean', 'Hide "Powered by ChatEmbed". Pro+ only.'],
                  ['data-open', 'boolean', 'If "true", opens the chat panel on page load.'],
                ].map(([attr, type, desc]) => (
                  <tr key={attr} className="hover:bg-[var(--surface)] transition-colors">
                    <td className="px-4 py-3 font-mono text-[12px] text-[var(--accent-blue)] align-top whitespace-nowrap">{attr}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[var(--text-muted)] align-top whitespace-nowrap">{type}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] align-top">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <H3>Full example</H3>
          <CodeBlock lang="html">{`<script
  src="https://cdn.chatembed.ai/widget.js"
  data-chatbot-id="abc123"
  data-position="bottom-right"
  data-primary-color="#6366f1"
  data-welcome-message="Hi! Ask me anything about our docs."
  data-hide-branding="true"
  defer
></script>`}</CodeBlock>

          <div className="h-px bg-[var(--border)] my-10" />

          {/* ── API REFERENCE ── */}
          <H2 id="api-reference">API Reference</H2>

          <P>
            The ChatEmbed REST API lets you manage chatbots, trigger re-crawls, and pull analytics programmatically. All endpoints require a Bearer token from <strong>Settings → API Keys</strong>.
          </P>

          <H3>Base URL</H3>
          <CodeBlock lang="text">{`https://api.chatembed.ai/v1`}</CodeBlock>

          <H3>Authentication</H3>
          <CodeBlock lang="bash">{`curl https://api.chatembed.ai/v1/chatbots \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</CodeBlock>

          <H3>Endpoints</H3>
          <div className="space-y-4 mt-4">
            {[
              {
                method: 'GET',
                path: '/chatbots',
                desc: 'List all chatbots in your account.',
              },
              {
                method: 'POST',
                path: '/chatbots',
                desc: 'Create a new chatbot. Body: { name, url, maxPages }.',
              },
              {
                method: 'POST',
                path: '/chatbots/:id/crawl',
                desc: 'Trigger a re-crawl for an existing chatbot.',
              },
              {
                method: 'GET',
                path: '/chatbots/:id/gaps',
                desc: 'Retrieve unanswered questions (knowledge gaps) for a chatbot.',
              },
              {
                method: 'DELETE',
                path: '/chatbots/:id',
                desc: 'Delete a chatbot and all its indexed data.',
              },
            ].map((ep) => (
              <div key={ep.path} className="flex gap-3 items-start p-4 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <span
                  className="flex-shrink-0 text-[11px] font-bold font-mono px-2 py-0.5 rounded"
                  style={{
                    background: ep.method === 'GET' ? 'rgba(34,197,94,0.12)' : ep.method === 'POST' ? 'rgba(99,102,241,0.12)' : 'rgba(239,68,68,0.12)',
                    color: ep.method === 'GET' ? 'var(--success)' : ep.method === 'POST' ? 'var(--accent-blue)' : 'var(--danger)',
                  }}
                >
                  {ep.method}
                </span>
                <div>
                  <code className="text-[13px] font-mono text-[var(--text)]">{ep.path}</code>
                  <p className="text-[13px] text-[var(--text-muted)] mt-1">{ep.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="h-px bg-[var(--border)] my-10" />

          {/* ── TROUBLESHOOTING ── */}
          <H2 id="troubleshooting">Troubleshooting</H2>

          <Note>
            <strong>Cloudflare & bot protection:</strong> Sites that use Cloudflare&apos;s Bot Fight Mode, Turnstile, or similar CAPTCHA systems will block our crawler. ChatEmbed cannot crawl these pages. You can still add content manually via the File Upload feature.
          </Note>

          <H3>The widget doesn&apos;t appear</H3>
          <P>
            Check that the script tag is placed before <Code>&lt;/body&gt;</Code> and that <Code>data-chatbot-id</Code> matches the ID shown in your dashboard exactly (it&apos;s case-sensitive). Open the browser console for any JavaScript errors.
          </P>

          <H3>CSP (Content Security Policy) errors</H3>
          <P>
            If your site uses a strict CSP, you&apos;ll need to allow the ChatEmbed CDN and API origins. Add the following to your CSP header:
          </P>
          <CodeBlock lang="text">{`Content-Security-Policy:
  script-src  'self' https://cdn.chatembed.ai;
  connect-src 'self' https://api.chatembed.ai;
  frame-src   'none';`}</CodeBlock>

          <H3>Crawl finished but answers are wrong</H3>
          <P>
            Verify that the crawled pages actually contain the information you expect. Go to <strong>Dashboard → Chatbot → Pages</strong> to see which URLs were indexed and their extracted text. If key pages are missing, check whether they require authentication or JavaScript to render.
          </P>

          <H3>Rate limits</H3>
          <P>
            The free tier supports up to 20 chat messages per user per day. Pro allows 500 per user per day. If you need higher limits, contact us for an Enterprise plan.
          </P>

          <div className="h-px bg-[var(--border)] my-10" />

          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-semibold mb-1">Still stuck?</p>
              <p className="text-[13px] text-[var(--text-muted)]">Our team responds within a business day.</p>
            </div>
            <a
              href="mailto:hello@chatembed.ai"
              className="flex-shrink-0 px-4 py-2 rounded-lg text-[13px] font-semibold bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90 transition-opacity"
            >
              Email support →
            </a>
          </div>

        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
