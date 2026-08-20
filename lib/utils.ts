import type { SyntheticEvent } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Neutral gray square, inlined — for raw <img> tags outside BlurImage (which
// has its own IconHanger fallback). A present-but-dead URL (deleted from
// storage, bad CDN path) otherwise renders the browser's native broken-image
// icon. Swap the src once on error (onerror cleared first so a fallback that
// somehow also 404s can't loop).
export const IMG_FALLBACK_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23e5e5e5'/%3E%3C/svg%3E";

export function onImgError(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.onerror = null;
  e.currentTarget.src = IMG_FALLBACK_SRC;
}
