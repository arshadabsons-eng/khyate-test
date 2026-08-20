import { useState, useRef, useCallback, useEffect } from "react";
import { IconChevronLeft, IconChevronRight, IconX, IconMaximize } from "@tabler/icons-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  images: string[];
  /** hero = large gallery; compact = shorter. Both are clean full-bleed crossfades. */
  variant?: "hero" | "compact";
  autoPlay?: boolean;
  /** Shown bottom-left on the active slide */
  caption?: string;
  className?: string;
  /** Override the responsive hero height (Tailwind classes). Ignored for compact. */
  heightClass?: string;
}

const INTERVAL_MS = 5000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// ── Lightbox gallery ────────────────────────────────────────────────────────
// Full-screen viewer: blurred scrim, zoom-blur crossfade, keyboard + swipe nav,
// thumbnail strip.

export function Lightbox({
  images,
  startIndex,
  onClose,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(startIndex);
  const n = images.length;
  const swipe = useRef({ x0: 0, active: false });

  const go = useCallback((next: number) => setI(((next % n) + n) % n), [n]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [i, go, onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-ink/90 backdrop-blur-md"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        aria-label="Close"
      >
        <IconX size={20} />
      </button>

      <div
        className="relative flex-1 w-full flex items-center justify-center px-4"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => {
          swipe.current = { x0: e.clientX, active: true };
        }}
        onPointerUp={(e) => {
          if (!swipe.current.active) return;
          const dx = e.clientX - swipe.current.x0;
          swipe.current.active = false;
          if (Math.abs(dx) > 50) go(dx < 0 ? i + 1 : i - 1);
        }}
      >
        <img
          key={images[i] + i}
          src={images[i]}
          alt=""
          draggable={false}
          className="kh-zoom-blur-in max-h-[80vh] max-w-[94vw] rounded-xl object-contain shadow-2xl"
        />

        {n > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(i - 1);
              }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white transition-colors"
              aria-label="Previous image"
            >
              <IconChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(i + 1);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white transition-colors"
              aria-label="Next image"
            >
              <IconChevronRight size={22} />
            </button>
          </>
        )}
      </div>

      {n > 1 && (
        <div
          className="flex gap-2 px-4 py-4 overflow-x-auto max-w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((src, idx) => (
            <button
              key={src + idx}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`View image ${idx + 1}`}
              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                idx === i
                  ? "border-white scale-105"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component — clean full-bleed crossfade slideshow ──────────────────────

export function ImageCarousel({
  images,
  variant = "hero",
  autoPlay = true,
  caption,
  className = "",
  heightClass,
}: Props) {
  const n = images.length;
  const reduce = prefersReducedMotion();
  const allowAuto = autoPlay && !reduce && n > 1;
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  const swipe = useRef({ x0: 0, active: false });
  const pausedRef = useRef(false);
  const progressRef = useRef(0);

  const go = useCallback((next: number) => setIndex(((next % n) + n) % n), [n]);

  // Autoplay (RAF — smooth progress bar; pauses on hover / lightbox).
  useEffect(() => {
    if (!allowAuto || lightbox !== null) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current) {
        progressRef.current += dt / INTERVAL_MS;
        if (progressRef.current >= 1) {
          progressRef.current = 0;
          setIndex((i) => (i + 1) % n);
        }
        setProgress(progressRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [allowAuto, n, lightbox]);

  // Reset the autoplay timer whenever the slide changes (incl. manual nav).
  useEffect(() => {
    progressRef.current = 0;
    setProgress(0);
  }, [index]);

  if (!images.length) return null;

  const isHero = variant === "hero";
  const defaultHeroHeight =
    "h-[min(62vw,440px)] sm:h-[min(60vh,560px)] lg:h-[min(66vh,680px)] xl:h-[min(68vh,760px)] 2xl:h-[min(70vh,860px)]";
  const heroHeight = heightClass ?? (isHero ? defaultHeroHeight : "h-64 sm:h-72");

  return (
    <>
      {lightbox !== null && (
        <Lightbox images={images} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}

      <div
        className={`group relative overflow-hidden select-none bg-ink ${heroHeight} ${className}`}
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          pausedRef.current = false;
        }}
        onPointerDown={(e) => {
          swipe.current = { x0: e.clientX, active: true };
        }}
        onPointerUp={(e) => {
          if (!swipe.current.active) return;
          const dx = e.clientX - swipe.current.x0;
          swipe.current.active = false;
          if (Math.abs(dx) > 40) go(dx < 0 ? index + 1 : index - 1);
        }}
      >
        {/* Stacked full-bleed images — crossfade between them (no gaps, no grey). */}
        {images.map((src, i) => (
          <img
            key={src + i}
            src={src}
            alt=""
            draggable={false}
            loading={i === 0 ? "eager" : "lazy"}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out"
            style={{ opacity: i === index ? 1 : 0 }}
          />
        ))}

        {/* Legibility scrim — only where controls/caption sit */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10 pointer-events-none" />

        {/* Expand to lightbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(index);
          }}
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center text-white bg-black/35 backdrop-blur-sm border border-white/15 opacity-80 hover:opacity-100 transition-opacity"
          aria-label="View full size"
        >
          <IconMaximize size={15} />
        </button>

        {/* Prev / next */}
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(index - 1);
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center text-white bg-black/30 backdrop-blur-sm border border-white/15 hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label="Previous image"
            >
              <IconChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(index + 1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center text-white bg-black/30 backdrop-blur-sm border border-white/15 hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label="Next image"
            >
              <IconChevronRight size={20} />
            </button>
          </>
        )}

        {/* Caption */}
        {caption && (
          <div className="absolute bottom-4 left-4 right-4 z-10 rounded-xl px-4 py-3 text-sm text-white border border-white/10 bg-black/40 backdrop-blur-sm">
            {caption}
          </div>
        )}

        {/* Dots */}
        {n > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  go(i);
                }}
                aria-label={`Go to image ${i + 1}`}
                className="rounded-full transition-all"
                style={{
                  width: i === index ? 22 : 8,
                  height: 8,
                  background: i === index ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)",
                }}
              />
            ))}
          </div>
        )}

        {/* Autoplay progress */}
        {allowAuto && n > 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/15 z-20">
            <div
              className="h-full origin-left bg-white/80"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
        )}
      </div>
    </>
  );
}
