import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandLockup } from "@/components/common/Logo";
import { Reveal } from "@/components/common/Reveal";
import { cn } from "@/lib/utils";

/** Gold eyebrow label — the editorial accent shared across the public surface. */
export const EYEBROW = "text-[11px] uppercase tracking-[0.22em] text-gold font-medium";

/**
 * Editorial hero band for public sub-pages (about, contact, legal). Mirrors the
 * landing aesthetic: ivory ground + faint kh-weave, a gold eyebrow, a large
 * serif headline, a hairline gold rule, and an optional subtitle.
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
}) {
  const centered = align === "center";
  return (
    <section className="kh-aurora relative overflow-hidden bg-ivory border-b border-primary/10">
      <div className="kh-weave absolute inset-0 opacity-40 pointer-events-none" />
      <div className={cn("kh-shell relative py-20 sm:py-28", centered && "text-center")}>
        <Reveal>
          <span className={cn(EYEBROW, "inline-block")}>{eyebrow}</span>
          <h1
            className={cn(
              "font-serif text-4xl sm:text-5xl lg:text-6xl mt-4 leading-[1.04] max-w-3xl",
              centered && "mx-auto",
            )}
          >
            {title}
          </h1>
          <div className={cn("mt-6 h-px w-12 bg-gold/40", centered && "mx-auto")} />
          {subtitle && (
            <p
              className={cn("kh-lead text-muted-foreground mt-6 max-w-2xl", centered && "mx-auto")}
            >
              {subtitle}
            </p>
          )}
        </Reveal>
      </div>
    </section>
  );
}

/** Shared top bar for the public (logged-out) pages: landing, about, contact. */
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-white/70 backdrop-blur-xl backdrop-saturate-150">
      <div className="kh-shell h-16 flex items-center justify-between gap-4">
        <Link to="/" className="shrink-0">
          <BrandLockup markSize={28} />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-sm">
          <Link
            to="/about"
            className="hidden sm:inline-block px-3 py-2 rounded-md hover:bg-muted transition-colors"
          >
            About
          </Link>
          <Link
            to="/contact"
            className="hidden sm:inline-block px-3 py-2 rounded-md hover:bg-muted transition-colors"
          >
            Contact
          </Link>
          <Link to="/login" className="px-3 py-2 rounded-md hover:bg-muted transition-colors">
            Sign in
          </Link>
          <Link
            to="/signup"
            className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}

/** Shared footer for the public pages. */
export function PublicFooter() {
  return (
    <footer className="border-t border-ink/10 mt-16 bg-muted/30">
      <div className="kh-shell py-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <BrandLockup markSize={26} />
          <p className="text-sm text-muted-foreground mt-3 max-w-xs">
            Bespoke tailoring, beautifully made — the UAE marketplace connecting you to verified
            tailors.
          </p>
        </div>
        <FooterCol
          title="Company"
          links={[
            ["About us", "/about"],
            ["Contact", "/contact"],
          ]}
        />
        <FooterCol
          title="Account"
          links={[
            ["Sign in", "/login"],
            ["Create account", "/signup"],
          ]}
        />
        <FooterCol
          title="Legal"
          links={[
            ["Privacy Policy", "/privacy"],
            ["Terms of Service", "/terms"],
          ]}
        />
      </div>
      <div className="border-t border-ink/10">
        <div className="kh-shell py-4 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© Khyate · Dubai, UAE</span>
          <span>Crafted with care for tailors and their customers.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
        {title}
      </div>
      <ul className="space-y-2 text-sm">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="text-foreground/80 hover:text-primary transition-colors">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Wraps public page content with header + footer. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
