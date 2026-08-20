import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll-reveal wrapper: fades + lifts its content in the first time it enters
 * the viewport. Pure CSS animation (.kh-reveal / .is-visible); this component
 * only toggles the class via IntersectionObserver. Honours reduced motion via
 * the CSS guard. Falls back to visible if IntersectionObserver is unavailable.
 */
export function Reveal({
  children,
  as: Tag = "div",
  className,
  delay = 0,
  once = true,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  /** Stagger delay in ms */
  delay?: number;
  once?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            if (once) io.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  return (
    <Tag
      ref={ref}
      className={cn("kh-reveal", visible && "is-visible", className)}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
