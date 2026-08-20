import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell, PageHero } from "@/components/common/PublicChrome";
import { LegalDoc, type LegalSection } from "@/components/common/LegalDoc";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

const SECTIONS: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are & scope",
    body: (
      <>
        <p>
          Khyate ("Khyate," "we," "us") operates a UAE-based marketplace connecting customers with
          independent tailors for ready-made garments, custom stitching, alterations, and fabric —
          via our mobile app and this website. This policy explains what personal data we collect
          across every part of the platform, why, how we protect it, who we share it with, and your
          rights under the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021,
          "PDPL").
        </p>
        <p className="mt-3">
          This policy applies to customers, tailors (and their listed business partners/owners), and
          anyone who contacts our support team — the data we collect differs by role, set out below.
        </p>
      </>
    ),
  },
  {
    id: "data-we-collect",
    title: "Data we collect",
    body: (
      <>
        <p className="font-medium text-foreground">Everyone</p>
        <ul className="list-disc pl-5 mt-1.5 space-y-1">
          <li>Account details: name, email, phone, password (stored as a salted hash, never in plain text).</li>
          <li>If you sign in with Google or Apple: the identity token they issue and the name/email they share with us.</li>
          <li>Device push-notification token, so we can send order/chat/delivery updates.</li>
          <li>Support messages, in-app chat, and dispute correspondence.</li>
        </ul>
        <p className="mt-4 font-medium text-foreground">Customers</p>
        <ul className="list-disc pl-5 mt-1.5 space-y-1">
          <li>Delivery addresses, and an approximate location pin only when you book a home measurement visit.</li>
          <li>Body measurements you or a tailor record, and any measurement photos/notes you choose to add.</li>
          <li>Order, payment and invoice history; saved payment methods (held by our payment processor, not us — see "Sharing" below).</li>
          <li>Reviews you write, wishlist/saved items, and cart contents.</li>
          <li>You may also check out as a guest with just an email and name — a guest account is never asked to set a password.</li>
        </ul>
        <p className="mt-4 font-medium text-foreground">Tailors</p>
        <ul className="list-disc pl-5 mt-1.5 space-y-1">
          <li>
            Business verification (KYC) documents: trade licence, tenancy/Ejari, bank/IBAN proof, VAT
            certificate, and — for each owner/partner — an Emirates ID and its stated expiry date.
            These are encrypted at rest and readable only by our verification team through an
            authenticated, watermarked, audit-logged viewer — never served as a public file.
          </li>
          <li>Business profile (name, address, logo, portfolio photos), listings, pricing, and subscription/billing history.</li>
          <li>Earnings, payout bank details, and commission records.</li>
        </ul>
      </>
    ),
  },
  {
    id: "why-we-use-it",
    title: "Why we use it",
    body: (
      <>
        <p>We use your data to:</p>
        <ul className="list-disc pl-5 mt-1.5 space-y-1">
          <li>Create and secure your account, and verify a tailor's business before they can sell.</li>
          <li>Take, price, and fulfil orders; arrange courier delivery and home measurement visits.</li>
          <li>Process payments and refunds, and issue tax invoices.</li>
          <li>Send order, chat, delivery and account notifications (push, email, SMS).</li>
          <li>Provide customer support and resolve disputes.</li>
          <li>Screen uploaded images and written content for policy violations (see "Automated content screening" below).</li>
          <li>Detect and prevent fraud, abuse, and platform-fee circumvention.</li>
          <li>Meet our legal, tax and regulatory obligations.</li>
        </ul>
        <p className="mt-3">
          A location pin captured for a home visit is used only as arrival evidence for that specific
          visit (so a tailor can confirm they reached the right address) — never for background or
          continuous tracking, and it is purged after the applicable dispute window (see "Retention").
        </p>
      </>
    ),
  },
  {
    id: "automated-screening",
    title: "Automated content screening",
    body: (
      <>
        <p>
          To keep the marketplace safe and modest, images you or a tailor upload are automatically
          screened by a third-party content-moderation service for nudity, offensive, or graphic
          content before they're flagged for human review. Written text (listings, chat, reviews,
          support messages) is checked against an automated filter for prohibited language and
          off-platform-payment circumvention attempts. Flagged content is reviewed by our moderation
          team, who may hide, remove, or request a resubmission — see our{" "}
          <Link className="text-primary hover:underline" to="/terms">
            Terms of Service
          </Link>{" "}
          for what's prohibited.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Sharing",
    body: (
      <>
        <p>We share only what's necessary to run the platform, and never sell your personal data:</p>
        <ul className="list-disc pl-5 mt-1.5 space-y-1">
          <li><span className="font-medium text-foreground">The tailor fulfilling your order</span> — your order details, delivery address, and any measurements needed for that order.</li>
          <li><span className="font-medium text-foreground">Payment processing</span> — Stripe processes your card details directly; we never see or store your full card number.</li>
          <li><span className="font-medium text-foreground">Delivery couriers</span> (e.g. Jeebly, Aramex) — the recipient name, address, and phone number needed to complete a delivery.</li>
          <li><span className="font-medium text-foreground">Communication providers</span> — our email and SMS providers, to deliver verification codes and notifications; Google/Apple, if you sign in with them; Firebase, for push notifications.</li>
          <li><span className="font-medium text-foreground">Content moderation & error-monitoring vendors</span> — solely to screen uploaded content and to help us detect and fix technical problems.</li>
          <li><span className="font-medium text-foreground">Authorities</span> — where legally required (e.g. tax authorities, law enforcement with a valid order, consumer-protection regulators).</li>
          <li>In connection with a merger, acquisition, or sale of assets — subject to the same protections in this policy.</li>
        </ul>
      </>
    ),
  },
  {
    id: "international-transfers",
    title: "International transfers",
    body: (
      <>
        Some of the service providers above (payment processing, push notifications, error monitoring,
        content screening) operate outside the UAE. Where we transfer personal data internationally,
        we rely on the safeguards those providers offer (such as standard contractual clauses) and
        only share what each provider genuinely needs to perform its function.
      </>
    ),
  },
  {
    id: "retention",
    title: "Retention",
    body: (
      <>
        <p>We keep data only as long as needed for the purpose it was collected:</p>
        <ul className="list-disc pl-5 mt-1.5 space-y-1">
          <li>Financial records and tax invoices: 5 years (UAE VAT law).</li>
          <li>Precise home-visit location evidence: purged after the applicable dispute window.</li>
          <li>Chat/message history: purged automatically after a configurable retention period once an order or support thread is closed.</li>
          <li>Customer measurement records: kept while useful for reordering, or purged on the tailor's own configured retention schedule for records they took.</li>
          <li>Tailor KYC documents: retained for the duration of the business relationship and any legally-required period afterward, then securely deleted.</li>
        </ul>
        <p className="mt-3">
          On account deletion, we remove your personal data and anonymise any records we're legally
          required to retain (e.g. completed transaction records for tax purposes) rather than keeping
          them identifiable to you.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>Under the PDPL, you have the right to:</p>
        <ul className="list-disc pl-5 mt-1.5 space-y-1">
          <li>Access the personal data we hold about you.</li>
          <li>Correct inaccurate or incomplete data.</li>
          <li>Request deletion of your data, subject to our legal retention obligations.</li>
          <li>Restrict or object to certain processing.</li>
          <li>Withdraw consent at any time, where processing is based on consent.</li>
          <li>Receive your data in a portable format, where technically feasible.</li>
        </ul>
        <p className="mt-3">
          You can delete your account and personal data directly in the app (Account → Delete
          account) at any time, or reach us at the contact below. We respond to verified requests
          within a reasonable time, consistent with the PDPL.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <>
        We encrypt data in transit (HTTPS) and hash passwords with industry-standard algorithms.
        Tailor KYC documents are encrypted at rest and readable only through an authenticated,
        watermarked, audit-logged internal tool — never a public URL. Access to customer and tailor
        data is restricted by role, every sensitive staff action is logged, and staff accounts
        supporting elevated access require two-factor authentication. No system is perfectly secure,
        but we apply layered, reasonable safeguards and continually review them.
      </>
    ),
  },
  {
    id: "marketing-notifications",
    title: "Notifications & marketing",
    body: (
      <>
        We send transactional notifications (order updates, chat messages, delivery status, account
        security) that are core to using the service and cannot be turned off while your account is
        active. Signing out of the app on a device stops further push notifications to that device.
      </>
    ),
  },
  {
    id: "cookies-storage",
    title: "Cookies & local storage",
    body: (
      <>
        Our website uses only the minimum local storage needed to keep you signed in and remember
        your preferences — no third-party advertising trackers. The mobile app stores your session
        and a local cache of recently-viewed content on your device for performance; this is cleared
        when you sign out.
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <>
        Khyate is intended for users who are at least 18 years old, or who are acting with the
        involvement of a parent or legal guardian. We do not knowingly collect personal data from
        children without appropriate parental/guardian involvement. If you believe a child has
        provided us personal data without such involvement, contact us and we will act promptly.
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <>
        We may update this policy as the platform evolves. We'll update the "Last updated" date
        below, and where a change is material we'll take reasonable steps to notify you (e.g. an
        in-app notice) before it takes effect.
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact & complaints",
    body: (
      <>
        Questions or requests about your data:{" "}
        <a className="text-primary hover:underline" href="mailto:support@khyate.ae">
          support@khyate.ae
        </a>
        . If you're not satisfied with our response, you may lodge a complaint with the UAE Data
        Office or the relevant free-zone data protection authority, or escalate a consumer-related
        concern to the UAE Ministry of Economy.
      </>
    ),
  },
];

function PrivacyPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Legal · Privacy"
        title="Privacy Policy"
        subtitle="How we collect, use and protect your personal data under the UAE Personal Data Protection Law."
      />
      <LegalDoc
        intro={
          <>
            We built Khyate to be trustworthy. In plain language, here is what personal data we
            hold, why we hold it, and the control you keep over it.{" "}
            <span className="text-muted-foreground">Last updated 13 August 2026.</span>
          </>
        }
        sections={SECTIONS}
        footnote={
          <p>
            <Link className="text-primary hover:underline" to="/terms">
              Read our Terms of Service →
            </Link>
          </p>
        }
      />
    </PublicShell>
  );
}
