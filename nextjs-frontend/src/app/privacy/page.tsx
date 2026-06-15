import type { Metadata } from 'next';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Privacy Policy — ChatEmbed',
  description: 'How ChatEmbed collects, uses, and protects your personal information.',
};

const LAST_UPDATED = 'June 1, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold tracking-tight mb-4">{title}</h2>
      <div className="space-y-3 text-[14px] text-[var(--text-secondary)] leading-7">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SiteNav />

      <main className="max-w-2xl mx-auto px-6 pt-28 pb-24">
        {/* Header */}
        <div className="mb-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)] mb-3">
            Legal
          </p>
          <h1 className="text-4xl font-semibold tracking-tight mb-4">Privacy Policy</h1>
          <p className="text-[13px] text-[var(--text-muted)]">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="h-px bg-[var(--border)] mb-10" />

        <p className="text-[14px] text-[var(--text-secondary)] leading-7 mb-10">
          ChatEmbed (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates the ChatEmbed platform and related services. This Privacy Policy explains what information we collect, how we use it, and the choices you have regarding your data.
        </p>

        <Section title="1. Information We Collect">
          <p>
            <strong className="text-[var(--text)]">Account information:</strong> When you register, we collect your name, email address, and a hashed password. If you sign in via OAuth (Google, GitHub), we receive only your email and display name from that provider.
          </p>
          <p>
            <strong className="text-[var(--text)]">Usage data:</strong> We log pages you crawl, chatbot configuration changes, and feature usage (e.g. gap report downloads) to improve the service and debug issues.
          </p>
          <p>
            <strong className="text-[var(--text)]">Chat conversations:</strong> Messages sent to your embedded widget pass through our servers to generate responses. By default these conversations are not stored permanently. You may opt in to conversation history in your dashboard.
          </p>
          <p>
            <strong className="text-[var(--text)]">API keys:</strong> If you provide third-party API keys (OpenAI, Gemini, Groq), they are encrypted at rest with AES-256 and decrypted only at inference time. We never log or expose your keys.
          </p>
          <p>
            <strong className="text-[var(--text)]">Payment information:</strong> Payments are processed by Stripe. We store only a Stripe customer ID — we never see or store raw card numbers.
          </p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use the data we collect to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Provide, operate, and maintain the ChatEmbed service.</li>
            <li>Process payments and send transactional emails (receipts, password resets).</li>
            <li>Respond to support requests and troubleshoot issues.</li>
            <li>Analyze aggregate, anonymized usage patterns to improve the platform.</li>
            <li>Send product updates and announcements (you may unsubscribe at any time).</li>
            <li>Detect and prevent fraud, abuse, or security incidents.</li>
          </ul>
          <p>
            We do <strong className="text-[var(--text)]">not</strong> sell your personal data to third parties. We do not use your website content or user conversations for training AI models.
          </p>
        </Section>

        <Section title="3. Third-Party Services">
          <p>We rely on the following sub-processors to operate the service:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-[var(--text)]">Stripe</strong> — payment processing</li>
            <li><strong className="text-[var(--text)]">Vercel / AWS</strong> — hosting and infrastructure</li>
            <li><strong className="text-[var(--text)]">Voyage AI</strong> — text embedding generation</li>
            <li><strong className="text-[var(--text)]">OpenAI / Google / Groq</strong> — AI inference (only when you select these models or supply your own key)</li>
            <li><strong className="text-[var(--text)]">Postmark</strong> — transactional email delivery</li>
          </ul>
          <p>
            Each sub-processor is bound by a Data Processing Agreement that meets GDPR requirements. We do not share your data with any other third parties.
          </p>
        </Section>

        <Section title="4. Cookies">
          <p>
            We use a single session cookie (<code className="text-[var(--text-secondary)] font-mono text-[13px]">ce_session</code>) to keep you logged in. We also store your theme preference (<code className="text-[var(--text-secondary)] font-mono text-[13px]">theme</code>) in <code className="text-[var(--text-secondary)] font-mono text-[13px]">localStorage</code>. We do not use tracking, advertising, or third-party analytics cookies.
          </p>
        </Section>

        <Section title="5. Data Retention">
          <p>
            We retain your account data for as long as your account is active. Crawled page content and vector embeddings are deleted within 30 days of chatbot deletion or account closure.
          </p>
          <p>
            You may delete your account and all associated data at any time from <strong className="text-[var(--text)]">Settings → Danger Zone</strong>. Deletion is permanent and irreversible.
          </p>
        </Section>

        <Section title="6. Data Security">
          <p>
            We implement industry-standard security measures including TLS 1.3 in transit, AES-256 encryption at rest for sensitive fields, and regular third-party security audits. Our infrastructure is hosted in ISO 27001–certified data centers.
          </p>
          <p>
            In the event of a data breach that affects your personal information, we will notify you by email within 72 hours of becoming aware of the incident, consistent with GDPR requirements.
          </p>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Access the personal data we hold about you.</li>
            <li>Correct inaccurate data.</li>
            <li>Request deletion of your data (&quot;right to erasure&quot;).</li>
            <li>Object to or restrict certain processing activities.</li>
            <li>Receive a machine-readable copy of your data (data portability).</li>
          </ul>
          <p>
            To exercise any of these rights, email <a href="mailto:privacy@chatembed.ai" className="text-[var(--accent-blue)] hover:underline">privacy@chatembed.ai</a>. We will respond within 30 days.
          </p>
        </Section>

        <Section title="8. Children's Privacy">
          <p>
            ChatEmbed is not directed at children under the age of 13 (or 16 in the EU). We do not knowingly collect personal information from children. If you believe a child has provided us with personal data, contact us and we will delete it promptly.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. If we make material changes, we will notify you by email or by displaying a prominent notice in your dashboard at least 14 days before the changes take effect.
          </p>
        </Section>

        <Section title="10. Contact Us">
          <p>
            Questions or concerns about this Privacy Policy? Contact our privacy team at:
          </p>
          <p>
            <a href="mailto:privacy@chatembed.ai" className="text-[var(--accent-blue)] hover:underline">
              privacy@chatembed.ai
            </a>
          </p>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
