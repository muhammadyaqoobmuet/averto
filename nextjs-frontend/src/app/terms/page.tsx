import type { Metadata } from 'next';
import SiteNav from '@/components/SiteNav';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Terms of Service — ChatEmbed',
  description: 'Terms governing your use of the ChatEmbed platform.',
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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <SiteNav />

      <main className="max-w-2xl mx-auto px-6 pt-28 pb-24">
        {/* Header */}
        <div className="mb-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)] mb-3">
            Legal
          </p>
          <h1 className="text-4xl font-semibold tracking-tight mb-4">Terms of Service</h1>
          <p className="text-[13px] text-[var(--text-muted)]">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        <div className="h-px bg-[var(--border)] mb-10" />

        <p className="text-[14px] text-[var(--text-secondary)] leading-7 mb-10">
          These Terms of Service (&quot;Terms&quot;) govern your access to and use of the ChatEmbed platform, website, APIs, and embeddable widget (collectively, the &quot;Service&quot;). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.
        </p>

        <Section title="1. Eligibility">
          <p>
            You must be at least 18 years old and have the legal capacity to enter into a binding agreement to use ChatEmbed. If you are using the Service on behalf of a company or organization, you represent that you have authority to bind that entity to these Terms.
          </p>
        </Section>

        <Section title="2. Account Registration">
          <p>
            You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately at <a href="mailto:hello@chatembed.ai" className="text-[var(--accent-blue)] hover:underline">hello@chatembed.ai</a> if you suspect unauthorized access to your account.
          </p>
          <p>
            You may not share your account with other individuals or use automated means to create accounts. We reserve the right to suspend or terminate accounts that violate these restrictions.
          </p>
        </Section>

        <Section title="3. Acceptable Use">
          <p>You agree not to use ChatEmbed to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Crawl websites you do not own or have permission to crawl.</li>
            <li>Violate any applicable laws or regulations, including data protection laws.</li>
            <li>Generate or distribute content that is illegal, defamatory, harassing, or harmful.</li>
            <li>Attempt to reverse-engineer, scrape, or probe our infrastructure.</li>
            <li>Resell or sublicense the Service without our prior written consent.</li>
            <li>Use the Service to create chatbots that impersonate other people or organizations.</li>
            <li>Circumvent any rate limits, access controls, or security measures.</li>
          </ul>
          <p>
            We reserve the right to suspend or terminate your account immediately for violations of this section, without prior notice and without refund.
          </p>
        </Section>

        <Section title="4. Service Limits">
          <p>
            Each plan has associated limits on the number of chatbots, crawled pages, and chat messages (as displayed on our <a href="/#pricing" className="text-[var(--accent-blue)] hover:underline">Pricing</a> page). Exceeding these limits may result in queuing, throttling, or temporary suspension of the affected feature until the next billing cycle.
          </p>
          <p>
            We may modify plan limits at any time with 30 days&apos; notice for existing subscribers. Changes to limits will not take effect until the start of your next billing period.
          </p>
        </Section>

        <Section title="5. Intellectual Property">
          <p>
            <strong className="text-[var(--text)]">Your content:</strong> You retain all rights to the content crawled from your websites and any files you upload. By using the Service, you grant ChatEmbed a limited, non-exclusive license to index, embed, and use your content solely for the purpose of operating the chatbot Service for your account.
          </p>
          <p>
            <strong className="text-[var(--text)]">Our IP:</strong> All software, designs, trademarks, and documentation comprising the ChatEmbed platform are owned by or licensed to us. You may not copy, modify, or distribute our intellectual property without express written permission.
          </p>
        </Section>

        <Section title="6. Payment and Billing">
          <p>
            Paid plans are billed in advance on a monthly or annual basis via Stripe. All fees are in USD and are non-refundable except as required by applicable law or expressly stated in these Terms.
          </p>
          <p>
            If your payment fails, we will attempt to retry up to three times over seven days. If payment cannot be collected, your account will be downgraded to the free tier and data associated with paid features may be subject to deletion after 30 days.
          </p>
          <p>
            You may cancel your subscription at any time from <strong className="text-[var(--text)]">Settings → Billing</strong>. Cancellation takes effect at the end of the current billing period; you retain access to paid features until then.
          </p>
        </Section>

        <Section title="7. Disclaimer of Warranties">
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTY OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT AI-GENERATED RESPONSES WILL BE ACCURATE.
          </p>
        </Section>

        <Section title="8. Limitation of Liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, CHATEMBED AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF REVENUE, PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE.
          </p>
          <p>
            OUR TOTAL AGGREGATE LIABILITY FOR CLAIMS RELATED TO THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, OR (B) $100 USD.
          </p>
        </Section>

        <Section title="9. Indemnification">
          <p>
            You agree to indemnify, defend, and hold harmless ChatEmbed and its affiliates from and against any claims, damages, costs, and expenses (including reasonable legal fees) arising from your use of the Service, your content, or your violation of these Terms.
          </p>
        </Section>

        <Section title="10. Termination">
          <p>
            You may delete your account at any time from <strong className="text-[var(--text)]">Settings → Danger Zone</strong>. We may suspend or terminate your access if you violate these Terms, fail to pay, or if we discontinue the Service, with reasonable notice where practicable.
          </p>
          <p>
            Upon termination, your right to use the Service ceases immediately. Sections 5, 7, 8, 9, and 12 survive termination.
          </p>
        </Section>

        <Section title="11. Changes to These Terms">
          <p>
            We may update these Terms from time to time. We will provide at least 14 days&apos; notice before material changes take effect, via email or in-app notification. Continued use of the Service after the effective date constitutes acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="12. Governing Law">
          <p>
            These Terms are governed by the laws of the State of Delaware, USA, without regard to conflict of law principles. Any disputes shall be resolved in the state or federal courts located in Delaware, and you consent to the personal jurisdiction of such courts.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about these Terms? Contact us at:
          </p>
          <p>
            <a href="mailto:legal@chatembed.ai" className="text-[var(--accent-blue)] hover:underline">
              legal@chatembed.ai
            </a>
          </p>
        </Section>
      </main>

      <SiteFooter />
    </div>
  );
}
