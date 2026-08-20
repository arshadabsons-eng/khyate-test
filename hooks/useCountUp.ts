import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates from 0 to `target` over `duration`ms when the value first mounts or changes.
 * Returns the current animated integer value as a string (formatted with toLocaleString).
 */
export function useCountUp(rawValue: string | number, duration = 900): string {
  const numeric =
    typeof rawValue === "number" ? rawValue : parseFloat(String(rawValue).replace(/[^0-9.]/g, ""));
  const isNumeric = !isNaN(numeric) && isFinite(numeric);

  const [display, setDisplay] = useState<string>(String(rawValue));
  const raf = useRef<number>(0);
  const prevTarget = useRef<number | null>(null);

  useEffect(() => {
    if (!isNumeric || numeric === prevTarget.current) return;
    prevTarget.current = numeric;

    const prefix = String(rawValue).match(/^[^0-9]*/)?.[0] ?? "";
    const suffix = String(rawValue).match(/[^0-9.]*$/)?.[0] ?? "";

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = Math.round(eased * numeric);
      setDisplay(`${prefix}${current.toLocaleString()}${suffix}`);
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      } else {
        setDisplay(String(rawValue));
      }
    };

    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [rawValue, numeric, isNumeric, duration]);

  return isNumeric ? display : String(rawValue);
}
