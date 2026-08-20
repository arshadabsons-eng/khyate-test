import { forwardRef, useRef, useState, useEffect, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";
import { findFlaggedSpans, MODERATION_MESSAGE, CIRCUMVENTION_MESSAGE, type FlaggedSpan } from "@/lib/textModeration";

/**
 * A drop-in replacement for <Textarea> that underlines a banned word in red,
 * live, as it's typed — before the field is ever submitted. The server-side
 * check (findBannedWord in every relevant route) is the real, authoritative
 * gate; this is the front-run that turns "reject this after I hit Save" into
 * "see it happening while I type," the same way a spellchecker does.
 *
 * Implementation: a transparent-background <textarea> (real, focusable,
 * typeable — untouched editing behavior) sits on top of a same-metrics
 * mirror <div> underneath it. The mirror renders the identical text with
 * every character's fill colour set to transparent EXCEPT a red wavy
 * text-decoration on the flagged spans — text-decoration-color is
 * independent of text colour, so the underline shows through the invisible
 * mirror text, in exactly the right place under the real (visible) text
 * typed into the textarea above it. Font/padding/line-height are kept
 * pixel-identical between the two layers, and scroll position is synced, so
 * long text scrolls both together.
 */
export const ModeratedTextarea = forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea"> & {
    /** Fires whenever the flagged state changes — wire this to disable a
     *  Save/Submit button so a flagged field can never be confirmed, not
     *  just visually warned about. */
    onFlaggedChange?: (flagged: boolean) => void;
    /** Hide the helper line under the field (the red underline still shows). */
    hideHelperText?: boolean;
    /** Additional spans-finder to union with the standard banned-word check —
     *  e.g. findCircumventionSpans for a chat field, so a phone number/link/
     *  off-platform-app mention gets the same live red-underline treatment.
     *  When this finds anything, the helper text shows CIRCUMVENTION_MESSAGE
     *  instead of the generic MODERATION_MESSAGE. */
    extraSpansFinder?: (text: string) => FlaggedSpan[];
  }
>(({ className, value, onChange, onScroll, onFlaggedChange, hideHelperText, extraSpansFinder, ...props }, ref) => {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement);

  const text = typeof value === "string" ? value : "";
  const [spans, setSpans] = useState(() => findFlaggedSpans(text));
  const [extraSpans, setExtraSpans] = useState<FlaggedSpan[]>(() => extraSpansFinder?.(text) ?? []);

  useEffect(() => {
    const next = findFlaggedSpans(text);
    const nextExtra = extraSpansFinder?.(text) ?? [];
    setSpans(next);
    setExtraSpans(nextExtra);
    onFlaggedChange?.(next.length > 0 || nextExtra.length > 0);
    // onFlaggedChange/extraSpansFinder intentionally omitted — callers pass a
    // fresh closure every render; only re-run when the TEXT actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (mirrorRef.current) {
      mirrorRef.current.scrollTop = e.currentTarget.scrollTop;
      mirrorRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    onScroll?.(e);
  };

  // Build the mirror's content: flagged spans wrapped for a red wavy
  // underline, everything else plain — all of it colour:transparent (set via
  // the wrapping className below) so only the underlines are visible.
  // Merged + sorted so overlapping standard/extra spans (rare, but possible
  // when extraSpansFinder underlines the whole message) render as one
  // contiguous underline rather than two overlapping <span> nodes.
  const allSpans = [...spans, ...extraSpans].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  allSpans.forEach((s, i) => {
    if (s.start < cursor) return; // fully covered by a previous merged span
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
  // A trailing newline needs a trailing space to render its own line in a
  // white-space:pre-wrap block — otherwise the mirror's height can undercount
  // by one line relative to the real textarea.
  parts.push("​");

  const flagged = spans.length > 0 || extraSpans.length > 0;
  // extraSpans (e.g. a phone number/link/app redirect) gets the more specific
  // message when both would otherwise apply.
  const helperMessage = extraSpans.length > 0 ? CIRCUMVENTION_MESSAGE : MODERATION_MESSAGE;

  return (
    <div className="space-y-1">
      <div className="relative">
        <div
          ref={mirrorRef}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 overflow-auto whitespace-pre-wrap break-words rounded-md border border-transparent px-3 py-2 text-base text-transparent md:text-sm",
            className,
          )}
        >
          {parts}
        </div>
        <textarea
          ref={innerRef}
          value={value}
          onChange={onChange}
          onScroll={syncScroll}
          className={cn(
            "relative flex min-h-[60px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            flagged ? "border-destructive focus-visible:ring-destructive" : "border-input",
            className,
          )}
          {...props}
        />
      </div>
      {!hideHelperText && flagged && (
        <p className="text-xs text-destructive font-medium">{helperMessage}</p>
      )}
    </div>
  );
});
ModeratedTextarea.displayName = "ModeratedTextarea";
