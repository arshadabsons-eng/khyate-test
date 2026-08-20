import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  IconArrowRight,
  IconRosetteDiscountCheckFilled,
  IconMapPin,
  IconScissors,
  IconRuler,
  IconTruck,
  IconShieldCheck,
  IconHanger,
  IconDeviceMobile,
  IconBrandApple,
  IconBrandGooglePlay,
} from "@tabler/icons-react";
import { auth } from "@/lib/auth";
import { apiClient } from "@/lib/api/client";
import { PublicShell, EYEBROW } from "@/components/common/PublicChrome";
import { useBrowseTailors } from "@/lib/api/queries/shop";
import { Stars } from "@/components/common/Stars";
import { Reveal } from "@/components/common/Reveal";
import { BlurImage } from "@/components/common/BlurImage";
import { BrandMark } from "@/components/common/Logo";
import { Money } from "@/components/common/Money";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    if (auth.isAuthed()) throw redirect({ to: auth.homePath() });
  },
  component: Landing,
});

type EditListing = {
  id: string;
  title: string;
  type: string;
  base_price_fils: number;
  stitch_price_fils?: number | null;
  image_urls?: string[];
  tailor_name?: string;
};

/**
 * Show only COMPLETE rows. Round the count down to a multiple of `per` (capped)
 * so the grid is always evenly filled — 4, 8, 12 — never a lonely orphan card.
 * Below one full row, render all items in a single full row (columns adapt).
 */
function evenCount(n: number, per = 4, cap = 8) {
  return n >= per ? Math.min(cap, Math.floor(n / per) * per) : n;
}
const PIECE_COLS: Record<number, string> = {
  1: "grid-cols-1 max-w-xs mx-auto",
  2: "grid-cols-2 max-w-2xl mx-auto",
  3: "grid-cols-2 sm:grid-cols-3 max-w-4xl mx-auto",
  4: "grid-cols-2 md:grid-cols-4",
};
const TAILOR_COLS: Record<number, string> = {
  1: "grid-cols-1 max-w-sm mx-auto",
  2: "grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto",
  3: "grid-cols-1 sm:grid-cols-3 max-w-5xl mx-auto",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};
const colsFor = (map: Record<number, string>, n: number) => map[Math.min(Math.max(n, 1), 4)];

function Landing() {
  const tailors = useBrowseTailors();
  const rawTailors = tailors.data ?? [];
  const featured = rawTailors.slice(0, evenCount(rawTailors.length, 4, 8));

  const edit = useQuery({
    queryKey: ["landing", "edit"],
    queryFn: ({ signal }) =>
      apiClient.get<EditListing[]>("/listings", { params: { limit: 24 }, signal }),
    staleTime: 60_000,
  });
  const rawPieces = (edit.data ?? []).filter((l) => l.image_urls?.[0]);
  const pieces = rawPieces.slice(0, evenCount(rawPieces.length, 4, 8));

  return (
    <PublicShell>
      {/* ── Hero — immersive, fluid, fills the screen ── */}
      <section className="kh-aurora relative overflow-hidden bg-ivory">
        <div className="kh-weave absolute inset-0 opacity-40 pointer-events-none" />
        <div className="kh-shell relative min-h-[88vh] flex flex-col items-center justify-center text-center py-24 sm:py-28">
          <Reveal as="span" className="mb-7">
            <span className="kh-glass inline-flex items-center rounded-full px-4 py-1.5">
              <span className={EYEBROW}>UAE · Bespoke tailoring</span>
            </span>
          </Reveal>
          <Reveal as="h1" delay={60} className="font-serif kh-display max-w-[15ch] mx-auto">
            Where Emirati heritage meets modern elegance
          </Reveal>
          <Reveal delay={110} className="mt-8 flex justify-center">
            <span className="h-px w-14 bg-gold/50" />
          </Reveal>
          <Reveal
            as="p"
            delay={150}
            className="kh-lead text-muted-foreground mt-7 max-w-2xl mx-auto"
          >
            A curated marketplace for made-to-measure kanduras, abayas, bishts and kaftans. Shoppers
            order on the app; tailors grow their craft with Khyate.
          </Reveal>
          <Reveal delay={210} className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/get-app"
              className="kh-sheen inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-8 py-4 text-sm font-medium tracking-wide hover:bg-primary/90 transition-colors"
            >
              <IconDeviceMobile size={18} /> Get the app
            </a>
            <Link
              to="/signup"
              className="kh-glass inline-flex items-center gap-2 rounded-full px-8 py-4 text-sm font-medium tracking-wide text-foreground hover:bg-white/70 transition-colors"
            >
              <IconScissors size={17} /> Join as a tailor
            </Link>
          </Reveal>
          <Reveal delay={280} className="mt-14 w-full max-w-2xl mx-auto">
            <div className="kh-glass rounded-2xl px-4 py-4 grid grid-cols-3 divide-x divide-ink/10">
              <Trust icon={IconRosetteDiscountCheckFilled} label="Verified tailors" />
              <Trust icon={IconShieldCheck} label="Protected payments" />
              <Trust icon={IconRuler} label="Made-to-measure" />
            </div>
          </Reveal>
          <Reveal delay={340} className="mt-10">
            <a
              href="#tailors"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Explore featured tailors ↓
            </a>
          </Reveal>
        </div>
      </section>

      {/* ── The Edit — the tailors' products, front and centre ── */}
      {pieces.length > 0 && (
        <section className="border-t border-primary/10 bg-background">
          <div className="kh-shell-wide py-20 sm:py-28">
            <Reveal className="text-center mb-12 sm:mb-16">
              <span className={EYEBROW}>The Edit</span>
              <h2 className="font-serif text-3xl sm:text-5xl mt-3">Pieces from our tailors</h2>
              <p className="text-muted-foreground mt-3 max-w-md mx-auto">
                A curated selection of the latest work — discover it here, order in the app.
              </p>
            </Reveal>
            <div
              className={`grid ${colsFor(PIECE_COLS, pieces.length)} gap-x-5 gap-y-10 sm:gap-x-8`}
            >
              {pieces.map((l, i) => (
                <Reveal key={l.id} delay={(i % 4) * 70}>
                  <Link to="/listing/$id" params={{ id: l.id }} className="group block">
                    <div className="aspect-[3/4] overflow-hidden bg-muted">
                      <BlurImage
                        src={l.image_urls?.[0]}
                        imgClassName="transition-transform duration-[900ms] ease-out group-hover:scale-[1.06]"
                      />
                    </div>
                    <div className="mt-4 text-center">
                      <div className="font-serif text-lg leading-tight group-hover:text-primary transition-colors">
                        {l.title}
                      </div>
                      {l.tailor_name && (
                        <div className="text-xs text-muted-foreground mt-0.5">{l.tailor_name}</div>
                      )}
                      <div className="text-sm text-primary mt-1.5">
                        <Money fils={l.base_price_fils} />
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
            <div className="text-center mt-14">
              <a
                href="/get-app"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:gap-3 transition-all"
              >
                Browse the full collection in the app <IconArrowRight size={16} />
              </a>
            </div>
          </div>
        </section>
      )}

      {/* ── Featured tailors ── */}
      <section id="tailors" className="border-t border-primary/10 bg-muted/20 scroll-mt-20">
        <div className="kh-shell-wide py-20 sm:py-28">
          <Reveal className="text-center mb-12 sm:mb-16">
            <span className={EYEBROW}>Featured tailors</span>
            <h2 className="font-serif text-3xl sm:text-5xl mt-3">The makers</h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto">
              Verified UAE tailors, ready to craft your next piece.
            </p>
          </Reveal>
          {featured.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card border overflow-hidden">
                  <div className="h-40 kh-shimmer" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-2/3 kh-shimmer rounded" />
                    <div className="h-3 w-1/3 kh-shimmer rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`grid ${colsFor(TAILOR_COLS, featured.length)} gap-6`}>
              {featured.map((t, i) => {
                const rating = Number(t.rating_avg ?? 0);
                return (
                  <Reveal key={t.id} delay={(i % 4) * 80}>
                    <Link
                      to="/store/$tailorId"
                      params={{ tailorId: t.id }}
                      className="group block bg-card border overflow-hidden h-full kh-elevate"
                    >
                      <div className="relative h-44 overflow-hidden bg-primary/5">
                        {t.banner_image_url ? (
                          <BlurImage
                            src={t.banner_image_url}
                            imgClassName="transition-transform duration-700 group-hover:scale-[1.06]"
                          />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-primary/25">
                            <IconHanger size={30} />
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-serif text-lg truncate">{t.business_name}</h3>
                          {t.verified && (
                            <IconRosetteDiscountCheckFilled
                              size={15}
                              className="text-primary shrink-0"
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
                          {rating > 0 && <Stars rating={rating} size={12} />}
                          <span className="flex items-center gap-0.5">
                            <IconMapPin size={11} /> {t.city}
                          </span>
                        </div>
                      </div>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── How it works — minimal ── */}
      <section className="border-t border-primary/10">
        <div className="kh-shell py-20 sm:py-28">
          <Reveal className="text-center mb-14">
            <span className={EYEBROW}>How it works</span>
            <h2 className="font-serif text-3xl sm:text-4xl mt-3">From inspiration to your door</h2>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-10 sm:gap-12 max-w-5xl mx-auto">
            {[
              {
                n: "01",
                icon: IconScissors,
                title: "Choose your tailor",
                body: "Browse verified tailors, their portfolios and reviews — find the craft that speaks to you.",
              },
              {
                n: "02",
                icon: IconRuler,
                title: "Order made-to-measure",
                body: "Save your measurements once, or book a home visit. Pick fabric, colour and details.",
              },
              {
                n: "03",
                icon: IconTruck,
                title: "Track & receive",
                body: "Follow every stitch. Pay securely — funds release only once you're delighted.",
              },
            ].map((s, i) => (
              <Reveal key={s.title} delay={i * 90} className="text-center">
                <div className="text-gold font-serif text-2xl">{s.n}</div>
                <s.icon size={24} className="text-primary mx-auto my-3" />
                <h3 className="font-serif text-xl">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
                  {s.body}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Get the app — clean, light, glass mockup ── */}
      <section className="border-t border-primary/10 bg-ivory">
        <div className="kh-shell py-20 sm:py-28 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal className="max-w-xl">
            <span className={EYEBROW}>Khyate for customers</span>
            <h2 className="font-serif text-3xl sm:text-5xl mt-3 leading-tight">
              Shopping happens in the app
            </h2>
            <p className="text-muted-foreground mt-4 max-w-md leading-relaxed">
              Browse tailors, order made-to-measure, save your measurements and track every stitch —
              a smoother experience built for your phone.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <AppPoint icon={IconRuler} text="Save your measurements & reorder in a tap" />
              <AppPoint icon={IconTruck} text="Track every order from confirmed to delivered" />
              <AppPoint icon={IconShieldCheck} text="Protected payments, released after delivery" />
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              {/* Store badges go live at app launch — until then these are
                  deliberately inert and styled as such (muted, no hover,
                  aria-disabled), so they can't read as broken buttons. */}
              <span
                aria-disabled="true"
                title="The app is launching on the App Store soon"
                className="inline-flex items-center gap-2 rounded-md border border-primary/15 text-foreground/50 px-5 py-3 text-sm font-medium cursor-default select-none"
              >
                <IconBrandApple size={20} /> App Store — coming soon
              </span>
              <span
                aria-disabled="true"
                title="The app is launching on Google Play soon"
                className="inline-flex items-center gap-2 rounded-md border border-primary/15 text-foreground/50 px-5 py-3 text-sm font-medium cursor-default select-none"
              >
                <IconBrandGooglePlay size={18} /> Google Play — coming soon
              </span>
            </div>
          </Reveal>
          <Reveal delay={120} className="hidden lg:flex justify-center">
            <div className="kh-float kh-glass w-60 h-[460px] rounded-[2.75rem] grid place-items-center shadow-[0_40px_90px_-30px_rgba(0,0,0,0.3)]">
              <BrandMark size={80} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── For tailors — clean soft tint ── */}
      <section className="border-t border-primary/10 bg-primary-soft relative overflow-hidden">
        <div className="kh-shell py-20 sm:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <Reveal className="max-w-xl">
            <span className={EYEBROW}>For tailors</span>
            <h2 className="font-serif text-3xl sm:text-5xl mt-3 leading-tight">
              Grow your business — we keep it simple
            </h2>
            <p className="text-foreground/70 mt-4 max-w-md leading-relaxed">
              List your work, take orders, manage measurements and get paid — in a workspace
              designed to be effortless, in English and Arabic.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <AppPoint
                icon={IconScissors}
                text="Your own storefront with a featured photo gallery"
              />
              <AppPoint
                icon={IconRuler}
                text="Appointments, measurements and orders in one place"
              />
              <AppPoint icon={IconShieldCheck} text="Fair, transparent payouts" />
            </ul>
            <Link
              to="/signup"
              className="kh-sheen inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-8 py-4 font-medium mt-8 hover:bg-primary/90 transition-colors"
            >
              Join as a tailor <IconArrowRight size={18} />
            </Link>
          </Reveal>
          <div className="hidden lg:flex justify-center">
            <BrandMark size={200} plate={false} className="opacity-[0.07]" />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function Trust({ icon: Icon, label }: { icon: typeof IconRuler; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-2 text-foreground/75">
      <Icon size={16} className="text-primary shrink-0" />
      <span className="text-xs sm:text-sm">{label}</span>
    </div>
  );
}

function AppPoint({ icon: Icon, text }: { icon: typeof IconRuler; text: string }) {
  return (
    <li className="flex items-center gap-3 text-foreground/80">
      <span className="w-7 h-7 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
        <Icon size={15} />
      </span>
      {text}
    </li>
  );
}
