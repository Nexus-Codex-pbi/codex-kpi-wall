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

import { VisualFormattingSettingsModel, textAlignFor } from "./settings";

import { toRgba } from "./shared/colorHelpers";
import { Band, Theme, band, bandColor, accentToken } from "./shared/bandEngine";
import { surfaceTokens, mix } from "./shared/designTokens";
import { makeCornerBrackets, CardSignatureHandle } from "./shared/cardSignature";
import { applyCardSignature } from "./shared/cardSignatureSettings";
import { applyBorder } from "./shared/borderSettings";
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

interface CardData {
    label: string;
    value: number | null;
    target: number | null;
    highlight: number | null;
    sortOrder: number | null;
    valueFormat: string | null;
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
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private isHighContrast = false;
    private hcForeground = "";
    private hcBackground = "";
    private cornerSignature: CardSignatureHandle | null = null;
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
    /** DERIVED from selectedKeys against the current render order — never the
     *  store. Kept as a field because it is the thing the ring is drawn from. */
    private selectedIdx = new Set<number>();

    private licenseGate: LicenseGate;

    private lastUpdateOptions: VisualUpdateOptions | null = null;
    private disposed = false;

    /** Held so destroy() can unregister the SAME function objects. */
    private onRootClick: (e: MouseEvent) => void;
    private onContextMenu: (e: MouseEvent) => void;
    /** Each rendered cell's selection identity, in render order — the context
     *  menu and the keyboard path both resolve a cell through this. */
    private cardIds: ISelectionId[] = [];


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

            while (this.rootDiv.firstChild) this.rootDiv.removeChild(this.rootDiv.firstChild);
            // The per-cell registers are rebuilt together with the cells — a
            // stale identity or border colour left over from the previous
            // render would be attributed to whatever now sits at that index.
            this.cardEls = [];
            this.cardIds = [];
            this.cardBaseBorder = [];
            this.cardKeys = [];

            // ── Theme + suite chrome ──
            const background = this.formattingSettings.background;
            const bgHex = background.backgroundColor.value?.value ?? "#ffffff";
            const bgTransparencyPct = background.transparency.value ?? 100;
            const theme: Theme = themeFor(bgHex);
            this.target.style.background = this.isHighContrast
                ? this.hcBackground : toRgba(bgHex, bgTransparencyPct);
            applyBorder(this.target, this.formattingSettings.visualBorder, {
                hcActive: this.isHighContrast,
                hcColor: this.hcForeground,
                palette: this.host.colorPalette,
                metadataObjects: undefined,
            });
            applyCardSignature(this.cornerSignature, this.formattingSettings.cardSignature, {
                autoHex: accentToken(theme),
                hcActive: this.isHighContrast,
                hcColor: this.hcForeground,
                mirror: true,
                glowMix: this.isHighContrast ? 0 : (theme === "dark" ? 55 : 0),
                muted: false,
            });

            this.renderTitle(theme);

            this.highlightActive = !!dv?.categorical?.values?.find(
                v => v.source.roles && v.source.roles["value"])?.highlights;

            const cards = dv ? this.parseCards(dv) : [];
            if (cards.length === 0) {
                this.renderEmpty(theme);
                this.events.renderingFinished(options);
                return;
            }

            this.renderGrid(cards, theme);
            this.applySelectionRing();

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
            const sortOrder = num(sortCol?.values?.[i]);
            const changeValue = num(changeCol?.values?.[i]);
            // The change measure follows the SAME population as the headline
            // under a cross-highlight (NEXUS cycle-08 §1) — one cell, one
            // reading, everywhere.
            const changeHighlight = num(changeCol?.highlights?.[i]);
            const rawChangeLabel = changeLabelCol?.values?.[i];
            const changeLabel = rawChangeLabel == null ? null : String(rawChangeLabel);
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
            const highlighting = this.highlightActive && highlight != null;
            const reading = highlighting ? highlight : value;
            if (reading != null) tooltipItems.push({ displayName: valueCol.source.displayName, value: this.formatValue(reading, fmt) });
            if (highlighting && value != null && value !== highlight) {
                tooltipItems.push({ displayName: `${valueCol.source.displayName} (unfiltered)`, value: this.formatValue(value, fmt) });
            }
            if (target != null) tooltipItems.push({ displayName: targetCol!.source.displayName, value: this.formatValue(target, targetFormat ?? fmt) });
            const changeReading = (this.highlightActive && changeHighlight != null) ? changeHighlight : changeValue;
            if (changeReading != null) {
                tooltipItems.push({
                    displayName: changeCol!.source.displayName,
                    value: changeLabel ?? this.formatChange(changeReading, changeFormat),
                });
            }
            for (const tc of tooltipCols) {
                const tv = tc.values?.[i];
                if (tv != null) tooltipItems.push({ displayName: tc.source.displayName, value: this.formatValue(tv as number, tc.source.format ?? null) });
            }

            out.push({
                label, value, target, highlight, sortOrder, valueFormat: fmt, targetFormat,
                changeValue, changeHighlight, changeLabel, changeFormat,
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
        return (this.highlightActive && card.changeHighlight != null) ? card.changeHighlight : card.changeValue;
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

    private renderGrid(cards: CardData[], theme: Theme): void {
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
        cards.forEach((card, i) => grid.appendChild(this.renderCard(card, i, theme)));
        this.rootDiv.appendChild(grid);
    }

    private renderCard(card: CardData, index: number, theme: Theme): HTMLDivElement {
        const kw = this.formattingSettings.kpiWall;
        const vs = this.formattingSettings.valueStyle;
        const ls = this.formattingSettings.labelStyle;
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
        const isEmpty = reading == null;
        const hasTarget = card.target != null && card.target > 0;
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
        // Keyboard focus ring colour — a painted surface, so it takes the
        // system foreground slot under high contrast (NEXUS cycle-08 §9).
        const focusRing = hc ? this.hcForeground : accentToken(theme);

        const el = document.createElement("div");
        el.className = `kw-card kw-${accentStyle}`;
        el.style.background = hc ? this.hcBackground : surf.card;
        const baseBorderColor = hc ? this.hcForeground : surf.border;
        el.style.border = `${hc ? 2 : 1}px solid ${baseBorderColor}`;
        this.cardEls[index] = el;
        this.cardBaseBorder[index] = baseBorderColor;
        this.cardIds[index] = card.selectionId;

        if (this.highlightActive && card.highlight == null) el.style.opacity = "0.35";

        // Accent (board .k2bar): flat = gradient bar, glassTube = rounded
        // gradient tube + CSS highlight, cornerBracket = border corners.
        const bar = document.createElement("div");
        bar.className = "kw-bar";
        if (accentStyle === "cornerBracket") {
            bar.style.borderColor = bandHex;
            if (glow) bar.style.filter = `drop-shadow(0 0 6px ${toRgba(bandHex, 40)})`;
        } else {
            bar.style.background =
                `linear-gradient(180deg, ${mix("#ffffff", bandHex, 0.55)}, ${bandHex} 45%, ${mix("#000000", bandHex, 0.70)})`;
            if (glow) bar.style.boxShadow = `0 0 10px ${toRgba(bandHex, 40)}`;
        }
        el.appendChild(bar);
        if (twoCorners) {
            const c2 = document.createElement("div");
            c2.className = "kw-corner2";
            c2.style.borderColor = bandHex;
            if (glow) c2.style.filter = `drop-shadow(0 0 6px ${toRgba(bandHex, 40)})`;
            el.appendChild(c2);
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
        if (ls.fontFamily.value) eye.style.fontFamily = ls.fontFamily.value;
        if (ls.fontSize.value) eye.style.fontSize = `${ls.fontSize.value}px`;
        eye.style.fontWeight = ls.bold.value ? "700" : "600";
        eye.style.fontStyle = ls.italic.value ? "italic" : "normal";
        eye.style.color = hc ? this.hcForeground : (ls.color.value?.value || surf.muted);
        head.appendChild(eye);
        if (kw.showDot.value) {
            const dot = document.createElement("span");
            dot.className = "kw-dot";
            dot.style.background = hc ? this.hcForeground
                : `radial-gradient(circle at 35% 30%, ${mix("#ffffff", bandHex, 0.35)}, ${bandHex} 55%, ${mix("#000000", bandHex, 0.55)})`;
            if (glow) dot.style.boxShadow = `0 0 8px ${toRgba(bandHex, 40)}`;
            head.appendChild(dot);
        }
        el.appendChild(head);

        // Per-cell empty state (board .k2.nd) — value missing in the filter.
        if (isEmpty) {
            el.classList.add("kw-nd");
            bar.style.background = hc ? this.hcForeground : surf.muted;
            bar.style.opacity = "0.35";
            bar.style.boxShadow = "none";
            const ndv = document.createElement("div");
            ndv.className = "kw-ndv";
            ndv.style.color = hc ? this.hcForeground : surf.muted;
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
        val.textContent = this.formatValue(reading, card.valueFormat);
        if (vs.fontFamily.value) val.style.fontFamily = vs.fontFamily.value;
        if (vs.fontSize.value) val.style.fontSize = `${vs.fontSize.value}px`;
        val.style.fontWeight = vs.bold.value ? "700" : "500";
        val.style.fontStyle = vs.italic.value ? "italic" : "normal";
        val.style.color = hc ? this.hcForeground : (vs.color.value?.value || surf.text);
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
        const pillOn = kw.showPill.value && (hasChange || hasTarget);
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
                pill.style.color = pillHex;
                pill.style.background = hc ? "transparent" : toRgba(pillHex, 85);
                if (hc) pill.style.border = `1px solid ${this.hcForeground}`;
                pill.textContent = pillText;
                foot.appendChild(pill);
            }
            if (subOn) {
                const sub = document.createElement("span");
                sub.className = "kw-sub";
                sub.style.color = hc ? this.hcForeground : surf.muted;
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
                    seg.style.background = bandHex;
                    if (glow) seg.style.boxShadow = `0 0 5px ${toRgba(bandHex, 40)}`;
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
                    .then((ids: ISelectionId[]) => this.setSelectedKeys(ids));
            } else if (key === "ContextMenu" || (e.shiftKey && key === "F10")) {
                e.preventDefault();
                e.stopPropagation();
                const rect = el.getBoundingClientRect();
                this.selectionManager.showContextMenu(card.selectionId, {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                });
            }
        });
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
        });
        el.addEventListener("blur", () => {
            this.tooltipService.hide({ isTouchEvent: false, immediately: false });
        });

        el.addEventListener("mousemove", (e: MouseEvent) => {
            this.tooltipService.show({
                coordinates: [e.clientX, e.clientY],
                isTouchEvent: false,
                dataItems: card.tooltipItems,
                identities: [card.selectionId],
            });
        });
        el.addEventListener("mouseleave", () => {
            this.tooltipService.hide({ isTouchEvent: false, immediately: false });
        });
        el.addEventListener("click", (e: MouseEvent) => {
            const multi = e.ctrlKey || e.metaKey;
            // The selection manager's answer is authoritative — the old
            // index bookkeeping re-derived it and drifted as soon as the rows
            // were sorted (NEXUS cycle-08 §2).
            this.selectionManager.select(card.selectionId, multi).then((ids: ISelectionId[]) => {
                this.setSelectedKeys(ids);
            });
            e.stopPropagation();
        });
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
        this.selectedKeys = new Set((ids || []).map(id => this.keyOf(id)).filter(k => k !== ""));
        this.applySelectionRing();
    }

    /** Rebuild local selection from whatever the host currently holds. */
    private syncSelectionFromHost(): void {
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
        const theme = themeFor(this.formattingSettings?.background?.backgroundColor?.value?.value ?? "#ffffff");
        const acc = this.isHighContrast ? this.hcForeground : accentToken(theme);
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
            el.style.boxShadow = sel
                ? `0 0 0 1px ${acc}${theme === "dark" && !this.isHighContrast ? `, 0 0 18px ${toRgba(acc, 70)}` : ""}`
                : "";
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

    private renderTitle(theme: Theme): void {
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
        // Untouched default ink flips to the dark-theme token (suite sentinel).
        const set = t.titleColor?.value?.value;
        const c = set === "#1a1a2e" && theme === "dark" ? surfaceTokens("dark").text : set;
        if (c) el.style.color = this.isHighContrast ? this.hcForeground : c;
        this.rootDiv.appendChild(el);
    }

    // Landing state — fills the body so right-click reaches our DOM
    // regardless of which region the cert reviewer hits.
    private renderEmpty(theme: Theme): void {
        const surf = surfaceTokens(theme);
        const wrap = document.createElement("div");
        wrap.className = "codex-visual-empty";
        const h = document.createElement("div");
        h.className = "codex-visual-empty-title";
        h.style.color = this.isHighContrast ? this.hcForeground : surf.text;
        h.textContent = "Codex KPI Wall";
        const p = document.createElement("div");
        p.className = "codex-visual-empty-body";
        p.style.color = this.isHighContrast ? this.hcForeground : surf.muted;
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
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    public destroy(): void {
        // Drop the in-flight licence check FIRST: its redraw callback replays
        // update() against a torn-down target otherwise (NEXUS lifecycle finding).
        this.licenseGate.dispose();
        this.disposed = true;

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
