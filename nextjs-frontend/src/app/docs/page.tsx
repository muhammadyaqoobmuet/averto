import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";

export const metadata: Metadata = {
  title: "Docs — ChatEmbed",
  description:
    "Learn what ChatEmbed is, how to create your first AI chatbot from any website, and how to embed it anywhere in minutes.",
};

// ─────────────────────────────────────────
//  Prose helpers
// ─────────────────────────────────────────
function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="text-2xl font-semibold tracking-tight mt-14 mb-5 scroll-mt-24 text-[var(--text)]"
    >
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[16px] font-semibold mt-8 mb-3 text-[var(--text)]">
      {children}
    </h3>
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
    <div className="my-5 flex gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
      <span className="text-amber-400 mt-0.5 shrink-0">
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
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </span>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
        {children}
      </p>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-5 flex gap-3 p-4 rounded-xl border border-blue-500/30 bg-blue-500/5">
      <span className="text-blue-400 mt-0.5 shrink-0">
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
            d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18"
          />
        </svg>
      </span>
      <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
        {children}
      </p>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 mb-8">
      <div className="shrink-0 w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] flex items-center justify-center text-[12px] font-bold mt-0.5">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[var(--text)] mb-2">
          {title}
        </p>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
//  Sidebar TOC
// ─────────────────────────────────────────
const TOC = [
  { id: "what-is-chatembed", label: "What is ChatEmbed?" },
  { id: "how-it-works", label: "How it works" },
  { id: "quick-start", label: "Quick Start" },
  { id: "configuration", label: "Configuration" },
  { id: "allowed-origins", label: "Allowed Origins" },
  { id: "troubleshooting", label: "Troubleshooting" },
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
        <aside className="hidden lg:block w-52 shrink-0">
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
                Links
              </p>
              <Link
                href="/dashboard"
                className="block text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] py-1 transition-colors"
              >
                Dashboard
              </Link>
              <a
                href="mailto:support@chatembed.ai"
                className="block text-[13px] text-[var(--text-secondary)] hover:text-[var(--text)] py-1 transition-colors"
              >
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
              Everything you need to go from a URL to a live AI chatbot on your
              website.
            </p>
          </div>

          <div className="h-px bg-[var(--border)] mb-10" />

          {/* ── WHAT IS CHATEMBED ── */}
          <H2 id="what-is-chatembed">What is ChatEmbed?</H2>

          <P>
            ChatEmbed is an AI chatbot builder that turns any website into a
            conversational knowledge base. You give it a URL, it crawls and
            indexes your pages, and generates a smart chatbot that can answer
            questions about your content — no coding or model training needed.
          </P>

          <P>
            Once set up, you get a lightweight JavaScript snippet to paste on
            your site. Visitors see a floating chat button. They ask questions.
            The bot answers using only your content, with source links and a
            confidence score on every reply.
          </P>

          <div className="my-6 grid grid-cols-3 gap-3">
            {[
              {
                icon: "🌐",
                title: "Any website",
                desc: "Paste a URL and we crawl it automatically. Upload PDFs and docs too.",
              },
              {
                icon: "🤖",
                title: "AI answers",
                desc: "Powered by vector search + LLM. Answers stay grounded in your content.",
              },
              {
                icon: "📦",
                title: "One script tag",
                desc: "Drop one <script> tag on your site. No frameworks, no build step.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)]"
              >
                <div className="text-xl mb-2">{f.icon}</div>
                <p className="text-[13px] font-semibold text-[var(--text)] mb-1">
                  {f.title}
                </p>
                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="h-px bg-[var(--border)] my-10" />

          {/* ── HOW IT WORKS ── */}
          <H2 id="how-it-works">How it works</H2>

          <Step n={1} title="You give us a URL">
            <P>
              Create a chatbot in the dashboard by entering your website URL.
              Our crawler visits your pages, extracts the text, splits it into
              chunks, and stores it as vector embeddings in a database.
            </P>
          </Step>

          <Step n={2} title="You customize the widget">
            <P>
              In the Customize tab you control the bot name, welcome message,
              accent color, bubble color, chat background, dark mode, corner
              radius, and widget position. The live preview on the right updates
              in real time.
            </P>
          </Step>

          <Step n={3} title="You embed one script tag">
            <P>
              Copy the generated snippet from the Embed tab and paste it before
              the closing <Code>&lt;/body&gt;</Code> tag on every page of your
              site. The widget loads asynchronously and never slows your page
              down.
            </P>
          </Step>

          <Step n={4} title="Visitors get instant answers">
            <P>
              The floating chat button appears on your site. Visitors type
              questions, the widget streams the answer in real time, and every
              response includes source links so readers can verify the
              information.
            </P>
          </Step>

          <div className="h-px bg-[var(--border)] my-10" />

          {/* ── QUICK START ── */}
          <H2 id="quick-start">Quick Start</H2>

          <H3>1. Create your chatbot</H3>
          <P>
            Go to the{" "}
            <Link
              href="/dashboard"
              className="text-[var(--text)] underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              Dashboard
            </Link>
            , click <strong>New chatbot</strong>, enter your site URL and a
            name, and hit Create. Crawling starts immediately and typically
            finishes in under two minutes.
          </P>

          <H3>2. Copy the embed snippet</H3>
          <P>
            Once the status shows <strong>Ready</strong>, open the{" "}
            <strong>Embed</strong> tab. You will see a pre-filled script tag
            with your API key and all your customization applied:
          </P>

          <CodeBlock lang="html">{`<script
  src="https://your-domain.com/widget.js"
  data-api-key="YOUR_API_KEY"
  data-bot-name="My Assistant"
  data-welcome-message="Hi! How can I help you?"
  data-primary-color="#2563eb"
  data-bubble-color="#2563eb"
  data-chat-bg="#ffffff"
  data-blur="false"
  data-dark-mode="false"
  data-position="bottom-right"
  data-border-radius="soft"
  data-show-branding="true"
  defer
></script>`}</CodeBlock>

          <H3>3. Paste it on your site</H3>
          <P>
            Add the snippet before the closing <Code>&lt;/body&gt;</Code> tag on
            every page you want the widget to appear on. Put it in your shared
            layout file so you only need to add it once.
          </P>

          <Tip>
            In Next.js, add the snippet to <Code>app/layout.tsx</Code> inside
            the <Code>&lt;body&gt;</Code>. In plain HTML, paste it at the bottom
            of your <Code>index.html</Code>. In WordPress, use the Theme File
            Editor to edit <Code>footer.php</Code>.
          </Tip>

          <H3>4. Restrict to your domain (recommended)</H3>
          <P>
            Go to <strong>Settings</strong> in the chatbot studio and add your
            website origin under <strong>Allowed Origins</strong>. This prevents
            anyone from using your API key on their own site.
          </P>

          <CodeBlock lang="text">{`https://yoursite.com
https://www.yoursite.com`}</CodeBlock>

          <div className="h-px bg-[var(--border)] my-10" />

          {/* ── CONFIGURATION ── */}
          <H2 id="configuration">Configuration</H2>

          <P>
            All widget behavior is driven by <Code>data-*</Code> attributes on
            the script tag. The Embed tab generates the correct snippet for you
            automatically based on your Customize settings.
          </P>

          <div className="my-6 rounded-xl border border-[var(--border)] overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                  <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)]">
                    Attribute
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)]">
                    Default
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-[var(--text-secondary)]">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[
                  [
                    "data-api-key",
                    "required",
                    "Your chatbot's unique API key from the dashboard.",
                  ],
                  [
                    "data-bot-name",
                    '"Chat Assistant"',
                    "Name shown in the widget header.",
                  ],
                  [
                    "data-welcome-message",
                    '"Hi! How can I help?"',
                    "First message shown when the chat opens.",
                  ],
                  [
                    "data-primary-color",
                    '"#18181b"',
                    "Accent color for user messages and the Send button.",
                  ],
                  [
                    "data-bubble-color",
                    "primary-color",
                    "Color of the floating launcher button.",
                  ],
                  [
                    "data-chat-bg",
                    '"#ffffff"',
                    "Background color of the messages area.",
                  ],
                  [
                    "data-blur",
                    '"false"',
                    '"true" enables frosted-glass (glassmorphism) effect.',
                  ],
                  [
                    "data-dark-mode",
                    '"false"',
                    '"true" switches the widget to a dark theme.',
                  ],
                  [
                    "data-position",
                    '"bottom-right"',
                    '"bottom-left" moves the widget to the left side.',
                  ],
                  [
                    "data-border-radius",
                    '"soft"',
                    'Corner style: "sharp", "soft", "rounded", or "pill".',
                  ],
                  [
                    "data-show-branding",
                    '"true"',
                    '"false" hides the "Powered by ChatEmbed" footer.',
                  ],
                  [
                    "data-api-url",
                    "auto-detected",
                    "Override the backend URL (for self-hosted deployments). Defaults to current origin.",
                  ],
                ].map(([attr, def, desc]) => (
                  <tr
                    key={attr}
                    className="hover:bg-[var(--surface)] transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-[11px] text-blue-400 align-top whitespace-nowrap">
                      {attr}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--text-muted)] align-top whitespace-nowrap">
                      {def}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] align-top text-[13px]">
                      {desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="h-px bg-[var(--border)] my-10" />

          {/* ── ALLOWED ORIGINS ── */}
          <H2 id="allowed-origins">Allowed Origins</H2>

          <P>
            By default any website can call your chatbot using its API key.
            Allowed Origins lets you restrict this to specific domains so your
            key cannot be embedded on someone else's site.
          </P>

          <H3>How to set it up</H3>
          <P>
            In the chatbot studio, open <strong>Settings</strong> and scroll to{" "}
            <strong>Allowed Origins</strong>. Add one origin per line, including
            the scheme and without a trailing slash:
          </P>

          <CodeBlock lang="text">{`https://yoursite.com
https://www.yoursite.com
https://app.yoursite.com`}</CodeBlock>

          <P>
            Click <strong>Save allowed origins</strong>. The backend will now
            reject requests coming from any origin not in the list with a{" "}
            <Code>403 Origin not allowed</Code> response.
          </P>

          <Note>
            <strong>Leave the list empty during development.</strong> When the
            list is empty the API accepts any origin. Add your production
            domains when you go live.
          </Note>

          <Tip>
            Origins must match exactly — <Code>https://yoursite.com</Code> and{" "}
            <Code>https://www.yoursite.com</Code> are two separate entries.
            Include both if your site is accessible on both.
          </Tip>

          <div className="h-px bg-[var(--border)] my-10" />

          {/* ── TROUBLESHOOTING ── */}
          <H2 id="troubleshooting">Troubleshooting</H2>

          <H3>CORS error in the browser console</H3>
          <P>
            This means your backend URL is not accessible from the page that
            loaded the widget. Check two things:
          </P>
          <P>
            First, make sure the <Code>data-api-url</Code> attribute in your
            snippet points to a publicly reachable URL (not{" "}
            <Code>localhost</Code>) when you deploy to production. Second, if
            you have set Allowed Origins, make sure the current page&apos;s
            domain is in the list.
          </P>

          <H3>403 Origin not allowed</H3>
          <P>
            The origin of the page loading the widget is not in your Allowed
            Origins list. Either add the domain in Settings, or clear the list
            to allow all origins.
          </P>

          <H3>Widget does not appear on the page</H3>
          <P>
            Open the browser console and check for JavaScript errors. Make sure
            the <Code>data-api-key</Code> value exactly matches the key shown in
            the Embed tab. The chatbot must also be in <strong>Ready</strong>{" "}
            status.
          </P>

          <H3>Chatbot says it does not know the answer</H3>
          <P>
            Check the Knowledge tab to confirm the pages that contain the answer
            were actually crawled. If they are missing, they may require
            authentication or JavaScript rendering to load. Use the document
            upload feature to add that content manually.
          </P>

          <Note>
            Sites using Cloudflare Bot Fight Mode, Turnstile, or similar CAPTCHA
            systems will block the crawler. Use the PDF/document upload feature
            instead for those pages.
          </Note>

          <H3>Re-crawl after updating your site</H3>
          <P>
            Go to the <strong>Knowledge</strong> tab and click{" "}
            <strong>Re-crawl site</strong>. This replaces all crawled pages with
            fresh content while keeping any manually uploaded documents.
          </P>

          <div className="h-px bg-[var(--border)] my-10" />

          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-semibold text-[var(--text)] mb-1">
                Need help?
              </p>
              <p className="text-[13px] text-[var(--text-muted)]">
                Open an issue or reach out directly.
              </p>
            </div>
            <a
              href="mailto:support@chatembed.ai"
              className="btn-primary shrink-0 px-4 py-2 rounded-lg text-[13px] font-semibold"
            >
              Email support
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
