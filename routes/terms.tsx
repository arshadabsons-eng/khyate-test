import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell, PageHero } from "@/components/common/PublicChrome";
import { LegalDoc, type LegalSection } from "@/components/common/LegalDoc";

export const Route = createFileRoute("/terms")({ component: TermsPage });

const SECTIONS: LegalSection[] = [
  {
    id: "acceptance",
    title: "Acceptance & who can use Khyate",
    body: (
      <>
        By creating an account, browsing as a guest, or placing an order, you agree to these Terms
        of Service and our{" "}
        <Link className="text-primary hover:underline" to="/privacy">
          Privacy Policy
        </Link>
        . You must be at least 18 years old, or acting with a parent/legal guardian's involvement, and
        able to form a binding contract under UAE law. If you're registering a tailor business, you
        confirm you're authorized to act on that business's behalf.
      </>
    ),
  },
  {
    id: "the-service",
    title: "The service",
    body: (
      <>
        <p>
          Khyate is a marketplace connecting customers with independent tailors for three kinds of
          service:
        </p>
        <ul className="list-disc pl-5 mt-1.5 space-y-1">
          <li><span className="font-medium text-foreground">Ready-made garments</span> — in-stock pieces, purchased as-is.</li>
          <li><span className="font-medium text-foreground">Custom stitching</span> — a garment made to your own measurements (self-entered, or taken at an in-shop or home visit).</li>
          <li><span className="font-medium text-foreground">Alterations</span> — a tailor adjusts a garment you already own, using the same measurement/appointment flow as custom stitching.</li>
        </ul>
        <p className="mt-3">
          Khyate facilitates discovery, ordering, measurement booking, payment, delivery coordination
          and support. Each tailor is an independent business responsible for the quality, fit, and
          timely fulfilment of what they offer — Khyate is not the manufacturer.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts",
    body: (
      <>
        <p>
          You must provide accurate information and keep your login credentials secure. One account
          per person; do not share your login. You're responsible for activity under your account
          until you report it compromised.
        </p>
        <p className="mt-3">
          You may check out as a guest with just an email and name for ready-made or fabric orders;
          we'll offer to save that as a full account afterward so your order history isn't lost. To
          place a first paid order on a full account, we require a verified email address — this is a
          quick one-time step, not a barrier to browsing or saving items.
        </p>
        <p className="mt-3">
          You may delete your account at any time in the app (Account → Delete account). If you have
          an open order or dispute, you'll be asked to resolve it first.
        </p>
      </>
    ),
  },
  {
    id: "tailor-verification",
    title: "Tailors: verification & obligations",
    body: (
      <>
        <p>
          Before a tailor can sell, we verify their trade licence, tenancy/Ejari, bank/IBAN proof, VAT
          registration (TRN), and each business owner/partner's Emirates ID — reviewed by our
          verification team, sometimes across multiple reviewers, before approval. A tailor whose
          documents lapse (e.g. an expired trade licence) may be automatically suspended until renewed.
        </p>
        <p className="mt-3">
          Tailors must: describe listings honestly and price them transparently (VAT-inclusive);
          fulfil orders within the timeframes they commit to; keep their subscription plan and any
          purchased promotional boosts in good standing; and comply with all applicable UAE trade,
          tax, and labour laws in their own business operations, which remain their sole
          responsibility.
        </p>
      </>
    ),
  },
  {
    id: "pricing-payment",
    title: "Pricing, VAT & payment",
    body: (
      <>
        Prices are shown inclusive of 5% UAE VAT before you confirm an order. Payment is processed
        securely by our third-party payment provider (Stripe) — Khyate never sees or stores your full
        card number. A tax invoice is issued for every order. Discount codes and promotions are
        subject to the terms shown at the time you apply them (validity window, minimum order,
        usage limits) and may be withdrawn or capped by Khyate at any time to prevent abuse.
      </>
    ),
  },
  {
    id: "measurements-visits",
    title: "Measurements & home visits",
    body: (
      <>
        For a custom-stitch order or alteration, you can enter your own saved measurements, or book
        an in-shop or home visit for the tailor to take them. Booking a measurement appointment is
        free. For a home visit, the tailor confirms arrival at your address (used only as evidence
        for that visit — see our Privacy Policy); you may request a tailor of a specific gender, and
        we honour gender-matched visits where available.
      </>
    ),
  },
  {
    id: "delivery",
    title: "Delivery",
    body: (
      <>
        Ready-made and fabric orders ship via our courier partners once the tailor marks the order
        ready; custom-stitch and alteration orders ship once production is complete. Delivery fees,
        where applicable, are shown before checkout. Tracking is available in the app once a courier
        job is booked.
      </>
    ),
  },
  {
    id: "cancellations-refunds",
    title: "Cancellations, refunds & disputes",
    body: (
      <>
        <p>
          You may cancel an order yourself, free of charge, while it's still pending or confirmed —
          before the tailor has committed real production time. Once an order moves into production,
          self-cancellation is no longer available and any issue is handled through our dispute
          process instead, so the tailor's completed work is fairly considered.
        </p>
        <p className="mt-3">
          If an item is defective, materially not as described, or wrong, you're entitled to a remedy
          (repair/redo, replacement, or refund) consistent with UAE Consumer Protection Law. Raise an
          issue in the app; our support team reviews the order evidence and resolves it, with an
          escalation path if you and the tailor can't agree.
        </p>
        <p className="mt-3">
          A payment is only released to the tailor once your order is confirmed delivered — if you
          never confirm and a reasonable window passes with no dispute raised, the order
          auto-completes so the tailor isn't left unpaid indefinitely for genuinely completed work;
          you can still raise a dispute afterward if something is wrong.
        </p>
      </>
    ),
  },
  {
    id: "reviews-content",
    title: "Reviews & content standards",
    body: (
      <>
        <p>
          Reviews must reflect a genuine experience with that order — no fake, incentivized, or
          retaliatory reviews. Do not post content that is obscene, harassing, hateful, infringing, or
          that attempts to route payment or contact off-platform to avoid marketplace fees.
        </p>
        <p className="mt-3">
          We use automated screening plus human moderation on uploaded images and written content
          (see our Privacy Policy); we may hide, remove, or request a resubmission of content that
          violates these standards, and may suspend accounts for repeated or serious violations. You
          can report content or another user directly in the app.
        </p>
      </>
    ),
  },
  {
    id: "intellectual-property",
    title: "Intellectual property",
    body: (
      <>
        Tailors retain ownership of the designs and photos they upload, and grant Khyate a licence to
        display them on the marketplace to promote their listings. Customers retain ownership of
        reviews and content they post, and grant Khyate a licence to display them alongside the
        relevant listing/tailor. The Khyate name, logo, and platform itself remain our property.
      </>
    ),
  },
  {
    id: "prohibited-conduct",
    title: "Prohibited conduct",
    body: (
      <>
        Do not: commit fraud or attempt to defraud another user or Khyate; harass, threaten, or abuse
        another user or our staff; upload inappropriate or infringing content; attempt to circumvent
        platform fees by arranging payment off-platform; scrape, reverse-engineer, or interfere with
        the platform's normal operation; or impersonate another person or business.
      </>
    ),
  },
  {
    id: "suspension-termination",
    title: "Suspension & termination",
    body: (
      <>
        We may suspend or terminate an account that violates these terms, poses a fraud/safety risk,
        or has lapsed required verification. If a tailor account is suspended, any order already
        delivered or completed is unaffected (the tailor keeps that payout); any order still in
        progress is cancelled and refunded to the customer. You may stop using Khyate and delete your
        account at any time, as described under "Accounts" above.
      </>
    ),
  },
  {
    id: "liability",
    title: "Disclaimers & liability",
    body: (
      <>
        Khyate provides the marketplace, payment processing, and support infrastructure, but is not
        the manufacturer or fitter of any garment — a tailor is solely responsible for the quality and
        fit of what they produce. The platform is provided "as is"; we don't guarantee it will be
        uninterrupted or error-free. To the extent permitted by law, our liability arising from your
        use of Khyate is limited to the value of the affected order. Nothing in these terms limits any
        right you have under mandatory UAE consumer protection law.
      </>
    ),
  },
  {
    id: "indemnification",
    title: "Indemnification",
    body: (
      <>
        You agree to indemnify and hold Khyate harmless from claims arising out of your breach of
        these terms, your misuse of the platform, or content you upload — except where the claim
        arises from Khyate's own breach or negligence.
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <>
        We may update these terms as the platform evolves. We'll update the "Last updated" date
        below, and where a change is material we'll take reasonable steps to notify you before it
        takes effect. Continuing to use Khyate after a change takes effect means you accept it.
      </>
    ),
  },
  {
    id: "governing-law",
    title: "Governing law & disputes",
    body: (
      <>
        These terms are governed by the laws of the United Arab Emirates. Disputes about the
        platform itself (as distinct from an order dispute, handled via our in-app process above) are
        subject to the exclusive jurisdiction of the competent UAE courts; consumers may also escalate
        an unresolved consumer-protection matter to the UAE Ministry of Economy.
      </>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <>
        Reach us any time at{" "}
        <a className="text-primary hover:underline" href="mailto:support@khyate.ae">
          support@khyate.ae
        </a>
        .
      </>
    ),
  },
];

function TermsPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Legal · Terms"
        title="Terms of Service"
        subtitle="The agreement between you and Khyate when you shop, sell, or book on our marketplace."
      />
      <LegalDoc
        intro={
          <>
            By creating an account or placing an order, you agree to these terms. We've kept them
            clear and organised by what you'll actually want to look up.{" "}
            <span className="text-muted-foreground">Last updated 13 August 2026.</span>
          </>
        }
        sections={SECTIONS}
        footnote={
          <p>
            <Link className="text-primary hover:underline" to="/privacy">
              Read our Privacy Policy →
            </Link>
          </p>
        }
      />
    </PublicShell>
  );
}
