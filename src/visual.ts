"use strict";

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
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import ISandboxExtendedColorPalette = powerbi.extensibility.ISandboxExtendedColorPalette;
import DataView = powerbi.DataView;

import { VisualFormattingSettingsModel } from "./settings";

interface CardData {
    label: string;
    headline: number | null;
    headlineFormat: string | null;
    subtitle: string | null;
    change: number | null;
    changeFormat: string | null;
    direction: number | null;
    accent: string | null;
    image: string | null;
    sortOrder: number | null;
    widthSpan: number | null;
    heightSpan: number | null;
    selectionId: ISelectionId | null;
    tooltipItems: VisualTooltipDataItem[];
}

const DEFAULT_PALETTE = ["#d4920a", "#007064", "#1a73e8", "#c50f1f", "#7c4dff", "#0b8043"];

export class Visual implements IVisual {
    private host: IVisualHost;
    private target: HTMLElement;
    private rootDiv: HTMLDivElement;
    private events: IVisualEventService;
    private selectionManager: ISelectionManager;
    private tooltipService: ITooltipService;
    private localizationManager: ILocalizationManager;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private isHighContrast = false;
    private hcForeground = "";
    private hcBackground = "";

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.target = options.element;
        this.target.style.margin = "0";
        this.target.style.padding = "0";
        this.target.style.overflow = "hidden";
        this.events = options.host.eventService;
        this.selectionManager = this.host.createSelectionManager();
        this.tooltipService = options.host.tooltipService;
        this.localizationManager = this.host.createLocalizationManager();
        this.formattingSettingsService = new FormattingSettingsService();

        // Single context menu listener — Policy 1180.2.5 (MS sample BarChart pattern).
        this.target.addEventListener("contextmenu", (e: MouseEvent) => {
            this.selectionManager.showContextMenu({}, { x: e.clientX, y: e.clientY });
            e.preventDefault();
        });

        this.rootDiv = document.createElement("div");
        this.rootDiv.className = "kpi-wall-root";
        this.target.appendChild(this.rootDiv);

        // Allow deselection
        this.selectionManager.registerOnSelectCallback(() => { /* noop */ });
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
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

            // Clear root
            while (this.rootDiv.firstChild) this.rootDiv.removeChild(this.rootDiv.firstChild);

            // Title (always renders if enabled, even on landing — keeps cert in scope)
            this.renderTitle();

            const cards = dv ? this.parseCards(dv) : [];
            if (cards.length === 0) {
                this.renderEmpty();
                this.events.renderingFinished(options);
                return;
            }

            this.renderGrid(cards);
            this.events.renderingFinished(options);
        } catch (e) {
            this.events.renderingFailed(options, String(e));
        }
    }

    private renderTitle(): void {
        const t = this.formattingSettings.titleSettings;
        if (!t?.showTitle?.value || !t?.titleText?.value) return;
        const el = document.createElement("div");
        el.className = "kpi-wall-title";
        el.textContent = t.titleText.value;
        if (t.titleFontFamily?.value) el.style.fontFamily = t.titleFontFamily.value;
        if (t.titleFontSize?.value) el.style.fontSize = `${t.titleFontSize.value}px`;
        el.style.fontWeight = t.titleBold?.value ? "700" : "400";
        el.style.fontStyle = t.titleItalic?.value ? "italic" : "normal";
        el.style.textDecoration = t.titleUnderline?.value ? "underline" : "none";
        el.style.textAlign = (t.titleAlign?.value as string) || "left";
        const c = t.titleColor?.value?.value;
        if (c) el.style.color = this.isHighContrast ? this.hcForeground : c;
        this.rootDiv.appendChild(el);
    }

    private renderEmpty(): void {
        const wrap = document.createElement("div");
        wrap.className = "kpi-wall-empty";
        const h = document.createElement("div");
        h.className = "kpi-wall-empty-title";
        h.textContent = "Codex KPI Wall";
        const p = document.createElement("div");
        p.className = "kpi-wall-empty-body";
        p.textContent = "Add a Card label and a Headline value measure. Optional: Subtitle, Change value, Direction, Accent colour, Sort order.";
        wrap.appendChild(h);
        wrap.appendChild(p);
        this.rootDiv.appendChild(wrap);
    }

    private parseCards(dv: DataView): CardData[] {
        const cat = dv.categorical;
        if (!cat || !cat.categories || cat.categories.length === 0) return [];
        const labels = cat.categories[0];
        const valuesArr = cat.values || [];

        // Find each measure column by role
        const findCol = (role: string) => valuesArr.find(v => v.source.roles && v.source.roles[role]);
        const headlineCol = findCol("headline");
        const subtitleCol = findCol("subtitle");
        const changeCol = findCol("change");
        const directionCol = findCol("direction");
        const accentCol = findCol("accent");
        const sortCol = findCol("sortOrder");
        const imageCol = findCol("image");
        const widthSpanCol = findCol("widthSpan");
        const heightSpanCol = findCol("heightSpan");
        const tooltipCols = valuesArr.filter(v => v.source.roles && v.source.roles["tooltips"]);

        if (!headlineCol) return [];

        const cards: CardData[] = [];
        const n = labels.values?.length ?? 0;
        for (let i = 0; i < n; i++) {
            const label = String(labels.values[i] ?? "");
            const headlineRaw = headlineCol.values?.[i];
            const headline = (typeof headlineRaw === "number") ? headlineRaw : (headlineRaw == null ? null : Number(headlineRaw));

            const subtitleRaw = subtitleCol?.values?.[i];
            const subtitle = subtitleRaw == null ? null : String(subtitleRaw);

            const changeRaw = changeCol?.values?.[i];
            const change = (typeof changeRaw === "number") ? changeRaw : (changeRaw == null ? null : Number(changeRaw));

            const directionRaw = directionCol?.values?.[i];
            const direction = (typeof directionRaw === "number") ? directionRaw : (directionRaw == null ? null : Number(directionRaw));

            const accentRaw = accentCol?.values?.[i];
            let accent: string | null = null;
            if (accentRaw != null) {
                if (typeof accentRaw === "string" && accentRaw.startsWith("#")) accent = accentRaw;
                else if (typeof accentRaw === "number") accent = DEFAULT_PALETTE[Math.abs(Math.floor(accentRaw)) % DEFAULT_PALETTE.length];
                else accent = String(accentRaw);
            }
            if (!accent) accent = DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];

            const sortRaw = sortCol?.values?.[i];
            const sortOrder = (typeof sortRaw === "number") ? sortRaw : (sortRaw == null ? null : Number(sortRaw));

            const imageRaw = imageCol?.values?.[i];
            const image = imageRaw == null ? null : String(imageRaw);

            const widthRaw = widthSpanCol?.values?.[i];
            const widthSpan = (typeof widthRaw === "number") ? Math.max(1, Math.min(12, Math.floor(widthRaw))) : null;
            const heightRaw = heightSpanCol?.values?.[i];
            const heightSpan = (typeof heightRaw === "number") ? Math.max(1, Math.min(4, Math.floor(heightRaw))) : null;

            const selectionId = this.host.createSelectionIdBuilder()
                .withCategory(labels, i)
                .createSelectionId();

            const tooltipItems: VisualTooltipDataItem[] = [
                { displayName: "Card", value: label }
            ];
            if (headline != null) tooltipItems.push({ displayName: headlineCol.source.displayName, value: this.formatValue(headline, headlineCol.source.format) });
            if (subtitle != null) tooltipItems.push({ displayName: "Subtitle", value: subtitle });
            if (change != null) tooltipItems.push({ displayName: changeCol!.source.displayName, value: this.formatValue(change, changeCol!.source.format) });
            for (const tc of tooltipCols) {
                const v = tc.values?.[i];
                if (v != null) tooltipItems.push({ displayName: tc.source.displayName, value: this.formatValue(v as number, tc.source.format) });
            }

            cards.push({
                label,
                headline,
                headlineFormat: headlineCol.source.format ?? null,
                subtitle,
                change,
                changeFormat: changeCol?.source.format ?? null,
                direction,
                accent,
                image,
                sortOrder,
                widthSpan,
                heightSpan,
                selectionId,
                tooltipItems
            });
        }

        // Apply sort order
        if (cards.some(c => c.sortOrder != null)) {
            cards.sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
        }
        return cards;
    }

    private renderGrid(cards: CardData[]): void {
        const layout = this.formattingSettings.layout;
        const cardStyle = this.formattingSettings.cardStyle;
        const headline = this.formattingSettings.headlineStyle;
        const label = this.formattingSettings.labelStyle;
        const subtitle = this.formattingSettings.subtitleStyle;
        const change = this.formattingSettings.changeStyle;
        const anim = this.formattingSettings.animation;

        const colsMode = (layout.columnsMode.value as { value?: string })?.value || "auto";
        const minWidth = layout.minCardWidth.value ?? 180;
        const gap = layout.cardGap.value ?? 12;
        const outer = layout.outerPadding.value ?? 0;
        const aspect = (layout.aspectRatio.value as { value?: string })?.value || "free";

        const grid = document.createElement("div");
        grid.className = "kpi-wall-grid";
        grid.style.padding = `${outer}px`;
        grid.style.gap = `${gap}px`;
        if (colsMode === "auto") {
            grid.style.gridTemplateColumns = `repeat(auto-fit, minmax(${minWidth}px, 1fr))`;
        } else {
            grid.style.gridTemplateColumns = `repeat(${colsMode}, minmax(0, 1fr))`;
        }

        const aspectRatio = aspect === "square" ? "1 / 1"
            : aspect === "wide" ? "16 / 9"
            : aspect === "tall" ? "3 / 4"
            : "";

        const image = this.formattingSettings.imageStyle;

        cards.forEach((card, i) => {
            const cardEl = this.renderCard(card, i, cardStyle, headline, label, subtitle, change, image, aspectRatio);
            grid.appendChild(cardEl);

            if (anim.enable.value) {
                const stagger = Math.max(0, anim.staggerMs.value ?? 60);
                window.setTimeout(() => {
                    cardEl.classList.add("shine");
                    cardEl.addEventListener("animationend", () => cardEl.classList.remove("shine"), { once: true });
                }, i * stagger);
            }
        });

        this.rootDiv.appendChild(grid);
    }

    private renderCard(
        card: CardData,
        index: number,
        cs: VisualFormattingSettingsModel["cardStyle"],
        hs: VisualFormattingSettingsModel["headlineStyle"],
        ls: VisualFormattingSettingsModel["labelStyle"],
        ss: VisualFormattingSettingsModel["subtitleStyle"],
        chs: VisualFormattingSettingsModel["changeStyle"],
        ims: VisualFormattingSettingsModel["imageStyle"],
        aspectRatio: string
    ): HTMLDivElement {
        const accent = this.isHighContrast ? this.hcForeground : (card.accent || DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]);
        const bg = this.isHighContrast ? this.hcBackground : (cs.background.value.value || "#ffffff");
        const borderC = this.isHighContrast ? this.hcForeground : (cs.borderColor.value.value || "#e8e6e0");
        const align = (s: { value?: { value?: string } | string } | undefined): string => {
            const v = s && (typeof s.value === "string" ? s.value : (s.value as { value?: string })?.value);
            return v === "center" || v === "right" ? v : "left";
        };

        const cardEl = document.createElement("div");
        cardEl.className = "kpi-wall-card";
        cardEl.style.background = bg;
        cardEl.style.borderRadius = `${cs.borderRadius.value ?? 8}px`;
        cardEl.style.border = `${cs.borderWidth.value ?? 1}px solid ${borderC}`;
        cardEl.style.padding = `${cs.cardPadding.value ?? 16}px`;
        if (cs.shadow.value) cardEl.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
        if (aspectRatio) cardEl.style.aspectRatio = aspectRatio;

        // Per-card grid spans (optional, driven by widthSpan / heightSpan measures)
        if (card.widthSpan && card.widthSpan > 1) {
            cardEl.style.gridColumn = `span ${card.widthSpan}`;
        }
        if (card.heightSpan && card.heightSpan > 1) {
            cardEl.style.gridRow = `span ${card.heightSpan}`;
        }

        // Accent stripe
        const accentPos = (cs.accentPosition.value as { value?: string })?.value || "top";
        const accentW = cs.accentWidth.value ?? 4;
        if (accentPos !== "none") {
            const stripe = document.createElement("div");
            stripe.className = `kpi-wall-accent kpi-wall-accent-${accentPos}`;
            stripe.style.background = accent;
            if (accentPos === "top" || accentPos === "bottom") stripe.style.height = `${accentW}px`;
            else stripe.style.width = `${accentW}px`;
            cardEl.appendChild(stripe);
        }

        // Image (background mode applied here as absolute layer behind content)
        const imgPos = (ims.position.value as { value?: string })?.value || "top";
        const imgShape = (ims.shape.value as { value?: string })?.value || "rounded";
        const imgFit = (ims.fit.value as { value?: string })?.value || "contain";
        const imgSize = ims.size.value ?? 48;
        const showImage = ims.show.value && card.image;

        if (showImage && imgPos === "background") {
            const bgImg = document.createElement("div");
            bgImg.className = "kpi-wall-card-bgimage";
            bgImg.style.backgroundImage = `url("${card.image}")`;
            bgImg.style.backgroundSize = imgFit === "cover" ? "cover" : "contain";
            bgImg.style.opacity = String(Math.max(0, Math.min(100, ims.opacity.value ?? 25)) / 100);
            cardEl.appendChild(bgImg);
        }

        const buildImage = (): HTMLImageElement => {
            const img = document.createElement("img");
            img.src = card.image as string;
            img.alt = "";
            img.className = `kpi-wall-card-image kpi-wall-card-image-${imgShape}`;
            img.style.width = `${imgSize}px`;
            img.style.height = `${imgSize}px`;
            img.style.objectFit = imgFit;
            img.style.flex = "0 0 auto";
            return img;
        };

        // Content (label + headline + meta)
        const content = document.createElement("div");
        content.className = "kpi-wall-card-content";

        const labelEl = document.createElement("div");
        labelEl.className = "kpi-wall-card-label";
        labelEl.textContent = ls.uppercase.value ? card.label.toUpperCase() : card.label;
        if (ls.fontFamily.value) labelEl.style.fontFamily = ls.fontFamily.value;
        if (ls.fontSize.value) labelEl.style.fontSize = `${ls.fontSize.value}px`;
        labelEl.style.fontWeight = ls.bold.value ? "700" : "500";
        labelEl.style.color = this.isHighContrast ? this.hcForeground : (ls.color.value.value || "#5e5d5a");
        labelEl.style.textAlign = align(ls.align);
        content.appendChild(labelEl);

        const headlineEl = document.createElement("div");
        headlineEl.className = "kpi-wall-card-headline";
        headlineEl.textContent = card.headline == null ? "—" : this.formatValue(card.headline, card.headlineFormat);
        if (hs.fontFamily.value) headlineEl.style.fontFamily = hs.fontFamily.value;
        if (hs.fontSize.value) headlineEl.style.fontSize = `${hs.fontSize.value}px`;
        headlineEl.style.fontWeight = hs.bold.value ? "700" : "500";
        headlineEl.style.fontStyle = hs.italic.value ? "italic" : "normal";
        headlineEl.style.color = this.isHighContrast ? this.hcForeground
            : (hs.useAccentColor.value ? accent : (hs.color.value.value || "#1a1a2e"));
        headlineEl.style.textAlign = align(hs.align);
        content.appendChild(headlineEl);

        const metaRow = document.createElement("div");
        metaRow.className = "kpi-wall-card-meta";

        if (card.subtitle) {
            const subEl = document.createElement("div");
            subEl.className = "kpi-wall-card-subtitle";
            subEl.textContent = card.subtitle;
            if (ss.fontSize.value) subEl.style.fontSize = `${ss.fontSize.value}px`;
            subEl.style.color = this.isHighContrast ? this.hcForeground : (ss.color.value.value || "#7a7773");
            subEl.style.textAlign = align(ss.align);
            subEl.style.flex = "1 1 auto";
            metaRow.appendChild(subEl);
        }

        if (chs.show.value && card.change != null) {
            const dir = card.direction != null ? Math.sign(card.direction) : Math.sign(card.change);
            const upGood = chs.upIsGood.value;
            const semantic = dir > 0 ? (upGood ? "positive" : "negative")
                : dir < 0 ? (upGood ? "negative" : "positive")
                : "neutral";
            const pillColor = this.isHighContrast ? this.hcForeground
                : semantic === "positive" ? chs.positiveColor.value.value
                : semantic === "negative" ? chs.negativeColor.value.value
                : chs.neutralColor.value.value;

            const pillWrap = document.createElement("div");
            pillWrap.className = "kpi-wall-card-change-wrap";
            pillWrap.style.textAlign = align(chs.align);
            pillWrap.style.flex = "1 1 auto";

            const pill = document.createElement("span");
            pill.className = "kpi-wall-card-change";
            if (chs.fontSize.value) pill.style.fontSize = `${chs.fontSize.value}px`;
            pill.style.color = pillColor;
            pill.style.borderColor = pillColor;
            const arrow = chs.showArrow.value ? (dir > 0 ? "▲ " : dir < 0 ? "▼ " : "● ") : "";
            pill.textContent = `${arrow}${this.formatValue(card.change, card.changeFormat)}`;
            pillWrap.appendChild(pill);
            metaRow.appendChild(pillWrap);
        }
        content.appendChild(metaRow);

        // Layout the image relative to content
        if (showImage && imgPos === "top") {
            cardEl.appendChild(buildImage());
            cardEl.appendChild(content);
        } else if (showImage && (imgPos === "left" || imgPos === "right")) {
            const row = document.createElement("div");
            row.className = "kpi-wall-card-row";
            if (imgPos === "left") {
                row.appendChild(buildImage());
                row.appendChild(content);
            } else {
                row.appendChild(content);
                row.appendChild(buildImage());
            }
            cardEl.appendChild(row);
        } else {
            cardEl.appendChild(content);
        }

        // Interactions
        cardEl.addEventListener("mousemove", (e: MouseEvent) => {
            this.tooltipService.show({
                coordinates: [e.clientX, e.clientY],
                isTouchEvent: false,
                dataItems: card.tooltipItems,
                identities: card.selectionId ? [card.selectionId] : []
            });
        });
        cardEl.addEventListener("mouseleave", () => {
            this.tooltipService.hide({ isTouchEvent: false, immediately: false });
        });
        cardEl.addEventListener("click", (e: MouseEvent) => {
            if (card.selectionId) {
                this.selectionManager.select(card.selectionId, e.ctrlKey || e.metaKey);
            }
            e.stopPropagation();
        });

        return cardEl;
    }

    private formatValue(n: number, format: string | null): string {
        if (n == null || !isFinite(n)) return String(n ?? "");
        if (!format) return n.toLocaleString(undefined);
        if (format.indexOf("%") >= 0) {
            const m = format.match(/0\.(0+)%/);
            const dec = m ? m[1].length : 0;
            return `${(n * 100).toFixed(dec)}%`;
        }
        const cm = format.match(/^([^#0]*)(#[,#]*0(?:\.0+)?)/);
        if (cm && cm[1] && /[\$£€¥]/.test(cm[1])) {
            const sym = cm[1].trim();
            const dm = format.match(/\.([0]+)/);
            const dec = dm ? dm[1].length : 0;
            return `${sym}${n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
        }
        const dm = format.match(/\.([0#]+)/);
        const dec = dm ? dm[1].replace(/#/g, "").length : 0;
        return n.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    public destroy(): void {
        while (this.rootDiv && this.rootDiv.firstChild) this.rootDiv.removeChild(this.rootDiv.firstChild);
        this.rootDiv = null;
        this.target = null;
    }
}
