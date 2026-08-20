import { describe, it, expect } from "vitest";
import {
  aed,
  filsToAed,
  aedCompact,
  fmtDate,
  maskName,
  initialsOf,
  fmtSlaRemaining,
  fmtNumber,
} from "./format";

describe("money formatting", () => {
  it("aed formats with exactly 2 decimal places", () => {
    expect(aed(180)).toBe("180.00");
    expect(aed(0)).toBe("0.00");
  });

  it("aed never crashes on non-numeric input (Postgres numeric-as-string, null, undefined)", () => {
    expect(aed(null)).toBe("0.00");
    expect(aed(undefined)).toBe("0.00");
    expect(aed(Number("not a number"))).toBe("0.00");
  });

  it("filsToAed converts the smallest unit correctly", () => {
    expect(filsToAed(18000)).toBe("180.00");
    expect(filsToAed(50)).toBe("0.50");
  });

  it("aedCompact abbreviates thousands and millions", () => {
    expect(aedCompact(120000)).toBe("1.2k");
    expect(aedCompact(468000000)).toBe("4.7m");
    expect(aedCompact(50000)).toBe("500");
  });

  it("neither money helper includes currency text — that's a separate glyph component", () => {
    expect(aed(180)).not.toMatch(/AED|Dh/);
    expect(aedCompact(120000)).not.toMatch(/AED|Dh/);
  });
});

describe("date formatting", () => {
  it("fmtDate returns an em-dash placeholder for missing/invalid dates instead of crashing", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDate(undefined)).toBe("—");
    expect(fmtDate("not-a-date")).toBe("—");
  });

  it("fmtDate formats a real date", () => {
    expect(fmtDate("2026-03-05T00:00:00Z")).toBe("05 Mar 2026");
  });
});

describe("maskName", () => {
  it("keeps the first name and abbreviates the final word to an initial", () => {
    expect(maskName("Fatima Al Mazrouei")).toBe("Fatima M.");
  });

  it("handles a single-word name without a trailing initial", () => {
    expect(maskName("Fatima")).toBe("Fatima");
  });

  it("handles null/empty input without throwing", () => {
    expect(maskName(null)).toBe("");
    expect(maskName(undefined)).toBe("");
    expect(maskName("")).toBe("");
  });
});

describe("initialsOf", () => {
  it("takes the first letter of up to two words, uppercased", () => {
    expect(initialsOf("Fatima Al Mazrouei")).toBe("FA");
    expect(initialsOf("Fatima")).toBe("F");
  });

  it("handles null/empty input without throwing", () => {
    expect(initialsOf(null)).toBe("");
    expect(initialsOf(undefined)).toBe("");
  });
});

describe("fmtSlaRemaining", () => {
  it("formats remaining time as Xh Ym when not breached", () => {
    expect(fmtSlaRemaining(3661)).toBe("1h 1m");
  });

  it("flags a breached SLA with elapsed-since time", () => {
    expect(fmtSlaRemaining(-3661)).toBe("BREACHED · 1h 1m ago");
  });

  it("treats exactly zero as breached", () => {
    expect(fmtSlaRemaining(0)).toBe("BREACHED · 0h 0m ago");
  });
});

describe("fmtNumber", () => {
  it("defaults null/undefined to zero instead of crashing", () => {
    expect(fmtNumber(null)).toBe("0");
    expect(fmtNumber(undefined)).toBe("0");
  });

  it("adds thousands separators", () => {
    expect(fmtNumber(1234567)).toBe("1,234,567");
  });
});
