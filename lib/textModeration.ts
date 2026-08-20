// Client-side mirror of backend/src/lib/text-moderation.js — SAME algorithm,
// SAME word list, kept in sync by hand (small, deliberately dependency-free,
// low churn). This exists so a flagged word shows a red underline live, as
// the admin/tailor types, BEFORE they ever hit Save — the server-side check
// is still the real, authoritative gate (this is a UX front-run, not a
// replacement: a request can still reach the backend with zero client-side
// checking, e.g. a raw API call, so the 400 + MODERATION_MESSAGE there is
// what actually stops a save, this is what stops the SURPRISE of that 400).

const EN_BANNED = new Set([
  "fuck", "fucking", "fucker", "motherfucker", "shit", "bullshit", "bitch",
  "cunt", "asshole", "dick", "dickhead", "pussy", "slut", "whore", "bastard",
  "nigger", "nigga", "faggot", "retard", "twat", "wanker", "douchebag",
  "porn", "porno", "nude", "nudes", "xxx", "escort", "escorts", "onlyfans",
]);

const AR_BANNED = ["عاهرة", "شرموطة", "قحبة", "منيوك", "كسمك", "نيك", "زبي", "طيز"];

const INVISIBLE_CODEPOINTS = [0x200b, 0x200c, 0x200d, 0xfeff, 0x00ad];
const INVISIBLE_CHARS_RE = new RegExp(
  `[${INVISIBLE_CODEPOINTS.map((c) => `\\u{${c.toString(16)}}`).join("")}]`,
  "gu",
);

const LEET_MAP: Record<string, string> = {
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t",
  "@": "a", "$": "s", "!": "i", "+": "t", "|": "i",
};
const LEET_RE = new RegExp(
  Object.keys(LEET_MAP)
    .map((c) => `\\${c}`)
    .join("|"),
  "g",
);

function normalize(s: string): string {
  return s.replace(INVISIBLE_CHARS_RE, "").normalize("NFKC");
}

function collapseRepeats(s: string): string {
  return s.replace(/([a-z])\1+/g, "$1");
}
const EN_BANNED_CANON = new Map([...EN_BANNED].map((w) => [collapseRepeats(w), w]));

function fuzzyCollapse(t: string): string {
  return t.replace(LEET_RE, (c) => LEET_MAP[c]).replace(/[^a-z\s]/g, "");
}

function matchesMaskedWord(token: string): string | null {
  if (token.length < 3) return null;
  const m = /^([a-z]*)([^a-z\s]+)([a-z]*)$/.exec(token);
  if (!m) return null;
  const [, prefix, junk, suffix] = m;
  if (!junk || (!prefix && !suffix)) return null;
  for (const w of EN_BANNED) {
    if (prefix.length + suffix.length > w.length) continue;
    if (prefix && !w.startsWith(prefix)) continue;
    if (suffix && !w.endsWith(suffix)) continue;
    return w;
  }
  return null;
}

/** Same semantics as the backend's findBannedWord: first hit or null. */
export function findBannedWord(...texts: (string | null | undefined)[]): string | null {
  for (const raw of texts) {
    if (raw == null) continue;
    const t = normalize(String(raw)).toLowerCase();

    for (const tok of t.split(/[^a-z]+/)) {
      if (tok && EN_BANNED.has(tok)) return tok;
    }

    const collapsed = fuzzyCollapse(t);
    for (const tok of collapsed.split(/\s+/)) {
      if (!tok) continue;
      if (EN_BANNED.has(tok)) return tok;
      const canon = EN_BANNED_CANON.get(collapseRepeats(tok));
      if (canon) return canon;
    }

    for (const tok of t.split(/\s+/)) {
      const masked = matchesMaskedWord(tok);
      if (masked) return masked;
    }

    for (const w of AR_BANNED) {
      if (t.includes(w)) return w;
    }
  }
  return null;
}

export type FlaggedSpan = { start: number; end: number };

/** Locates every substring of `text` that independently trips
 *  findBannedWord, as [start,end) character offsets — used to underline each
 *  offending word in place rather than just flagging the whole field. Splits
 *  on whitespace (the same boundary the matcher itself treats as real word
 *  separation) and checks each token/run independently. O(words), fine for
 *  interactive typing on any realistic field length. */
export function findFlaggedSpans(text: string): FlaggedSpan[] {
  const spans: FlaggedSpan[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (findBannedWord(m[0])) spans.push({ start: m.index, end: m.index + m[0].length });
  }
  // Arabic substrings aren't whitespace-bounded the same way — a hit inside
  // a longer Arabic run should still underline just the matched slice.
  for (const w of AR_BANNED) {
    let idx = text.indexOf(w);
    while (idx !== -1) {
      spans.push({ start: idx, end: idx + w.length });
      idx = text.indexOf(w, idx + 1);
    }
  }
  return spans.sort((a, b) => a.start - b.start);
}

export const MODERATION_MESSAGE =
  "Your text contains language that isn't allowed. Please revise and resubmit.";

// ── Off-platform circumvention detection (chat only) ────────────────────────
// Mirrors backend/src/lib/text-moderation.js's findCircumventionSignal
// exactly — see that file's header for the full design rationale. Wired only
// into the tailor's order-chat reply box (orders.$id.tsx), matching the
// backend's own scoping (order-thread replies + dispute messages between
// customer/tailor, never support threads or admin messages).

const ARABIC_INDIC_DIGIT_RE = new RegExp("[\\u0660-\\u0669]", "g");
function arabicIndicToWestern(s: string): string {
  return s.replace(ARABIC_INDIC_DIGIT_RE, (c) => String(c.codePointAt(0)! - 0x0660));
}

const NUMBER_WORD_DIGITS: Record<string, number> = {
  zero: 1, oh: 1, o: 1, one: 1, two: 1, three: 1, four: 1, five: 1, six: 1,
  seven: 1, eight: 1, nine: 1,
  ten: 2, eleven: 2, twelve: 2, thirteen: 2, fourteen: 2, fifteen: 2,
  sixteen: 2, seventeen: 2, eighteen: 2, nineteen: 2,
  twenty: 2, thirty: 2, forty: 2, fifty: 2, sixty: 2, seventy: 2, eighty: 2, ninety: 2,
  "صفر": 1, "واحد": 1, "وحدة": 1, "اثنين": 1, "اثنان": 1, "تنين": 1,
  "ثلاثة": 1, "تلاتة": 1, "اربعة": 1, "أربعة": 1, "خمسة": 1, "ستة": 1,
  "سبعة": 1, "ثمانية": 1, "تمانية": 1, "تسعة": 1,
  "عشرة": 2, "عشرين": 2, "ثلاثين": 2, "اربعين": 2, "أربعين": 2, "خمسين": 2,
  "ستين": 2, "سبعين": 2, "ثمانين": 2, "تمانين": 2, "تسعين": 2,
};
const PHONE_DIGIT_THRESHOLD = 7;

function findPhoneNumberSignal(text: string): boolean {
  const tokens = arabicIndicToWestern(text.toLowerCase()).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  let run = 0;
  for (const tok of tokens) {
    const contributed = /^[0-9]+$/.test(tok) ? tok.length : (NUMBER_WORD_DIGITS[tok] || 0);
    if (contributed > 0) {
      run += contributed;
      if (run >= PHONE_DIGIT_THRESHOLD) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;
const BARE_DOMAIN_RE = /\b[a-z0-9-]+\.(?:com|net|org|ae|io|me|app|co|info|biz|ly|to|gg|tv|xyz|shop|store)\b/i;
function findLinkSignal(text: string): boolean {
  return URL_RE.test(text) || BARE_DOMAIN_RE.test(text);
}

const NAMED_APP_RE = new RegExp(
  [
    "whats\\s*app", "what'?s\\s*app", "\\bx\\s*app\\b", "\\bapp\\s*x\\b",
    "\\bthreads\\b", "\\btwitter\\b", "we\\s*chat", "\\bwechat\\b", "\\bbotim\\b",
    "\\bzoom\\b", "google\\s*meet", "\\btelegram\\b", "\\bsnapchat\\b",
    "\\bviber\\b", "\\bimo\\b", "\\bskype\\b", "\\bfacetime\\b", "\\bkakaotalk\\b",
  ].join("|"),
  "i",
);
const OTHER_APP_RE = /\b(?:other|another|different)\s*apps?\b/i;
const REDIRECT_VERB_APP_RE = new RegExp(
  "\\b(?:leave|exit|quit|switch|change|move|get\\s+off)\\b" +
  "(?:\\s+\\w+){0,3}\\s+(?:this|the|that|an)?\\s*apps?\\b",
  "i",
);
function findAppRedirectSignal(text: string): boolean {
  return NAMED_APP_RE.test(text) || OTHER_APP_RE.test(text) || REDIRECT_VERB_APP_RE.test(text);
}

export const CIRCUMVENTION_MESSAGE =
  "For your safety, phone numbers, links, and mentions of other apps aren't allowed in chat. Please keep all communication on Khyate.";

/** Same semantics as findBannedWord: first signal found, or null. */
export function findCircumventionSignal(...texts: (string | null | undefined)[]): string | null {
  for (const raw of texts) {
    if (raw == null) continue;
    const t = normalize(String(raw));
    if (findPhoneNumberSignal(t)) return "phone number";
    if (findLinkSignal(t)) return "link";
    if (findAppRedirectSignal(t)) return "another app";
  }
  return null;
}

/** Live-underline spans for circumvention signals — coarser than
 *  findFlaggedSpans (underlines the whole message, not a per-word span),
 *  since a phone number/link/redirect phrase is a property of the message
 *  as a whole, not a single flagged token. */
export function findCircumventionSpans(text: string): FlaggedSpan[] {
  if (!text.trim()) return [];
  return findCircumventionSignal(text) ? [{ start: 0, end: text.length }] : [];
}
