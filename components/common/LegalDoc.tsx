import type { ReactNode } from "react";
import { Reveal } from "@/components/common/Reveal";
import { EYEBROW } from "@/components/common/PublicChrome";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * Editorial legal-document layout: a sticky, numbered "Contents" index on the
 * left (desktop) and generously-spaced, numbered sections on the right. Each
 * section is an anchor target (with sticky-header clearance) so the index links
 * scroll cleanly. Honours the shared gold-eyebrow / serif typography.
 */
export function LegalDoc({
  intro,
  sections,
  footnote,
}: {
  intro?: ReactNode;
  sections: LegalSection[];
  footnote?: ReactNode;
}) {
  const num = (i: number) => String(i + 1).padStart(2, "0");
  return (
    <div className="kh-shell-tight py-16 lg:py-24">
      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-16">
        {/* Contents index — sticky on desktop */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24">
            <div className={`${EYEBROW} mb-4`}>Contents</div>
            <ol className="space-y-2.5 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="group flex gap-2.5 text-foreground/55 hover:text-primary transition-colors"
                  >
                    <span className="tabular-nums text-gold/60 group-hover:text-gold transition-colors">
                      {num(i)}
                    </span>
                    <span>{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        {/* Document body */}
        <div className="max-w-2xl">
          {intro && (
            <Reveal as="p" className="text-lg leading-relaxed text-foreground/75 mb-12">
              {intro}
            </Reveal>
          )}
          <div className="space-y-12">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <Reveal>
                  <div className="flex items-baseline gap-3">
                    <span className="font-serif text-sm tabular-nums text-gold/70">{num(i)}</span>
                    <h2 className="font-serif text-xl sm:text-2xl">{s.title}</h2>
                  </div>
                  <div className="mt-3 text-[15px] leading-relaxed text-foreground/80">
                    {s.body}
                  </div>
                </Reveal>
              </section>
            ))}
          </div>
          {footnote && (
            <div className="mt-14 pt-8 border-t border-primary/10 space-y-4 text-sm text-muted-foreground">
              {footnote}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
