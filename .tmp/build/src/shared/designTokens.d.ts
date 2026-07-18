import type { Theme } from "./bandEngine";
export interface TypeRole {
    size: string;
    weight: number;
    tracking: string;
}
export declare const TYPE_SCALE: Record<string, TypeRole>;
export declare const FONT_STACK = "\"Segoe UI\", -apple-system, \"Helvetica Neue\", Arial, sans-serif";
/** CSS `font-feature-settings` value for tabular numerals — apply everywhere numbers align. */
export declare const TABULAR_NUMS = "\"tnum\"";
export declare const SPACING: {
    base: number;
    cardPaddingMin: number;
    cardPaddingMax: number;
    rowGapMin: number;
    rowGapMax: number;
};
export declare const RADII: {
    card: number;
    input: number;
    pill: number;
    terminalMin: number;
    terminalMax: number;
};
export interface SurfaceTokens {
    canvas: string;
    card: string;
    border: string;
    text: string;
    muted: string;
    track: string;
}
export declare function surfaceTokens(theme?: Theme): SurfaceTokens;
/** mix(a, b, t): channel-linear blend of two hex colours, t clamped 0..1. */
export declare function mix(a: string, b: string, t: number): string;
export interface HeatmapCell {
    cell: string;
    inkFlip: boolean;
}
/**
 * heatmapRamp(v, lo, hi, surface, accent, theme): cell = mix(surface,
 * accent, 0.08 + t*0.92), t = (v-lo)/(hi-lo) clamped 0..1. inkFlip is
 * true past t>0.55 on a dark canvas / t>0.45 on light — the point at
 * which the cell reads dark enough that text needs the light ink (or
 * vice versa on light theme). Recomputes from whatever `surface`/
 * `accent` are passed — an fx colour override just changes the inputs,
 * no stop list to update.
 */
export declare function heatmapRamp(v: number, lo: number, hi: number, surface: string, accent: string, theme?: Theme): HeatmapCell;
/**
 * spectrumRamp(index, count, theme): the brand ramp cyan -> violet ->
 * magenta across a category index (0-based), for by-category visuals
 * (equaliser). count<=1 reads as the first stop (cyan).
 */
export declare function spectrumRamp(index: number, count: number, theme?: Theme): string;
/**
 * ragScale(t, theme): three band colours as a continuous good->bad
 * ramp, t clamped 0..1 (0 = success, 0.5 = warning, 1 = danger).
 */
export declare function ragScale(t: number, theme?: Theme): string;
/**
 * accentBarGradient(bandHex): the 180deg 3-stop gradient string used by
 * the flat/flush accent-bar variant — recomputes from whatever band
 * colour is passed in (band()/directionColor() output, or an fx
 * override), never a fixed stop list.
 */
export declare function accentBarGradient(bandHex: string): string;
