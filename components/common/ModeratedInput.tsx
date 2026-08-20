import { forwardRef, useRef, useImperativeHandle, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { findFlaggedSpans } from "@/lib/textModeration";

/** Single-line sibling of ModeratedTextarea — same transparent-overlay
 *  technique (see that file's comment for the full explanation), sized for
 *  a compact `<input>` (title fields, reply bars) instead of a multi-line
 *  `<textarea>`. */
export const ModeratedInput = forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & { onFlaggedChange?: (flagged: boolean) => void }
>(({ className, value, onChange, onScroll, onFlaggedChange, ...props }, ref) => {
  const innerRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

  const text = typeof value === "string" ? value : "";
  const [spans, setSpans] = useState(() => findFlaggedSpans(text));

  useEffect(() => {
    const next = findFlaggedSpans(text);
    setSpans(next);
    onFlaggedChange?.(next.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const syncScroll = () => {
    if (mirrorRef.current && innerRef.current) {
      mirrorRef.current.scrollLeft = innerRef.current.scrollLeft;
    }
  };

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  spans.forEach((s, i) => {
    if (s.start > cursor) parts.push(text.slice(cursor, s.start));
    parts.push(
      <span
        key={i}
        style={{
          textDecorationLine: "underline",
          textDecorationStyle: "wavy",
          textDecorationColor: "#dc2626",
          textDecorationThickness: "2px",
          textUnderlineOffset: "3px",
        }}
      >
        {text.slice(s.start, s.end)}
      </span>,
    );
    cursor = s.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));

  const flagged = spans.length > 0;

  return (
    <div className="relative">
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre rounded-md border border-transparent px-3 py-2 text-base text-transparent md:text-sm",
          className,
        )}
      >
        {parts}
      </div>
      <input
        ref={innerRef}
        value={value}
        onChange={onChange}
        onScroll={(e) => {
          syncScroll();
          onScroll?.(e);
        }}
        onInput={syncScroll}
        className={cn(
          "relative flex h-10 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          flagged ? "border-destructive focus-visible:ring-destructive" : "border-input",
          className,
        )}
        {...props}
      />
    </div>
  );
});
ModeratedInput.displayName = "ModeratedInput";
