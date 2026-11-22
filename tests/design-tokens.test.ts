import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Enforces DESIGN.md §2 contrast rules against the REAL tokens in
// app/globals.css, so the rules can't drift from the code. If someone nudges
// the brand red lighter "because it looks nicer", this fails and says why.

const css = readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!match)
    throw new Error(
      `Token --${name} not found as a 6-digit hex in globals.css`,
    );
  return match[1];
}

// WCAG 2.x relative luminance and contrast ratio.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// [foreground, background, minimum ratio, why]
const pairs: [string, string, number, string][] = [
  ["text", "bg", 7, "body text is AAA"],
  ["text", "surface-muted", 7, "body text on tinted sections"],
  ["text-muted", "bg", 7, "secondary text is still AAA"],
  ["text-muted", "primary-soft", 7, "secondary text on highlighted rows"],
  ["primary", "bg", 7, "red links/labels are normal-size text"],
  ["primary", "primary-soft", 4.5, "red text on red-tint chips (large/bold)"],
  ["on-primary", "primary", 7, "white text on red buttons"],
  ["on-primary", "primary-hover", 7, "white text on pressed red buttons"],
  ["on-flag", "flag", 7, "flag banner text"],
  ["ok", "bg", 4.5, "status words (always bold/large, with icon)"],
  ["ok", "ok-soft", 4.5, "status words on their tint"],
  ["watch", "bg", 4.5, "status words (always bold/large, with icon)"],
  ["watch", "watch-soft", 4.5, "status words on their tint"],
  ["border-strong", "bg", 3, "input borders must be visible (WCAG 1.4.11)"],
  ["focus-ring", "bg", 3, "focus ring visible on white"],
  ["focus-ring", "primary", 1.5, "focus ring distinguishable on red buttons"],
];

describe("design tokens meet contrast requirements", () => {
  it.each(pairs)("--%s on --%s ≥ %s:1 (%s)", (fg, bg, min) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
  });

  it("flag colour is visibly different from the brand red", () => {
    // Red is the brand, so a flagged reading must not look like a normal
    // red button. Requiring some luminance gap keeps them distinguishable
    // (alongside the ⚠ icon and wording, which carry the real meaning).
    expect(contrast(token("flag"), token("primary"))).toBeGreaterThanOrEqual(
      1.3,
    );
  });
});
