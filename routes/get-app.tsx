import { createFileRoute, Link } from "@tanstack/react-router";
import {
  IconDeviceMobile,
  IconBrandApple,
  IconBrandGooglePlay,
  IconRuler,
  IconTruck,
  IconShieldCheck,
} from "@tabler/icons-react";
import { PublicShell } from "@/components/common/PublicChrome";
import { Reveal } from "@/components/common/Reveal";
import { BrandMark } from "@/components/common/Logo";

export const Route = createFileRoute("/get-app")({ component: GetAppPage });

const EYEBROW = "text-[11px] uppercase tracking-[0.22em] text-gold font-medium";

function GetAppPage() {
  return (
    <PublicShell>
      <section className="kh-aurora relative overflow-hidden bg-ivory">
        <div className="kh-weave absolute inset-0 opacity-40 pointer-events-none" />
        <div className="kh-shell relative py-20 sm:py-28 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal className="max-w-xl">
            <span className={`${EYEBROW} inline-flex items-center gap-2`}>
              <IconDeviceMobile size={14} /> Khyate for customers
            </span>
            <h1 className="font-serif text-4xl sm:text-5xl mt-4 leading-[1.05]">
              Shopping happens in the app
            </h1>
            <p className="text-muted-foreground mt-5 max-w-md leading-relaxed">
              Browsing, ordering, measurements and tracking all live in the Khyate mobile app — a
              smoother experience built for your phone. The website is for our tailors and team.
            </p>
            <ul className="mt-7 space-y-3 text-sm">
              <Point icon={IconRuler} text="Save your measurements & reorder in a tap" />
              <Point icon={IconTruck} text="Track every order from confirmed to delivered" />
              <Point icon={IconShieldCheck} text="Protected payments, released after delivery" />
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
            <p className="text-muted-foreground text-xs mt-6">
              Are you a tailor?{" "}
              <Link to="/login" className="text-primary hover:underline">
                Sign in to your workspace
              </Link>
              .
            </p>
          </Reveal>
          <Reveal delay={120} className="hidden lg:flex justify-center">
            <div className="kh-float kh-glass w-60 h-[460px] rounded-[2.75rem] grid place-items-center shadow-[0_40px_90px_-30px_rgba(0,0,0,0.3)]">
              <BrandMark size={80} />
            </div>
          </Reveal>
        </div>
      </section>
    </PublicShell>
  );
}

function Point({ icon: Icon, text }: { icon: typeof IconRuler; text: string }) {
  return (
    <li className="flex items-center gap-3 text-foreground/80">
      <span className="w-7 h-7 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
        <Icon size={15} />
      </span>
      {text}
    </li>
  );
}
