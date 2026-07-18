export type CardSignatureVariant = "cornerBracket" | "flatBar" | "glassTube";
export interface CardSignatureOptions {
    variant?: CardSignatureVariant;
    /** Mirror a second bracket to the bottom-right corner (cornerBracket/glassTube only). */
    mirror?: boolean;
    size?: number;
    thickness?: number;
    cardRadius?: number;
    /** 0-100 color-mix glow budget; pass 0 for light theme / high-contrast. */
    glowMix?: number;
    /** Muted/no-data state — dims the signature and disables glow. */
    muted?: boolean;
    mutedColor?: string;
}
export interface CardSignatureHandle {
    elements: HTMLElement[];
    update(bandHex: string, opts?: CardSignatureOptions): void;
    destroy(): void;
}
/**
 * makeCornerBrackets(parent, bandHex, opts): inserts the band/accent
 * tinted card-signature elements into `parent` (which should be
 * `position: relative` or `absolute`) and returns a handle whose
 * `update()` re-tints on every visual `update()` and whose `destroy()`
 * tears down on visual `destroy()`. Elements are appended LAST so they
 * paint above a title panel in normal DOM stacking order.
 */
export declare function makeCornerBrackets(parent: HTMLElement, bandHex: string, opts?: CardSignatureOptions): CardSignatureHandle;
