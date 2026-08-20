import { useLayoutEffect, useRef, useState, type ComponentType } from "react";

export type LiquidTab = {
  id: string;
  label: string;
  icon?: ComponentType<{ size?: number }>;
};

/**
 * Tab bar with a subtle "liquid" indicator: a soft brand-green pill and a thin
 * underline that spring-slide to the active tab. The gentle overshoot easing is
 * what gives the fluid feel — kept understated so it reads as polish, not flair.
 * Measures real button geometry (refs + ResizeObserver) so it stays correct on
 * resize, font swap and wrapping.
 */
export function LiquidTabs({
  tabs,
  value,
  onChange,
  className = "",
}: {
  tabs: readonly LiquidTab[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ind, setInd] = useState<{ left: number; width: number; ready: boolean }>({
    left: 0,
    width: 0,
    ready: false,
  });

  useLayoutEffect(() => {
    const el = btnRefs.current[value];
    const list = listRef.current;
    if (!el || !list) return;
    const move = () => setInd({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
    move();
    const ro = new ResizeObserver(move);
    ro.observe(list);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, tabs]);

  // Spring-ish curve (slight overshoot) = the "liquid" slide. No transition until
  // first measured, so the indicator doesn't fly in from the left on mount.
  const slide = ind.ready
    ? "left 0.5s cubic-bezier(0.34, 1.4, 0.5, 1), width 0.5s cubic-bezier(0.34, 1.4, 0.5, 1)"
    : "none";

  return (
    <div className={`border-b ${className}`}>
      <div ref={listRef} className="relative flex gap-1 overflow-x-auto" role="tablist">
        {/* soft pill */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-1 bottom-1 rounded-md bg-primary/[0.07]"
          style={{
            left: ind.left,
            width: ind.width,
            transition: slide,
            opacity: ind.ready ? 1 : 0,
          }}
        />
        {/* underline accent */}
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary"
          style={{
            left: ind.left,
            width: ind.width,
            transition: slide,
            opacity: ind.ready ? 1 : 0,
          }}
        />
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = value === t.id;
          return (
            <button
              key={t.id}
              ref={(n) => {
                btnRefs.current[t.id] = n;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={t.label}
              onClick={() => onChange(t.id)}
              className={`relative z-10 px-4 py-2.5 text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors duration-200 ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {Icon && <Icon size={16} />} {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
