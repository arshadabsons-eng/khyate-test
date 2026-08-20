import { createFileRoute, Link } from "@tanstack/react-router";
import { IconMail, IconMapPin, IconClock, IconHeadset } from "@tabler/icons-react";
import { PublicShell, PageHero } from "@/components/common/PublicChrome";
import { Reveal } from "@/components/common/Reveal";

export const Route = createFileRoute("/contact")({ component: ContactPage });

const SUPPORT_EMAIL = "support@khyate.ae";

function ContactPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Get in touch"
        title="Contact us"
        subtitle="We're here to help — customers and tailors alike."
      />

      <div className="kh-shell py-16 sm:py-20 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: IconMail,
              title: "Email us",
              body: SUPPORT_EMAIL,
              href: `mailto:${SUPPORT_EMAIL}`,
            },
            { icon: IconMapPin, title: "Where we are", body: "Dubai, United Arab Emirates" },
            { icon: IconClock, title: "Support hours", body: "Sun–Thu, 9:00–18:00 (GST)" },
            {
              icon: IconHeadset,
              title: "In-app support",
              body: "Signed in? Reach support from your account.",
            },
          ].map((c, i) => (
            <Reveal key={c.title} delay={(i % 2) * 90}>
              <ContactCard icon={c.icon} title={c.title} body={c.body} href={c.href} />
            </Reveal>
          ))}
        </div>

        <Reveal className="rounded-2xl border border-ink/10 bg-card p-6 text-center max-w-3xl mx-auto">
          <IconHeadset size={28} className="mx-auto text-primary mb-2" />
          <h2 className="font-serif font-semibold">Have a question?</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Email our team and we'll get back to you within one business day. Tailors can also reach
            support directly from inside the app.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-6 py-3 font-medium mt-5 hover:bg-primary/90 transition-colors"
          >
            <IconMail size={18} /> Email {SUPPORT_EMAIL}
          </a>
          <p className="text-xs text-muted-foreground mt-4">
            Are you a tailor?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Set up your shop
            </Link>{" "}
            or{" "}
            <Link to="/login" className="text-primary hover:underline">
              sign in
            </Link>
            .
          </p>
        </Reveal>
      </div>
    </PublicShell>
  );
}

function ContactCard({
  icon: Icon,
  title,
  body,
  href,
}: {
  icon: typeof IconMail;
  title: string;
  body: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-2xl border border-ink/10 bg-card p-5 h-full kh-elevate">
      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center mb-3">
        <Icon size={20} />
      </div>
      <h3 className="font-serif font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 break-words">{body}</p>
    </div>
  );
  return href ? (
    <a href={href} className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}
