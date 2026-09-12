"use strict";

/* ─── Codex KPI Wall — v2 rebuild ───────────────────────────────────────────
 * Chop-and-restart 2026-07-18 (Neil: the mid-build was never deployed for a
 * reason). Cell design ported from the normative KPI Card v2 board:
 * docs/design-session-2026-07-09/Codex KPI Card v2.dc.html — the whole card
 * runs on the value-vs-target band engine: ONE colour drives the accent,
 * status dot, delta pill and quantised target strip. The delta pill is
 * value/target-1 (band law), NOT a separate change measure — that is what
 * collapsed the well set from 11 to 5.
 */

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import ITooltipService = powerbi.extensibility.ITooltipService;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
import DataView = powerbi.DataView;

import { VisualFormattingSettingsModel, textAlignFor, marginsFor } from "./settings";

import { toRgba, compositeOver, contrastInk, contrastRatio, mutedInk } from "./shared/colorHelpers";
import { Band, Theme, band, bandColor, accentToken } from "./shared/bandEngine";
import { surfaceTokens, mix } from "./shared/designTokens";
import { makeCornerBrackets, CardSignatureHandle } from "./shared/cardSignature";
import {
    resolveCodexTheme, neonColorFor, neonShadow, ResolvedCodexTheme, flareHexFor, forcedInk } from "./shared/codexThemeSettings";
import { applyCardSignature } from "./shared/cardSignatureSettings";
import { applyBorder, resolveBorder, ResolvedBorder } from "./shared/borderSettings";
import { LicenseGate } from "./shared/licensing";
import { formatModelNumber } from "./shared/numberFormat";

/** Luminance theme pick off the shared Background card (suite idiom). */
function themeFor(hex: string): Theme {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})/i.exec(hex || "");
    if (!m) return "light";
    const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5 ? "dark" : "light";
}

const STRIP_SEGMENTS = 10;   // board: 10-segment quantised target strip

// Must match the DECLARED default of titleSettings.titleColor in settings.ts.
// A drift between the two would make the title adapt when the user HAD set a
// colour, or refuse to adapt when they had not.
const TITLE_DEFAULT_INK = "#1a1a2e";

interface CardData {
    label: string;
    value: number | null;
    target: number | null;
    highlight: number | null;
    sortOrder: number | null;
    valueFormat: string | null;
    /** The headline exactly as the model delivered it, kept so a TEXT status
     *  card ("On call") can render instead of the no-data cell that numeric
     *  coercion produced (NEXUS cycle-08 parity gap 4). */
    rawValue: powerbi.PrimitiveValue | null;
    /** Target's OWN model format. CardData kept only Value's, and the footer
     *  used it for the target: value 0.8 as `0.00` beside target 0.9 as `0.0%`
     *  printed "to target 0.90" while the tooltip correctly said 90.0%
     *  (NEXUS cycle-08 §6). */
    targetFormat: string | null;
    /** An INDEPENDENT comparison (e.g. vs prior period), when the optional
     *  Change Value well is bound. Distinct from the value/target ratio: a card
     *  can be below target AND improving, and Wall could express neither
     *  separately (NEXUS cycle-08 parity gap 1). */
    changeValue: number | null;
    changeBound: boolean;
    changeHighlight: number | null;
    changeLabel: string | null;
    changeFormat: string | null;
    selectionId: ISelectionId;
    tooltipItems: VisualTooltipDataItem[];
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private target: HTMLElement;
    private rootDiv: HTMLDivElement;
    private events: IVisualEventService;
    private selectionManager: ISelectionManager;
    private tooltipService: ITooltipService;
    private formattingSettings = new VisualFormattingSettingsModel();
    private formattingSettingsService: FormattingSettingsService;
    private isHighContrast = false;
    private hcForeground = "";
    private hcBackground = "";
    private cornerSignature: CardSignatureHandle | null = null;
    /** The Codex theme resolved by the CURRENT update (#819). Held as a field
     *  only because the selection ring is redrawn from a host callback that is
     *  outside the render pass; every render path is handed the same object as
     *  a parameter so nothing resolves the theme twice. */
    private codex: ResolvedCodexTheme | null = null;
    private highlightActive = false;
    private cardEls: HTMLDivElement[] = [];
    /** Selection state is held by IDENTITY. Grid indices are re-keyed by every
     *  sort, so a Set of indices made the ring follow a POSITION: select Alpha,
     *  reorder to Bravo/Charlie/Alpha, and Bravo lit up while the host's
     *  selection was still Alpha (NEXUS cycle-08 §2). */
    private selectedKeys = new Set<string>();
    /** The selection key of each rendered cell, in render order. */
    private cardKeys: string[] = [];
    /** Each rendered cell's OWN border colour, so deselecting can put it back
     *  instead of leaving the selection accent behind (NEXUS cycle-08 §3). */
    private cardBaseBorder: string[] = [];
    /** Each rendered cell's OWN box-shadow (the Neon border halo, "" otherwise).
     *  The selection ring is drawn into the same slot, so it composes with this
     *  instead of wiping it — a deselect used to leave the cell with no halo. */
    private cardBaseShadow: string[] = [];
    /** DERIVED from selectedKeys against the current render order — never the
     *  store. Kept as a field because it is the thing the ring is drawn from. */
    private selectedIdx = new Set<number>();

    private licenseGate: LicenseGate;

    private lastUpdateOptions: VisualUpdateOptions | null = null;
    private disposed = false;
    private cardEvents = new AbortController();

    /** Held so destroy() can unregister the SAME function objects. */
    private onRootClick: (e: MouseEvent) => void;
    private onContextMenu: (e: MouseEvent) => void;
    /** Each rendered cell's selection identity, in render order — the context
     *  menu and the keyboard path both resolve a cell through this. */
    private cardIds: ISelectionId[] = [];
    /** The PER-CARD border, resolved once per update. The shared Border card
     *  paints the outside of the WALL; this one paints each cell (Neil,
     *  2026-09-10: "border isn't per card but the whole block of cards, we need
     *  both"). Null when the card is off — the theme-token cell border and the
     *  stylesheet's 10px radius then stand, exactly as today. */
    private cellBorderPaint: ResolvedBorder | null = null;
    /** The colour a viewer actually SEES behind the wall's own chrome: the
     *  Background card's fill composited over whatever the host reports behind
     *  it. WALL-level text is judged against this. Cell surfaces are opaque
     *  theme tokens and keep their own decision (NEXUS cycle-08 §7). */
    private wallSurfaceHex = "#ffffff";


    constructor(options: VisualConstructorOptions) {

        // NO FREE TIER — an unlicensed user gets the whole visual blocked.

        // The check is async, so re-run the last update once it resolves.

        this.licenseGate = new LicenseGate(options.host, () => {

            if (this.lastUpdateOptions) this.update(this.lastUpdateOptions);

        });
        this.host = options.host;
        this.target = options.element;
        this.target.style.margin = "0";
        this.target.style.padding = "0";
        this.target.style.overflow = "hidden";
        this.events = options.host.eventService;
        this.selectionManager = this.host.createSelectionManager();
        this.tooltipService = options.host.tooltipService;
        this.formattingSettingsService = new FormattingSettingsService();

        // Single context menu listener — Policy 1180.2.5 (MS sample BarChart pattern).
        // It passed `{}` for EVERY click, so right-clicking a card handed the
        // host no category at all and the menu had nothing to act on, while
        // ordinary selection and tooltips did carry it (NEXUS cycle-08 §8).
        // Resolve the clicked cell; `{}` is reserved for the wall background.
        this.onContextMenu = (e: MouseEvent) => {
            const node = e.target as HTMLElement | null;
            const cell = node && typeof node.closest === "function"
                ? (node.closest(".kw-card") as HTMLDivElement | null) : null;
            const index = cell ? this.cardEls.indexOf(cell) : -1;
            const identity = index >= 0 ? this.cardIds[index] : null;
            this.selectionManager.showContextMenu(identity ?? {}, { x: e.clientX, y: e.clientY });
            e.preventDefault();
        };
        this.target.addEventListener("contextmenu", this.onContextMenu);

        this.rootDiv = document.createElement("div");
        this.rootDiv.className = "codex-visual-root";
        this.target.appendChild(this.rootDiv);

        // Corner-bracket card signature (suite kit) — overlays the tile,
        // pointer-events:none, refreshed per render.
        this.cornerSignature = makeCornerBrackets(
            this.target,
            accentToken("dark"),
            { variant: "cornerBracket", mirror: true }
        );

        // The host reporting a selection change (bookmark, another visual, a
        // page filter) used to CLEAR the local set, so an externally-selected
        // card ended up with no ring at all. Rebuild from the identities the
        // host is actually holding (NEXUS cycle-08 §2).
        this.selectionManager.registerOnSelectCallback(() => {
            this.syncSelectionFromHost();
        });

        this.onRootClick = () => {
            if (this.selectedKeys.size) {
                this.selectionManager.clear();
                this.selectedKeys.clear();
                this.applySelectionRing();
            }
        };
        this.rootDiv.addEventListener("click", this.onRootClick);
    }

    public update(options: VisualUpdateOptions): void {
        // A torn-down visual renders nothing and reports nothing. Cancelling the
        // licence promise stops the known replay, but any other late caller
        // (a queued host update, a resize) would otherwise reach the style write
        // that sits ABOVE the try/catch and throw a live renderingFailed
        // (NEXUS cycle-08 §10). Guarded before renderingStarted so a disposed
        // instance cannot open a render it will never finish.
        if (this.disposed || !this.target || !this.rootDiv) return;
        this.events.renderingStarted(options);
        this.lastUpdateOptions = options;

        if (this.licenseGate.blockedThisFrame()) {
            this.target.style.display = "none";
            this.events.renderingFinished(options);
            return;
        }
        this.target.style.display = "";
        try {
            const colorPalette = this.host.colorPalette as ISandboxExtendedColorPalette;
            this.isHighContrast = !!colorPalette.isHighContrast;
            if (this.isHighContrast) {
                this.hcForeground = colorPalette.foreground.value;
                this.hcBackground = colorPalette.background.value;
            }

            const dv: DataView | undefined = options.dataViews?.[0];
            this.formattingSettings = this.formattingSettingsService
                .populateFormattingSettingsModel(VisualFormattingSettingsModel, dv);

            const focusedIndex = this.cardEls.indexOf(this.target.ownerDocument.activeElement as HTMLDivElement);
            const focusedKey = focusedIndex >= 0 ? this.cardKeys[focusedIndex] : null;
            this.cardEvents.abort();
            this.cardEvents = new AbortController();
            while (this.rootDiv.firstChild) this.rootDiv.removeChild(this.rootDiv.firstChild);
            // The per-cell registers are rebuilt together with the cells — a
            // stale identity or border colour left over from the previous
            // render would be attributed to whatever now sits at that index.
            this.cardEls = [];
            this.cardIds = [];
            this.cardBaseBorder = [];
            this.cardBaseShadow = [];
            this.cardKeys = [];

            // ── Theme + suite chrome ──
            const background = this.formattingSettings.background;
            const bgHex = background.backgroundColor.value?.value ?? "#ffffff";
            const bgTransparencyPct = background.transparency.value ?? 100;
            const autoTheme: Theme = themeFor(bgHex);
            // The wall's own backing, as SEEN. The title's ink was picked from
            // the stored fill, so white at 100% transparency over a dark page
            // still chose dark ink and 95%-transparent black over white chose
            // light ink — in both cases judged against a colour nobody sees
            // (NEXUS cycle-08 §7). An invisible fill is not evidence of the
            // backdrop: composite it over what the host says is behind, then
            // judge the result. `theme` above is UNCHANGED and still governs
            // the cells, which are opaque theme-token surfaces.
            // LIMIT: colorPalette.background is the only backdrop the host
            // exposes — a page image or a shape under the visual is not
            // readable from here, and an explicit ink override remains the
            // answer for those reports.
            const behindHex = colorPalette?.background?.value || "#ffffff";
            // Nexus Codex Theme (#819): ONE switch above the wall's own theme
            // pick, resolved ONCE here and routed into every cell — the wall
            // must not re-derive a theme per cell or the grid could disagree
            // with its own chrome. Auto returns exactly the values derived
            // above (surfaceHex IS compositeOver(bgHex, transparency, behind)),
            // so an untouched report renders byte-for-byte as before; Dark,
            // Light and Neon force the token set and paint the Codex surface at
            // the card's own Surface Transparency. HC already collapsed to Auto
            // inside the resolver, so no HC branch is added here.
            const codex = resolveCodexTheme(this.formattingSettings.codexTheme, {
                hcActive: this.isHighContrast, autoTheme, autoBgHex: bgHex,
                autoTransparencyPct: bgTransparencyPct, behindHex,
            });
            this.codex = codex;
            const theme: Theme = codex.theme;
            this.wallSurfaceHex = this.isHighContrast
                ? this.hcBackground
                : codex.surfaceHex;
            this.target.style.background = this.isHighContrast
                ? this.hcBackground : toRgba(codex.bgHex, codex.transparencyPct);
            applyBorder(this.target, this.formattingSettings.visualBorder, {
                hcActive: this.isHighContrast,
                hcColor: this.hcForeground,
                palette: this.host.colorPalette,
                metadataObjects: undefined,
            });
            // #819 rule 2 — the wall's own frame is chrome, not data: under a
            // forced mode it takes that mode's border token instead of a colour
            // authored for the other tone. Auto and HC are untouched; when the
            // Border card is off applyBorder has already cleared border-style,
            // so the colour alone paints nothing.
            if (codex.mode !== "auto" && !this.isHighContrast) {
                this.target.style.borderColor = surfaceTokens(theme).border;
            }
            this.cellBorderPaint = resolveBorder(this.formattingSettings.cellBorder, {
                hcActive: this.isHighContrast,
                hcColor: this.hcForeground,
            });
            applyCardSignature(this.cornerSignature, this.formattingSettings.cardSignature, {
                autoHex: neonColorFor(accentToken(theme), codex),
                flareHex: flareHexFor(codex),
                hcActive: this.isHighContrast,
                hcColor: this.hcForeground,
                mirror: true,
                glowMix: this.isHighContrast ? 0
                    : codex.neon ? codex.glow
                    : (theme === "dark" ? 55 : 0),
                muted: false,
            });

            this.renderTitle(theme, codex);

            this.highlightActive = !!dv?.categorical?.values?.find(
                v => v.source.roles && v.source.roles["value"])?.highlights;

            const cards = dv ? this.parseCards(dv) : [];
            if (cards.length === 0) {
                this.renderEmpty(theme);
                this.events.renderingFinished(options);
                return;
            }

            this.renderGrid(cards, theme, codex);
            this.syncSelectionFromHost();
            if (focusedKey != null) {
                const focusedCard = this.cardKeys.indexOf(focusedKey);
                if (focusedCard >= 0) this.cardEls[focusedCard].focus({ preventScroll: true });
            }

            this.events.renderingFinished(options);
        } catch (e) {
            this.events.renderingFailed(options, String(e));
        }
    }

    // ─── Data ──────────────────────────────────────────────────

    private parseCards(dv: DataView): CardData[] {
        const cat = dv.categorical;
        if (!cat?.categories?.length) return [];
        const labels = cat.categories[0];
        const valuesArr = cat.values || [];
        const findCol = (role: string) => valuesArr.find(v => v.source.roles && v.source.roles[role]);
        const valueCol = findCol("value");
        const targetCol = findCol("target");
        const sortCol = findCol("sortOrder");
        const changeCol = findCol("changeValue");
        const changeLabelCol = findCol("changeLabel");
        const tooltipCols = valuesArr.filter(v => v.source.roles && v.source.roles["tooltips"]);
        if (!valueCol) return [];

        const num = (raw: powerbi.PrimitiveValue | undefined): number | null => {
            if (typeof raw === "string" && raw.trim() === "") return null;
            const n = typeof raw === "number" ? raw : (raw == null ? NaN : Number(raw));
            return isFinite(n) ? n : null;
        };

        const out: CardData[] = [];
        const n = labels.values?.length ?? 0;
        for (let i = 0; i < n; i++) {
            const label = String(labels.values[i] ?? "");
            const value = num(valueCol.values?.[i]);
            const target = num(targetCol?.values?.[i]);
            const highlight = num(valueCol.highlights?.[i]);
            const highlighting = this.highlightActive && highlight != null;
            const sortOrder = num(sortCol?.values?.[i]);
            const changeValue = num(changeCol?.values?.[i]);
            // The change measure follows the SAME population as the headline
            // under a cross-highlight (NEXUS cycle-08 §1) — one cell, one
            // reading, everywhere.
            const changeHighlight = num(changeCol?.highlights?.[i]);
            const rawChangeLabel = highlighting ? changeLabelCol?.highlights?.[i] : changeLabelCol?.values?.[i];
            const changeLabel = rawChangeLabel == null || String(rawChangeLabel).trim() === ""
                ? null : String(rawChangeLabel);
            const changeFormat = changeCol?.source.format ?? null;

            const selectionId = this.host.createSelectionIdBuilder()
                .withCategory(labels, i)
                .createSelectionId();

            const fmt = valueCol.source.format ?? null;
            const targetFormat = targetCol?.source.format ?? null;
            const tooltipItems: VisualTooltipDataItem[] = [
                { displayName: labels.source.displayName || "Card", value: label },
            ];
            // Under a cross-highlight the cell is rendered from the HIGHLIGHTED
            // reading (see readingOf), so the tooltip must report that same
            // population — it used to report the unfiltered total beside a
            // highlighted headline, labelling two different populations as the
            // same reading (NEXUS cycle-08 §1). The total is still available,
            // under its own explicit name.
            const reading = highlighting ? highlight : value;
            const rawValue = valueCol.values?.[i] ?? null;
            if (this.valueFormatType() === "text") {
                const text = this.textOf({ rawValue, highlight });
                if (text != null) tooltipItems.push({ displayName: valueCol.source.displayName, value: text });
            } else if (reading != null) {
                tooltipItems.push({ displayName: valueCol.source.displayName, value: this.formatValue(reading, fmt) });
            }
            if (highlighting && value != null && value !== highlight) {
                tooltipItems.push({ displayName: `${valueCol.source.displayName} (unfiltered)`, value: this.formatValue(value, fmt) });
            }
            if (target != null) tooltipItems.push({ displayName: targetCol!.source.displayName, value: this.formatValue(target, targetFormat ?? fmt) });
            const changeReading = highlighting ? changeHighlight : changeValue;
            if (changeReading != null) {
                tooltipItems.push({
                    displayName: changeCol!.source.displayName,
                    value: changeLabel ?? (changeFormat
                        ? this.formatValue(changeReading, changeFormat)
                        : `${(changeReading * 100).toFixed(1)}%`),
                });
            }
            for (const tc of tooltipCols) {
                const tv = tc.values?.[i];
                if (tv != null) tooltipItems.push({ displayName: tc.source.displayName, value: this.formatValue(tv as number, tc.source.format ?? null) });
            }

            out.push({
                label, value, target, highlight, sortOrder, valueFormat: fmt, targetFormat,
                rawValue,
                changeValue, changeBound: !!changeCol, changeHighlight, changeLabel, changeFormat,
                selectionId, tooltipItems,
            });
        }

        if (out.some(c => c.sortOrder != null)) {
            out.sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
        }
        return out;
    }

    /** The ONE number a cell is rendered from. Under an active cross-highlight
     *  that is the highlighted reading; a card the highlight does not
     *  contribute to keeps its own value and dims (NEXUS cycle-08 §1). */
    private readingOf(card: CardData): number | null {
        return (this.highlightActive && card.highlight != null) ? card.highlight : card.value;
    }

    /** The independent comparison for a cell, on the same population. */
    private changeOf(card: CardData): number | null {
        return (this.highlightActive && card.highlight != null) ? card.changeHighlight : card.changeValue;
    }

    private textOf(card: Pick<CardData, "rawValue" | "highlight">): string | null {
        const raw = this.highlightActive && card.highlight != null ? card.highlight : card.rawValue;
        return raw == null || String(raw) === "" ? null : String(raw);
    }

    /** The report's Direction Logic. "Up is Good" is the declared default and
     *  is the wall's original fixed higher-is-better rule verbatim. */
    private directionPolicy(): string {
        return String(this.formattingSettings?.changeSettings?.changeDirection?.value?.value || "upIsGood");
    }

    /** The verdict band for a value against a target UNDER the direction
     *  policy. Higher-is-better is the shipped ratio; lower-is-better inverts
     *  it, so a cost of 80 against a budget of 100 reads as success instead of
     *  danger (NEXUS cycle-08 parity gap 2). Neutral has no verdict at all and
     *  is handled by the caller. */
    private targetBand(reading: number, target: number, direction: string): Band {
        return direction === "downIsGood" ? band(target, reading) : band(reading, target);
    }

    /** The Value Format card's explicit override, or null for "Model format" —
     *  the default, which is the wall's existing model-format behaviour and is
     *  what every saved report gets (NEXUS cycle-08 parity gap 4). */
    private valueFormatType(): string {
        return String(this.formattingSettings?.valueFormat?.valueFormatType?.value?.value || "auto");
    }

    /** The headline text under an explicit Value Format. Percent is a plain
     *  x100 at every magnitude — KPI Card's percent helper changes
     *  interpretation above 1 and this review says not to copy that. Currency
     *  puts the sign OUTSIDE the symbol, matching shared/numberFormat.ts. */
    private formatExplicit(n: number, type: string): string {
        const vf = this.formattingSettings.valueFormat;
        const digits = Math.max(0, Math.min(6, vf.decimalPlaces.value ?? 0));
        const opts = { minimumFractionDigits: digits, maximumFractionDigits: digits };
        const locale = this.host?.locale;
        if (type === "percent") {
            return `${(n * 100).toLocaleString(locale, { ...opts, useGrouping: false })}%`;
        }
        if (type === "currency") {
            const symbol = (vf.currencySymbol.value || "$").trim();
            const body = Math.abs(n).toLocaleString(locale, opts);
            const sign = n < 0 && /[1-9]/.test(body) ? "-" : "";
            return `${sign}${symbol}${body}`;
        }
        return n.toLocaleString(locale, opts);
    }

    /** Font/typography application shared by every text surface on a cell.
     *  A size of 0 means "automatic" — the stylesheet's own value — which is
     *  the idiom the Value and Label cards already use. */
    private applyTypography(
        el: HTMLElement,
        style: { fontFamily?: { value?: string }; fontSize?: { value?: number };
                 bold?: { value?: boolean }; italic?: { value?: boolean }; underline?: { value?: boolean } },
        weights: { on: string; off: string }
    ): void {
        if (style.fontFamily?.value) el.style.fontFamily = style.fontFamily.value;
        if (style.fontSize?.value) el.style.fontSize = `${style.fontSize.value}px`;
        el.style.fontWeight = style.bold?.value ? weights.on : weights.off;
        el.style.fontStyle = style.italic?.value ? "italic" : "normal";
        el.style.textDecoration = style.underline?.value ? "underline" : "none";
    }

    /** The pill's number when no Change Label is bound. The arrow carries the
     *  sign, so the magnitude prints unsigned. A change measure with its own
     *  model format is rendered through it; otherwise it is read as a fraction
     *  and printed as a percentage to one decimal — the wall's existing pill
     *  style. Deliberately NOT switched by magnitude: that is KPI Card's old
     *  defect and this review says not to copy it. */
    private formatChange(cv: number, format: string | null): string {
        const abs = Math.abs(cv);
        if (format) return formatModelNumber(abs, format, this.host.locale);
        return `${(abs * 100).toFixed(1)}%`;
    }

    // ─── Render ────────────────────────────────────────────────

    private renderGrid(cards: CardData[], theme: Theme, codex: ResolvedCodexTheme): void {
        const layout = this.formattingSettings.layout;
        const colsMode = String(layout.columnsMode.value?.value || "auto");
        const minWidth = layout.minCardWidth.value ?? 240;
        const gap = layout.cardGap.value ?? 14;

        const grid = document.createElement("div");
        grid.className = "kw-grid";
        grid.style.gap = `${gap}px`;
        grid.style.padding = `${Math.max(8, gap)}px`;
        // Policy 1180.2.2 — a fixed column count used minmax(0, 1fr), which lets
        // columns collapse to nothing: at small widths the cards squashed to
        // unreadable slivers instead of overflowing, so no horizontal scrollbar
        // ever appeared. Honour minCardWidth in both modes — if the user asked for
        // N columns, give them N columns at a readable width and let the root
        // scroll, rather than silently shrinking the content away.
        grid.style.gridTemplateColumns = colsMode === "auto"
            ? `repeat(auto-fit, minmax(${minWidth}px, 1fr))`
            : `repeat(${colsMode}, minmax(${minWidth}px, 1fr))`;

        this.cardKeys = cards.map(c => this.keyOf(c.selectionId));
        cards.forEach((card, i) => grid.appendChild(this.renderCard(card, i, theme, codex)));
        this.rootDiv.appendChild(grid);
    }

    private renderCard(card: CardData, index: number, theme: Theme, codex: ResolvedCodexTheme): HTMLDivElement {
        const kw = this.formattingSettings.kpiWall;
        const vs = this.formattingSettings.valueStyle;
        const ls = this.formattingSettings.labelStyle;
        const cs = this.formattingSettings.changeSettings;
        const ss = this.formattingSettings.subtitleStyle;
        const hc = this.isHighContrast;
        const surf = surfaceTokens(theme);
        const accentStyle = String(kw.accentStyle.value?.value || "cornerBracket");
        const twoCorners = accentStyle === "cornerBracket" && String(kw.corners.value?.value || "two") === "two";

        // ONE reading drives the WHOLE cell. The headline used to come from the
        // highlight while the band colour, delta pill, target strip and tooltip
        // all came from the unfiltered value: a 120/100 card highlighted at 40
        // rendered "40" beside a green "▲ 20.0%" with ten lit segments
        // (NEXUS cycle-08 §1). Recompute everything from the highlighted
        // reading; a card with no highlight keeps its own value and dims.
        const reading = this.readingOf(card);
        // A TEXT headline has no ratio, so it carries no verdict, pill or strip
        // — but it is not "no data" either. Numeric coercion used to send every
        // text status card to the no-data cell (NEXUS cycle-08 parity gap 4).
        // Only reachable when the report explicitly selects Format: Text.
        const formatType = this.valueFormatType();
        const textMode = formatType === "text";
        const textValue = textMode ? this.textOf(card) : null;
        const isEmpty = textMode ? textValue == null : reading == null;
        const hasTarget = !textMode && card.target != null && card.target > 0;
        // Band law: no target reads neutral — the brand accent, not a verdict.
        // A MISSING value is not a missed target: band() was being handed NaN
        // and returning "danger", so a no-data cell kept a danger-coloured
        // corner that read as a failed KPI (NEXUS cycle-08 §4). No reading ->
        // the muted token, and no glow, the same "muted" treatment the shared
        // card signature uses for an absent value.
        // Direction Logic (NEXUS cycle-08 parity gap 2). "Up is Good" is the
        // default and is band(reading, target) — the original fixed rule.
        // "Down is Good" inverts the ratio so a cost/defect/elapsed-time wall
        // can read a figure under target as success. "Neutral" states no
        // verdict and falls back to the brand accent.
        const direction = this.directionPolicy();
        const verdict: Band | null = (!isEmpty && hasTarget && direction !== "neutral")
            ? this.targetBand(reading as number, card.target as number, direction)
            : null;
        const bandHex = hc ? this.hcForeground
            : isEmpty ? surf.muted
            : verdict ? bandColor(verdict, theme)
            : accentToken(theme);
        const glow = !hc && theme === "dark" && !isEmpty;
        // The glow BUDGET. Every site below already glowed on a dark theme at a
        // fixed 40% — under Neon that constant becomes the card's own Glow
        // Strength, so one slider drives the whole wall.
        const glowPct = codex.neon ? codex.glow : 40;
        // The cell's OWN signature (accent bar, second bracket, status dot, lit
        // strip segments) takes the flare colour under Neon scope "flare" ONLY
        // while it is an accent. #819 rule 1: once a target gives the cell a
        // verdict, that hue MEANS success/warning/danger — it is data, and the
        // flare must not repaint it; it keeps its own hue and glows in it. A
        // no-data cell is the same case in reverse: its muted token says
        // "absent", which the flare would also overwrite. The delta pill was
        // already exempt for the same reason.
        const accentHex = (verdict || isEmpty) ? bandHex : neonColorFor(bandHex, codex);
        // Keyboard focus ring colour — a painted surface, so it takes the
        // system foreground slot under high contrast (NEXUS cycle-08 §9).
        const focusRing = hc ? this.hcForeground : accentToken(theme);

        const el = document.createElement("div");
        el.className = `kw-card kw-${accentStyle}`;
        el.classList.toggle("kw-hc", hc);
        el.style.background = hc ? this.hcBackground : surf.card;
        // Per-card border (NEXUS cycle-08 parity gap 7). Off by default, so an
        // untouched report keeps the theme token and the stylesheet's radius —
        // the wall-level Border card is untouched and still paints the outside.
        // #819 rule 2 — the cell border is chrome, not data, so under a forced
        // mode it takes that mode's border token however it was authored; Auto
        // keeps the user's colour and HC keeps the system foreground. Width and
        // radius are geometry, not tone, and stay the user's in every mode.
        const cellBorder = this.cellBorderPaint;
        const baseBorderColor = hc ? this.hcForeground
            : (cellBorder && codex.mode === "auto") ? cellBorder.colorCss
            : surf.border;
        el.style.border = `${cellBorder ? cellBorder.width : (hc ? 2 : 1)}px solid ${baseBorderColor}`;
        if (cellBorder) el.style.borderRadius = `${cellBorder.radius}px`;
        // Neon: a halo on the cell's own border — the cell IS the wall's
        // primary mark. A no-data cell is excluded, the same way its accent and
        // dot stay muted: an absent value flaring would read as a live one.
        this.cardBaseShadow[index] = (glow && codex.neon) ? neonShadow(accentHex, codex.glow) : "";
        el.style.boxShadow = this.cardBaseShadow[index];
        this.cardEls[index] = el;
        this.cardBaseBorder[index] = baseBorderColor;
        this.cardIds[index] = card.selectionId;

        if (this.highlightActive && card.highlight == null) el.style.opacity = "0.35";

        // Accent (board .k2bar): flat = gradient bar, glassTube = rounded
        // gradient tube + CSS highlight, cornerBracket = border corners.
        //
        // This is the CELL accent. Turning off the wall's own Card Signature
        // never turned it off and nothing else did either, so the two
        // signatures could not be told apart in the pane (NEXUS cycle-08 parity
        // gap 7). "Cell accent" is that control; it defaults ON.
        const showAccent = kw.showAccent.value !== false;
        let bar: HTMLDivElement | null = null;
        if (showAccent) {
            bar = document.createElement("div");
            bar.className = "kw-bar";
            if (accentStyle === "cornerBracket") {
                bar.style.borderColor = accentHex;
                if (glow) bar.style.filter = `drop-shadow(0 0 6px ${toRgba(accentHex, glowPct)})`;
            } else {
                bar.style.background = hc ? this.hcForeground :
                    `linear-gradient(180deg, ${mix("#ffffff", accentHex, 0.55)}, ${accentHex} 45%, ${mix("#000000", accentHex, 0.70)})`;
                if (glow) bar.style.boxShadow = `0 0 10px ${toRgba(accentHex, glowPct)}`;
            }
            el.appendChild(bar);
            if (twoCorners) {
                const c2 = document.createElement("div");
                c2.className = "kw-corner2";
                c2.style.borderColor = accentHex;
                if (glow) c2.style.filter = `drop-shadow(0 0 6px ${toRgba(accentHex, glowPct)})`;
                el.appendChild(c2);
            }
        }

        // Head: eyebrow label + beveled status dot. Built BEFORE the empty
        // branch — it used to be built after it, so a cell whose value was
        // missing in the current filter lost its category name entirely and
        // rendered only "— — / No data in current filter" while its tooltip
        // still knew the category (NEXUS cycle-08 §4).
        const head = document.createElement("div");
        head.className = "kw-head";
        const eye = document.createElement("span");
        eye.className = "kw-eye";
        eye.textContent = ls.uppercase.value ? card.label.toUpperCase() : card.label;
        this.applyTypography(eye, ls, { on: "700", off: "600" });
        // #819 rule 3 — an ink the user set explicitly survives a forced mode
        // while it still reads on that mode's surface; a blank swatch (the
        // declared default, "automatic") always takes the mode token. Auto is
        // the pane value verbatim, exactly as before.
        const labelInk = ls.color.value?.value ?? "";
        eye.style.color = hc ? this.hcForeground
            : forcedInk(labelInk, surf.muted, codex, !labelInk);
        const labelMargins = marginsFor(String(ls.labelAlign?.value ?? "left"));
        eye.style.marginLeft = labelMargins.left;
        eye.style.marginRight = labelMargins.right;
        head.appendChild(eye);
        if (kw.showDot.value) {
            const dot = document.createElement("span");
            dot.className = "kw-dot";
            dot.style.background = hc ? this.hcForeground
                : `radial-gradient(circle at 35% 30%, ${mix("#ffffff", accentHex, 0.35)}, ${accentHex} 55%, ${mix("#000000", accentHex, 0.55)})`;
            if (glow) dot.style.boxShadow = `0 0 8px ${toRgba(accentHex, glowPct)}`;
            head.appendChild(dot);
        }
        el.appendChild(head);

        // Per-cell empty state (board .k2.nd) — value missing in the filter.
        if (isEmpty) {
            el.classList.add("kw-nd");
            if (bar) {
                bar.style.background = hc ? this.hcForeground : surf.muted;
                bar.style.opacity = hc ? "1" : "0.35";
                bar.style.boxShadow = "none";
            }
            const ndv = document.createElement("div");
            ndv.className = "kw-ndv";
            ndv.style.color = hc ? this.hcForeground : surf.muted;
            if (hc) ndv.style.opacity = "1";
            ndv.textContent = "— —";
            const ndt = document.createElement("div");
            ndt.className = "kw-ndt";
            ndt.style.color = hc ? this.hcForeground : surf.muted;
            ndt.textContent = "No data in current filter";
            el.appendChild(ndv);
            el.appendChild(ndt);
            this.wireCard(el, index, card, `${card.label}: no data in current filter`, focusRing);
            return el;
        }

        // Value — cross-highlight shows the highlighted number, and so does
        // every verdict below it (see `reading`).
        const val = document.createElement("div");
        val.className = "kw-val";
        // "Model format" (the default) is the wall's existing behaviour; an
        // explicit Format overrides it, and Text renders the model's own value.
        val.textContent = textMode
            ? (textValue as string)
            : formatType === "auto"
                ? this.formatValue(reading as number, card.valueFormat)
                : this.formatExplicit(reading as number, formatType);
        this.applyTypography(val, vs, { on: "700", off: "500" });
        const valueInk = vs.color.value?.value ?? "";
        val.style.color = hc ? this.hcForeground
            : forcedInk(valueInk, surf.text, codex, !valueInk);
        // Neon: the headline flares in its own ink (or the flare colour when
        // scoped to it) — the pilot's rule. Nothing smaller than the headline
        // glows, and never under high contrast.
        val.style.textShadow = codex.neon && !hc
            ? neonShadow(neonColorFor(val.style.color, codex), codex.glow)
            : "";
        // Alignment is textAlign only: align-self would shrink the block to its
        // content and defeat the stylesheet's ellipsis on a narrow cell.
        val.style.textAlign = textAlignFor(String(this.formattingSettings.valueFormat.valueAlign?.value ?? "left"));
        el.appendChild(val);

        // Foot: the comparison pill + target line + quantised strip.
        //
        // The pill used to be value/target-1 ALWAYS, so a card could not show
        // "improving vs prior" while still being under target — the two are
        // different questions and neither should silently replace the other
        // (NEXUS cycle-08 parity gap 1). When the optional Change Value well is
        // bound the pill reports THAT, coloured by Direction Logic, and Target
        // keeps the band colour, target line and strip. With no Change Value
        // bound this is the original target ratio, unchanged.
        const changeReading = this.changeOf(card);
        const hasChange = changeReading != null;
        const pillOn = kw.showPill.value && (card.changeBound ? hasChange : hasTarget);
        const subOn = kw.showSub.value && hasTarget;
        const footWrap = document.createElement("div");
        if (pillOn || subOn) {
            const foot = document.createElement("div");
            foot.className = "kw-foot";
            const delta = hasTarget ? (reading as number) / (card.target as number) - 1 : 0;
            if (pillOn) {
                const pill = document.createElement("span");
                pill.className = "kw-pill";
                let pillHex = bandHex;
                let pillText: string;
                if (hasChange) {
                    const cv = changeReading as number;
                    // A change is a DIRECTION read, judged by the policy — not
                    // the target ratio. Neutral states no verdict.
                    const good = direction === "upIsGood" ? cv >= 0 : cv < 0;
                    pillHex = hc ? this.hcForeground
                        : direction === "neutral" ? surf.muted
                        : bandColor(good ? "success" : "danger", theme);
                    const arrow = cv >= 0 ? "▲" : "▼";
                    pillText = card.changeLabel != null
                        ? `${arrow} ${card.changeLabel}`
                        : `${arrow} ${this.formatChange(cv, card.changeFormat)}`;
                } else {
                    pillText = `${delta >= 0 ? "▲" : "▼"} ${(Math.abs(delta) * 100).toFixed(1)}%`;
                }
                const pillSurface = compositeOver(pillHex, 85, surf.card);
                pill.style.color = hc ? this.hcForeground : contrastInk(pillSurface, pillHex, surf.text);
                pill.style.background = hc ? "transparent" : toRgba(pillHex, 85);
                // Neon: the chip flares in its OWN verdict hue at the card's
                // glow budget. Its fill and ink are untouched, so the contrast
                // pick above still holds against the surface a viewer reads.
                if (!hc && codex.neon) pill.style.boxShadow = neonShadow(pillHex, codex.glow);
                if (hc) pill.style.border = `1px solid ${this.hcForeground}`;
                pill.textContent = pillText;
                // Pill typography/alignment — it was FIXED, so a KPI Card
                // composition could not be reproduced (NEXUS cycle-08 parity
                // gap 6). Defaults are the stylesheet's own values.
                this.applyTypography(pill, cs, { on: "700", off: "500" });
                const pillMargins = marginsFor(String(cs.changeAlign?.value ?? "left"));
                pill.style.marginLeft = pillMargins.left;
                pill.style.marginRight = pillMargins.right;
                foot.appendChild(pill);
            }
            if (subOn) {
                const sub = document.createElement("span");
                sub.className = "kw-sub";
                const subInk = ss.subtitleColor.value?.value ?? "";
                sub.style.color = hc ? this.hcForeground
                    : forcedInk(subInk, surf.muted, codex, !subInk);
                this.applyTypography(sub, ss, { on: "700", off: "400" });
                const subMargins = marginsFor(String(ss.subtitleAlign?.value ?? "left"));
                sub.style.marginLeft = subMargins.left;
                sub.style.marginRight = subMargins.right;
                sub.textContent = `${delta >= 0 ? "vs" : "to"} target ${this.formatValue(card.target as number, card.targetFormat ?? card.valueFormat)}`;
                foot.appendChild(sub);
            }
            footWrap.appendChild(foot);
        }
        if (hasTarget && kw.showStrip.value) {
            const strip = document.createElement("div");
            strip.className = "kw-strip";
            const lit = Math.round(Math.max(0, Math.min((reading as number) / (card.target as number), 1)) * STRIP_SEGMENTS);
            for (let s = 0; s < STRIP_SEGMENTS; s++) {
                const seg = document.createElement("span");
                if (s < lit) {
                    seg.style.background = accentHex;
                    if (glow) seg.style.boxShadow = `0 0 5px ${toRgba(accentHex, glowPct)}`;
                } else {
                    seg.style.background = hc ? "transparent" : surf.track;
                    if (hc) seg.style.border = `1px solid ${this.hcForeground}`;
                }
                strip.appendChild(seg);
            }
            footWrap.appendChild(strip);
        }
        el.appendChild(footWrap);

        // A named focus target: the screen-reader name carries the same three
        // facts the cell shows — category, reading, and the target it is
        // judged against.
        const ariaLabel = hasTarget
            ? `${card.label}: ${val.textContent}, target ${this.formatValue(card.target as number, card.targetFormat ?? card.valueFormat)}`
            : `${card.label}: ${val.textContent}`;
        this.wireCard(el, index, card, ariaLabel, focusRing);
        return el;
    }

    private wireCard(el: HTMLDivElement, index: number, card: CardData, ariaLabel: string, focusRing: string): void {
        const signal = this.cardEvents.signal;
        const selectionComplete = (ids: ISelectionId[]) => {
            if (!signal.aborted) this.setSelectedKeys(ids);
        };
        // ─── Keyboard path (NEXUS cycle-08 §9) ─────────────────────────
        // capabilities.json advertises supportsKeyboardFocus and the README
        // promises card navigation, but the wall had pointer handlers ONLY:
        // Tab skipped from the button before the wall to the one after it with
        // zero card focus targets, and Enter selected nothing. Each cell is now
        // a named focus target with a visible focus ring and Enter/Space/menu
        // parity with the pointer. The focus colour is resolved by the caller,
        // so it takes the system foreground under high contrast.
        el.tabIndex = 0;
        el.setAttribute("role", "button");
        el.setAttribute("aria-label", ariaLabel);
        el.style.outlineColor = focusRing;
        el.addEventListener("keydown", (e: KeyboardEvent) => {
            const key = e.key;
            if (key === "Enter" || key === " " || key === "Spacebar") {
                e.preventDefault();
                e.stopPropagation();
                this.selectionManager.select(card.selectionId, e.ctrlKey || e.metaKey)
                    .then(selectionComplete);
            } else if (key === "ContextMenu" || (e.shiftKey && key === "F10")) {
                e.preventDefault();
                e.stopPropagation();
                const rect = el.getBoundingClientRect();
                this.selectionManager.showContextMenu(card.selectionId, {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                });
            }
        }, { signal });
        // Keyboard focus must show the tooltip's information too — a focus move
        // is the keyboard equivalent of the hover below.
        el.addEventListener("focus", () => {
            const rect = el.getBoundingClientRect();
            this.tooltipService.show({
                coordinates: [rect.left + rect.width / 2, rect.top + rect.height / 2],
                isTouchEvent: false,
                dataItems: card.tooltipItems,
                identities: [card.selectionId],
            });
        }, { signal });
        el.addEventListener("blur", () => {
            this.tooltipService.hide({ isTouchEvent: false, immediately: false });
        }, { signal });

        el.addEventListener("mousemove", (e: MouseEvent) => {
            this.tooltipService.show({
                coordinates: [e.clientX, e.clientY],
                isTouchEvent: false,
                dataItems: card.tooltipItems,
                identities: [card.selectionId],
            });
        }, { signal });
        el.addEventListener("mouseleave", () => {
            this.tooltipService.hide({ isTouchEvent: false, immediately: false });
        }, { signal });
        el.addEventListener("click", (e: MouseEvent) => {
            const multi = e.ctrlKey || e.metaKey;
            // The selection manager's answer is authoritative — the old
            // index bookkeeping re-derived it and drifted as soon as the rows
            // were sorted (NEXUS cycle-08 §2).
            this.selectionManager.select(card.selectionId, multi).then(selectionComplete);
            e.stopPropagation();
        }, { signal });
    }

    /** A stable, sort-independent key for a selection identity. */
    private keyOf(id: ISelectionId | null | undefined): string {
        if (!id) return "";
        try {
            if (typeof id.getKey === "function") return String(id.getKey());
            return JSON.stringify(id.getSelector());
        } catch {
            return "";
        }
    }

    private setSelectedKeys(ids: ISelectionId[] | null | undefined): void {
        if (this.disposed) return;
        this.selectedKeys = new Set((ids || []).map(id => this.keyOf(id)).filter(k => k !== ""));
        this.applySelectionRing();
    }

    /** Rebuild local selection from whatever the host currently holds. */
    private syncSelectionFromHost(): void {
        if (this.disposed) return;
        let ids: ISelectionId[] = [];
        try {
            ids = (this.selectionManager.getSelectionIds() as ISelectionId[]) || [];
        } catch {
            ids = [];
        }
        this.setSelectedKeys(ids);
    }

    /** Board .k2.sel — accent ring on selected cards, others untouched. */
    private applySelectionRing(): void {
        // The theme the LAST update resolved — never a second derivation. A
        // ring drawn before the first render has no cells to draw on, so the
        // fallback is only ever reached with an empty register.
        const codex = this.codex;
        const theme: Theme = codex ? codex.theme
            : themeFor(this.formattingSettings?.background?.backgroundColor?.value?.value ?? "#ffffff");
        const accToken = accentToken(theme);
        const acc = this.isHighContrast ? this.hcForeground
            : codex ? neonColorFor(accToken, codex) : accToken;
        // The ring's own glow takes the card's budget under Neon (70 otherwise,
        // the shipped value).
        const ringGlow = codex?.neon ? codex.glow : 70;
        // Re-derive positions from identities EVERY time the ring is drawn —
        // this is what survives a sort (NEXUS cycle-08 §2).
        this.selectedIdx = new Set<number>();
        this.cardKeys.forEach((key, i) => {
            if (key !== "" && this.selectedKeys.has(key)) this.selectedIdx.add(i);
        });
        const any = this.selectedIdx.size > 0;
        this.cardEls.forEach((el, i) => {
            if (!el) return;
            const sel = this.selectedIdx.has(i);
            // The cell's own Neon halo is the BASE of this slot, so a deselect
            // puts the halo back instead of clearing the cell's only glow.
            const base = this.cardBaseShadow[i] ?? "";
            el.style.boxShadow = sel
                ? `0 0 0 1px ${acc}${theme === "dark" && !this.isHighContrast ? `, 0 0 18px ${toRgba(acc, ringGlow)}` : ""}${base ? `, ${base}` : ""}`
                : base;
            // The selected branch used to set borderColor and the unselected
            // branch never put it back, so a deselected card kept the cyan
            // accent border for the rest of the session (NEXUS cycle-08 §3).
            // Shadow and opacity already reset; the border now does too.
            el.style.borderColor = sel ? acc : (this.cardBaseBorder[i] ?? "");
            // The ring is a colour-only cue; a keyboard/AT user needs the state
            // in the accessibility tree too (NEXUS cycle-08 §9).
            el.setAttribute("aria-pressed", sel ? "true" : "false");
            if (!this.highlightActive) el.style.opacity = any && !sel ? "0.55" : "1";
        });
    }

    // ─── Title / landing ───────────────────────────────────────

    private wallInk(darkInk: string): string {
        const ink = contrastInk(this.wallSurfaceHex, darkInk, surfaceTokens("dark").text);
        return contrastRatio(ink, this.wallSurfaceHex) >= 4.5
            ? ink : contrastInk(this.wallSurfaceHex, "#000000", "#ffffff");
    }

    private renderTitle(theme: Theme, codex: ResolvedCodexTheme): void {
        const t = this.formattingSettings.titleSettings;
        if (!t?.showTitle?.value || !t?.titleText?.value) return;
        const el = document.createElement("div");
        el.className = "codex-visual-title";
        el.textContent = t.titleText.value;
        if (t.titleFontFamily?.value) el.style.fontFamily = t.titleFontFamily.value;
        if (t.titleFontSize?.value) el.style.fontSize = `${t.titleFontSize.value}px`;
        el.style.fontWeight = t.titleBold?.value ? "700" : "400";
        el.style.fontStyle = t.titleItalic?.value ? "italic" : "normal";
        el.style.textDecoration = t.titleUnderline?.value ? "underline" : "none";
        el.style.textAlign = textAlignFor(t.titleAlign?.value as string);
        // Only the UNTOUCHED swatch adapts — a title colour the user actually
        // set is a deliberate choice and is handed through unchanged. The
        // surface judged is the COMPOSITED one, not the stored fill, and the
        // ink is the higher-contrast of the two candidates rather than a
        // luminance bucket (NEXUS cycle-08 §7).
        // A FORCED Codex mode extends that rule through the ONE suite guard
        // (#819 rule 3): the wall surface is now the Codex one, so an untouched
        // swatch takes the adapted ink, and a title colour the user DID set is
        // kept while it still reads ≥ 4.5:1 on that surface — only an
        // illegible one is flipped. forcedInk judges against codex.surfaceHex,
        // which IS this.wallSurfaceHex whenever a mode is forced.
        const set = t.titleColor?.value?.value;
        const titleIsDefault = !set || String(set).toLowerCase() === TITLE_DEFAULT_INK;
        const c = forcedInk(String(set ?? ""), this.wallInk(TITLE_DEFAULT_INK), codex, titleIsDefault);
        el.style.color = this.isHighContrast ? this.hcForeground : (c || "");
        this.rootDiv.appendChild(el);
    }

    // Landing state — fills the body so right-click reaches our DOM
    // regardless of which region the cert reviewer hits.
    private renderEmpty(theme: Theme): void {
        // The landing prompt is wall-level text on the wall's own backing, so
        // it takes the same composited decision the title does (§7). There are
        // no cells here, so no cell-surface decision is affected.
        const ink = this.wallInk(surfaceTokens("light").text);
        const wrap = document.createElement("div");
        wrap.className = "codex-visual-empty";
        const h = document.createElement("div");
        h.className = "codex-visual-empty-title";
        h.style.color = this.isHighContrast ? this.hcForeground : ink;
        h.textContent = "Codex KPI Wall";
        const p = document.createElement("div");
        p.className = "codex-visual-empty-body";
        p.style.color = this.isHighContrast ? this.hcForeground : mutedInk(ink, this.wallSurfaceHex);
        p.textContent = "Add a Card label and a Value measure. Optional: Target (drives the band colour, delta pill and target strip) and Sort order.";
        wrap.appendChild(h);
        wrap.appendChild(p);
        this.rootDiv.appendChild(wrap);
    }

    private formatValue(n: number, format: string | null): string {
        if (n == null || !isFinite(n)) return String(n ?? "");
        // Optional `#` digits are honoured: a single derived count used as both
        // min and max rendered `0.##` 12.34 as "12" (NEXUS cycle-02 F3).
        // The HOST LOCALE is passed too — it was omitted, so grouping and the
        // decimal separator were the JS engine default rather than the
        // report's, which is the other half of "complete model-format
        // handling" (NEXUS cycle-08 §5). KPI Card already passes it.
        return formatModelNumber(n, format, this.host?.locale);
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        this.formattingSettings.codexTheme.reveal();
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    public destroy(): void {
        // Drop the in-flight licence check FIRST: its redraw callback replays
        // update() against a torn-down target otherwise (NEXUS lifecycle finding).
        this.licenseGate.dispose();
        this.disposed = true;
        this.cardEvents.abort();

        // Unregister the listeners this visual OWNS, using the same function
        // objects it registered — an inline arrow is unremovable, which is why
        // a destroyed wall still answered a right-click on the root and a
        // background click still reached the selection manager. Guarded because
        // destroy() must not throw whatever state the host is in.
        try {
            this.target?.removeEventListener("contextmenu", this.onContextMenu);
            this.rootDiv?.removeEventListener("click", this.onRootClick);
        } catch { /* nothing left to unregister */ }

        // Drop the caches those callbacks read, so nothing can replay a render
        // or attribute a stale identity, and retract any tooltip open at the
        // moment of teardown.
        this.lastUpdateOptions = null;
        this.cardEls = [];
        this.cardIds = [];
        this.cardKeys = [];
        this.cardBaseBorder = [];
        this.selectedKeys.clear();
        this.selectedIdx.clear();
        try {
            this.tooltipService?.hide({ isTouchEvent: false, immediately: true });
        } catch { /* host service already gone */ }

        // destroy() removed the cells but left the two outer signature elements
        // attached to the host element (NEXUS cycle-08 §10, receipt
        // `afterDestroy.signatures: 2`). The signature handle owns them.
        try {
            this.cornerSignature?.destroy();
        } catch { /* already detached */ }
        this.cornerSignature = null;

        while (this.rootDiv && this.rootDiv.firstChild) this.rootDiv.removeChild(this.rootDiv.firstChild);
        this.rootDiv?.remove();
        this.rootDiv = null;
        this.target = null;
    }
}
