import { useCallback, useEffect, useRef, useState } from "react";
import { IconChevronLeft, IconChevronRight, IconMaximize } from "@tabler/icons-react";
import { Lightbox } from "./ImageCarousel";
import { onImgError } from "@/lib/utils";

const INTERVAL_MS = 5000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Glassmorphism coverflow — a portfolio showcase where the centre photo sits
 * forward and neighbours fan back in 3D (rotateY + depth + scale + blur), each a
 * rounded glass card. Autoplays with a progress bar, supports drag/keyboard/arrows
 * and opens the shared Lightbox on click. Brand-refined (not neon): soft depth on
 * a light stage. Falls back to a clean fade when reduced-motion is requested.
 */
export function GlassCoverflow({
  images,
  className = "",
  heightClass,
}: {
  images: string[];
  className?: string;
  heightClass?: string;
}) {
  const n = images.length;
  const reduce = prefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const paused = useRef(false);
  const prog = useRef(0);
  const swipe = useRef({ x0: 0, active: false });

  const go = useCallback((next: number) => setIndex(((next % n) + n) % n), [n]);

  useEffect(() => {
    if (reduce || n <= 1 || lightbox !== null) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!paused.current) {
        prog.current += dt / INTERVAL_MS;
        if (prog.current >= 1) {
          prog.current = 0;
          setIndex((i) => (i + 1) % n);
        }
        setProgress(prog.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, n, lightbox]);

  useEffect(() => {
    prog.current = 0;
    setProgress(0);
  }, [index]);

  if (!n) return null;

  const h = heightClass ?? "h-[min(64vw,440px)] sm:h-[min(56vh,520px)] lg:h-[min(60vh,600px)]";

  // Shortest signed distance from the active slide (wraps around the ring).
  const offset = (i: number) => {
    let d = i - index;
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    return d;
  };

  return (
    <>
      {lightbox !== null && (
        <Lightbox images={images} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}

      <div
        className={`group relative mx-auto overflow-hidden rounded-2xl bg-gradient-to-b from-primary/[0.06] to-transparent select-none ${h} ${className}`}
        // Capped so the 74%-wide card and its 720px max-width coincide
        // (720 / 0.74 ≈ 973px) — on a much wider viewport than this, the
        // uncapped stage let the fixed-size card cluster sit dwarfed in the
        // middle of a full-width bar, exposing a wide strip of the stage's
        // background gradient on both sides instead of a filled coverflow.
        style={{ perspective: "1400px", maxWidth: 980 }}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        onMouseEnter={() => {
          paused.current = true;
        }}
        onMouseLeave={() => {
          paused.current = false;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(index - 1);
          else if (e.key === "ArrowRight") go(index + 1);
        }}
        onPointerDown={(e) => {
          swipe.current = { x0: e.clientX, active: true };
        }}
        onPointerUp={(e) => {
          if (!swipe.current.active) return;
          const dx = e.clientX - swipe.current.x0;
          swipe.current.active = false;
          if (Math.abs(dx) > 45) go(dx < 0 ? index + 1 : index - 1);
        }}
      >
        <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {images.map((src, i) => {
            const d = reduce ? (i === index ? 0 : 3) : offset(i);
            const ad = Math.abs(d);
            if (ad > 2.5) return null; // only render the visible fan
            const tx = d * 40;
            const rot = reduce ? 0 : -d * 30;
            const depth = reduce ? 0 : -ad * 150;
            const scale = 1 - Math.min(ad * 0.14, 0.4);
            const blur = reduce ? 0 : Math.min(ad * 1.8, 3);
            const isActive = d === 0;
            return (
              <figure
                key={src + i}
                className="absolute top-1/2 left-1/2 m-0 rounded-2xl overflow-hidden"
                style={{
                  width: "min(74%, 720px)",
                  height: "86%",
                  transform: `translate(-50%, -50%) translateX(${tx}%) translateZ(${depth}px) rotateY(${rot}deg) scale(${scale})`,
                  transition: reduce
                    ? "opacity 500ms ease"
                    : "transform 700ms cubic-bezier(0.2,0.7,0,1), filter 700ms cubic-bezier(0.2,0.7,0,1)",
                  filter: `blur(${blur}px)`,
                  opacity: reduce && !isActive ? 0 : 1,
                  zIndex: 100 - Math.round(ad * 10),
                  boxShadow: isActive
                    ? "0 30px 70px rgba(0,0,0,0.35)"
                    : "0 16px 40px rgba(0,0,0,0.28)",
                  cursor: isActive ? "zoom-in" : "pointer",
                }}
                onClick={() => (isActive ? setLightbox(index) : go(i))}
              >
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className="w-full h-full object-cover"
                  onError={onImgError}
                />
                {/* glass sheen + legibility */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(0,0,0,0.16), transparent 45%, rgba(0,0,0,0.30))",
                  }}
                />
                {/* frosted hairline frame */}
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none"
                  style={{ border: "1px solid rgba(255,255,255,0.16)" }}
                />
              </figure>
            );
          })}
        </div>

        {/* Expand active → lightbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(index);
          }}
          className="absolute top-3 right-3 z-[200] w-9 h-9 rounded-full flex items-center justify-center text-white bg-black/35 backdrop-blur-sm border border-white/15 opacity-80 hover:opacity-100 transition-opacity"
          aria-label="View full size"
        >
          <IconMaximize size={15} />
        </button>

        {/* Prev / next (web) */}
        {n > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(index - 1);
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-[200] w-10 h-10 rounded-full flex items-center justify-center text-white bg-black/30 backdrop-blur-sm border border-white/15 hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
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
              className="absolute right-3 top-1/2 -translate-y-1/2 z-[200] w-10 h-10 rounded-full flex items-center justify-center text-white bg-black/30 backdrop-blur-sm border border-white/15 hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              aria-label="Next image"
            >
              <IconChevronRight size={20} />
            </button>
          </>
        )}

        {/* Dots */}
        {n > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[200] flex gap-2">
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
                  background: i === index ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        )}

        {/* Autoplay progress */}
        {!reduce && n > 1 && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/15 z-[200]">
            <div
              className="h-full origin-left bg-primary/80"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
        )}
      </div>
    </>
  );
}
