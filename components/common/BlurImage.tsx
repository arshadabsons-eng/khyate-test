import { useEffect, useRef, useState } from "react";
import { IconHanger } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/**
 * Progressive blur-up image (Medium/Airbnb-style): renders blurred, then
 * cross-fades to sharp once the image decodes. Place inside an overflow-hidden
 * container. Honours reduced motion via the .kh-blur-img CSS guard.
 */
export function BlurImage({
  src,
  alt = "",
  className,
  imgClassName,
  loading = "lazy",
}: {
  src?: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  // A present-but-dead URL (deleted from storage, bad CDN path) previously
  // rendered the browser's native broken-image icon instead of the same
  // hanger placeholder already used for the "no URL at all" case.
  const [errored, setErrored] = useState(false);

  // Cached images may already be complete before onLoad attaches.
  useEffect(() => {
    setErrored(false);
    if (ref.current?.complete && ref.current.naturalWidth > 0) setLoaded(true);
  }, [src]);

  if (!src || errored) {
    return (
      <div className={cn("bg-muted grid place-items-center text-muted-foreground", className)}>
        <IconHanger size={28} stroke={1.5} />
      </div>
    );
  }

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={loading}
      onLoad={() => setLoaded(true)}
      onError={() => setErrored(true)}
      className={cn(
        "kh-blur-img w-full h-full object-cover",
        loaded && "is-loaded",
        className,
        imgClassName,
      )}
    />
  );
}
