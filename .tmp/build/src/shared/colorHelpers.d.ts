/**
 * Convert a hex colour + a PBI-native transparency percentage (0-100,
 * 0 = fully opaque, 100 = fully transparent) into an rgba() string.
 *
 * VERIFIED 2026-07-09 (Plan 03 Task 1 spike, ran the exact published
 * `hexToRGBString` source in isolation): the raw function does NOT do any
 * 0-100-percentage normalisation itself — its second argument is passed
 * straight through as the CSS rgba() ALPHA CHANNEL (0-1 float), e.g.
 * `hexToRGBString('#000000', 0)` -> `rgba(0,0,0,0)` (transparent) and
 * `hexToRGBString('#000000', 1)` -> `rgba(0,0,0,1)` (opaque). Passing a raw
 * 0-100 percentage (the original ASSUMPTION) is a SEVERE bug, not just a
 * direction flip: any value >1 is silently CSS-clamped to alpha=1 (opaque),
 * so a naive pass-through would render every transparency slider value from
 * 2-100 as fully opaque and only 0/1 would show any effect.
 *
 * This wrapper is the fix + the single suite-wide normalisation point
 * (D-04): it converts the PBI slider's 0-100 "Transparency %" convention
 * into the 0-1 alpha `hexToRGBString` actually expects, inverting direction
 * (slider 0 = opaque = alpha 1; slider 100 = transparent = alpha 0) so every
 * visual's Background card behaves like the native Format pane.
 * `_shared/formatting/` is FROZEN to this implementation per D-11.
 */
export declare function toRgba(hex: string, transparencyPct: number): string;
