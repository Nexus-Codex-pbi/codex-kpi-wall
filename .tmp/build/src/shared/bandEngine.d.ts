export type Band = "success" | "warning" | "danger";
export type Theme = "dark" | "light";
/**
 * band(value, target): the value-vs-target status law.
 * ratio = value / target
 * ratio >= 1    -> "success"  (at/over target)
 * ratio >= 0.9  -> "warning"  (within 90%)
 * else          -> "danger"   (below)
 *
 * A non-finite or non-positive target has no meaningful ratio — reads
 * neutral-good ("success") rather than dividing by zero, matching a
 * met/absent target.
 */
export declare function band(value: number, target: number): Band;
/** bandColor(band, theme): the single hex token for a band, per theme. */
export declare function bandColor(b: Band, theme?: Theme): string;
/**
 * directionColor(delta, theme): the DIRECTION LAW — distinct from
 * band(), which judges a value against a target. delta >= 0 -> the lime
 * "increase/saved" token; delta < 0 -> the magenta "decrease/added"
 * token. Never returns the violet target token.
 */
export declare function directionColor(delta: number, theme?: Theme): string;
/** accentToken(theme): the brand cyan — selection, anchors, chrome. */
export declare function accentToken(theme?: Theme): string;
/** targetToken(theme): the violet target/goal marker — never a band colour. */
export declare function targetToken(theme?: Theme): string;
