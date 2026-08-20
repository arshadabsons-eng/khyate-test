import { createFileRoute, Link } from "@tanstack/react-router";
import {
  IconScissors,
  IconHeart,
  IconShieldCheck,
  IconSparkles,
  IconDeviceMobile,
  IconArrowRight,
} from "@tabler/icons-react";
import { PublicShell, PageHero, EYEBROW } from "@/components/common/PublicChrome";
import { Reveal } from "@/components/common/Reveal";
import { BrandMark } from "@/components/common/Logo";

export const Route = createFileRoute("/about")({ component: AboutPage });

const VALUES = [
  {
    icon: IconScissors,
    title: "Craftsmanship first",
    body: "We celebrate the artisans behind every stitch and help their work reach the people who'll love it.",
  },
  {
    icon: IconHeart,
    title: "Respect & modesty",
    body: "Our imagery and experience honour the culture we serve — elegant, modest and Arab-appropriate throughout.",
  },
  {
    icon: IconShieldCheck,
    title: "Trust & fairness",
    body: "Verified tailors, protected payments, and transparent, fair payouts — no surprises for anyone.",
  },
  {
    icon: IconSparkles,
    title: "Simplicity for tailors",
    body: "Many of our tailors aren't technical, so the app is built to be effortless — big buttons, clear steps, English and Arabic.",
  },
];

function AboutPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Our house"
        title="About Khyate"
        subtitle="Bespoke tailoring, beautifully made — connecting the UAE to its finest tailors."
      />

      <StorySection eyebrow="Our story" title="A modern home for an ancient craft">
        <p>
          Khyate (خياطي) was born from a simple belief: that the craft of bespoke tailoring deserves
          a modern home. Across the UAE, skilled tailors create exquisite kanduras, abayas, bishts
          and kaftans — yet customers often struggle to find them, and tailors struggle with the
          tools to grow.
        </p>
        <p>
          Khyate brings the two together in one elegant, trustworthy marketplace — where heritage is
          honoured and every maker can be discovered.
        </p>
      </StorySection>

      {/* What we stand for */}
      <section className="border-t border-primary/10 bg-muted/20">
        <div className="kh-shell py-16 sm:py-24">
          <Reveal className="text-center mb-12">
            <span className={EYEBROW}>What we stand for</span>
            <h2 className="font-serif text-3xl sm:text-4xl mt-3">Values woven into everything</h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={(i % 2) * 90}>
                <Value icon={v.icon} title={v.title} body={v.body} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <StorySection eyebrow="Built for the UAE" title="Designed around how we shop and tailor">
        <p>
          From Dubai to every emirate, Khyate is designed around how people here actually shop and
          tailor — home-visit measurements, made-to-measure orders, and a storefront each tailor can
          be proud of.
        </p>
        <p>We're just getting started.</p>
      </StorySection>

      {/* Closing CTA */}
      <section className="border-t border-primary/10 bg-primary-soft relative overflow-hidden">
        <div className="relative kh-shell py-20 sm:py-24 text-center">
          <Reveal>
            <span className={EYEBROW}>Join Khyate</span>
            <h2 className="font-serif text-3xl sm:text-4xl mt-3">Heritage, beautifully made</h2>
            <p className="text-foreground/70 mt-4 max-w-xl mx-auto leading-relaxed">
              Discover the makers shaping modern Emirati style — or bring your own tailor to Khyate.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/get-app"
                className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-8 py-3.5 text-sm font-medium tracking-wide hover:bg-primary/90 transition-colors"
              >
                <IconDeviceMobile size={18} /> Get the app
              </a>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-md border border-ink/20 px-8 py-3.5 text-sm font-medium tracking-wide hover:bg-background/60 transition-colors"
              >
                <IconScissors size={17} /> Join as a tailor <IconArrowRight size={16} />
              </Link>
            </div>
          </Reveal>
          <BrandMark
            size={170}
            plate={false}
            className="opacity-[0.06] absolute -right-6 -bottom-8 pointer-events-none hidden sm:block"
          />
        </div>
      </section>
    </PublicShell>
  );
}

function StorySection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-primary/10">
      <div className="kh-shell-tight py-16 sm:py-24 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <Reveal className="mb-6 lg:mb-0">
          <div className={EYEBROW}>{eyebrow}</div>
          <h2 className="font-serif text-2xl sm:text-3xl mt-2 leading-tight">{title}</h2>
        </Reveal>
        <Reveal delay={80} className="space-y-4 max-w-2xl text-foreground/80 leading-relaxed">
          {children}
        </Reveal>
      </div>
    </section>
  );
}

function Value({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof IconScissors;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-card p-6 h-full kh-elevate">
      <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary grid place-items-center mb-4">
        <Icon size={21} />
      </div>
      <h3 className="font-serif text-lg">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{body}</p>
    </div>
  );
}
