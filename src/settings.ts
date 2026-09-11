"use strict";

import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

import { BackgroundSettings } from "./shared/backgroundSettings";
import { BorderSettings } from "./shared/borderSettings";
import { CardSignatureSettings } from "./shared/cardSignatureSettings";
import { alignSlice } from "./shared/textFormatting";

const ConstantOrRule = powerbi.VisualEnumerationInstanceKinds.ConstantOrRule;

export function textAlignFor(v: string | undefined): string {
    return v === "center" || v === "right" ? v : "left";
}

/** Horizontal placement for a flex child, expressed as auto margins — the same
 *  idiom KPI Card uses for its label/pill/subtitle rows. */
export function marginsFor(v: string | undefined): { left: string; right: string } {
    return {
        left: v === "left" || v === undefined ? "0" : "auto",
        right: v === "center" ? "auto" : "0",
    };
}

class TitleSettingsCard extends FormattingSettingsCard {
    showTitle = new formattingSettings.ToggleSwitch({ name: "showTitle", displayName: "Show Title", value: false });
    titleText = new formattingSettings.TextInput({ name: "titleText", displayName: "Title Text", placeholder: "Visual title", value: "" });
    titleFontFamily = new formattingSettings.FontPicker({ name: "titleFontFamily", displayName: "Font Family", value: "Segoe UI, sans-serif" });
    titleFontSize = new formattingSettings.NumUpDown({ name: "titleFontSize", displayName: "Font Size", value: 14 });
    titleBold = new formattingSettings.ToggleSwitch({ name: "titleBold", displayName: "Bold", value: true });
    titleItalic = new formattingSettings.ToggleSwitch({ name: "titleItalic", displayName: "Italic", value: false });
    titleUnderline = new formattingSettings.ToggleSwitch({ name: "titleUnderline", displayName: "Underline", value: false });
    titleFont = new formattingSettings.FontControl({
        name: "titleFont", displayName: "Font",
        fontFamily: this.titleFontFamily, fontSize: this.titleFontSize,
        bold: this.titleBold, italic: this.titleItalic, underline: this.titleUnderline
    });
    titleAlign = new formattingSettings.AlignmentGroup({
        name: "titleAlign", displayName: "Alignment",
        mode: powerbi.visuals.AlignmentGroupMode.Horizonal, value: "left"
    });
    titleColor = new formattingSettings.ColorPicker({
        name: "titleColor", displayName: "Font Color",
        value: { value: "#1a1a2e" }, instanceKind: ConstantOrRule
    });
    name = "titleSettings"; displayName = "Visual Title";
    slices: FormattingSettingsSlice[] = [this.showTitle, this.titleText, this.titleFont, this.titleAlign, this.titleColor];
}

class KpiWallCard extends FormattingSettingsCard {
    accentStyle = new formattingSettings.ItemDropdown({
        name: "accentStyle", displayName: "Accent style",
        items: [
            { displayName: "Flat bar", value: "flatBar" },
            { displayName: "Glass tube", value: "glassTube" },
            { displayName: "Corner bracket", value: "cornerBracket" },
        ],
        value: { displayName: "Corner bracket", value: "cornerBracket" },
    });
    corners = new formattingSettings.ItemDropdown({
        name: "corners", displayName: "Corners",
        items: [
            { displayName: "One corner", value: "one" },
            { displayName: "Two corners", value: "two" },
        ],
        value: { displayName: "Two corners", value: "two" },
    });
    showDot = new formattingSettings.ToggleSwitch({ name: "showDot", displayName: "Status dot", value: true });
    showPill = new formattingSettings.ToggleSwitch({ name: "showPill", displayName: "Delta pill", value: true });
    showSub = new formattingSettings.ToggleSwitch({ name: "showSub", displayName: "Target line", value: true });
    showStrip = new formattingSettings.ToggleSwitch({ name: "showStrip", displayName: "Target strip", value: true });
    // WALL vs CELL signature (NEXUS cycle-08 parity gap 7): turning off the
    // outer Card Signature never turned off each cell's own accent, and there
    // was no control that did. This is the CELL one; "Card Signature > Show"
    // remains the wall's own outer signature. Default true = today's render.
    showAccent = new formattingSettings.ToggleSwitch({
        name: "showAccent", displayName: "Cell accent",
        description: "The accent on each card. The wall's own outer signature is the separate Card Signature card.",
        value: true,
    });
    name = "kpiWall"; displayName = "KPI Wall";
    slices: FormattingSettingsSlice[] = [
        this.accentStyle, this.corners, this.showAccent,
        this.showDot, this.showPill, this.showSub, this.showStrip,
    ];
}

class LayoutCard extends FormattingSettingsCard {
    columnsMode = new formattingSettings.ItemDropdown({
        name: "columnsMode", displayName: "Columns",
        items: [
            { displayName: "Auto-fit", value: "auto" },
            { displayName: "1", value: "1" }, { displayName: "2", value: "2" },
            { displayName: "3", value: "3" }, { displayName: "4", value: "4" },
            { displayName: "5", value: "5" }, { displayName: "6", value: "6" },
        ],
        value: { displayName: "Auto-fit", value: "auto" },
    });
    minCardWidth = new formattingSettings.NumUpDown({
        name: "minCardWidth", displayName: "Min card width", value: 240,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 120 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 600 },
        },
    });
    cardGap = new formattingSettings.NumUpDown({
        name: "cardGap", displayName: "Gap", value: 14,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 60 },
        },
    });
    name = "layout"; displayName = "Layout";
    slices: FormattingSettingsSlice[] = [this.columnsMode, this.minCardWidth, this.cardGap];
}

class ValueStyleCard extends FormattingSettingsCard {
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font Family", value: "Segoe UI, sans-serif" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Font Size", description: "0 = automatic (board 42)", value: 0 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: true });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Italic", value: false });
    underline = new formattingSettings.ToggleSwitch({ name: "underline", displayName: "Underline", value: false });
    font = new formattingSettings.FontControl({
        name: "valueFont", displayName: "Font",
        fontFamily: this.fontFamily, fontSize: this.fontSize, bold: this.bold, italic: this.italic,
        underline: this.underline
    });
    color = new formattingSettings.ColorPicker({
        name: "color", displayName: "Color",
        description: "Blank = automatic (theme token)",
        value: { value: "" }, instanceKind: ConstantOrRule,
    });
    name = "valueStyle"; displayName = "Value";
    slices: FormattingSettingsSlice[] = [this.font, this.color];
}

class LabelStyleCard extends FormattingSettingsCard {
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font Family", value: "Segoe UI, sans-serif" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Font Size", description: "0 = automatic (board 10.5)", value: 0 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: false });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Italic", value: false });
    underline = new formattingSettings.ToggleSwitch({ name: "underline", displayName: "Underline", value: false });
    font = new formattingSettings.FontControl({
        name: "labelFont", displayName: "Font",
        fontFamily: this.fontFamily, fontSize: this.fontSize, bold: this.bold, italic: this.italic,
        underline: this.underline
    });
    color = new formattingSettings.ColorPicker({
        name: "color", displayName: "Color",
        description: "Blank = automatic (theme token)",
        value: { value: "" }, instanceKind: ConstantOrRule,
    });
    uppercase = new formattingSettings.ToggleSwitch({ name: "uppercase", displayName: "Uppercase", value: true });
    labelAlign = alignSlice("labelAlign", "left");
    name = "labelStyle"; displayName = "Label";
    slices: FormattingSettingsSlice[] = [this.font, this.color, this.uppercase, this.labelAlign];
}

// ─── Value Format (KPI Card parity, NEXUS cycle-08 parity gap 4) ────────────
// Wall coerces to a number and renders the measure's own model format, with no
// format-pane equivalent of Card's format type / precision / currency, and no
// text headline at all. These are ADDITIVE: "Model format" is the default and
// is the wall's existing behaviour verbatim, so no saved report moves.
// Typography stays on the Value card — this one owns FORMAT and alignment, so
// there are never two controls for one thing.
class ValueFormatCard extends FormattingSettingsCard {
    valueFormatType = new formattingSettings.ItemDropdown({
        name: "valueFormatType", displayName: "Format",
        description: "Model format uses the measure's own format string — the wall's existing behaviour.",
        items: [
            { displayName: "Model format", value: "auto" },
            { displayName: "Number", value: "number" },
            { displayName: "Percent", value: "percent" },
            { displayName: "Currency", value: "currency" },
            { displayName: "Text", value: "text" },
        ],
        value: { displayName: "Model format", value: "auto" },
    });
    currencySymbol = new formattingSettings.TextInput({
        name: "currencySymbol", displayName: "Currency Symbol", placeholder: "$", value: "$",
    });
    decimalPlaces = new formattingSettings.NumUpDown({
        name: "decimalPlaces", displayName: "Decimal Places", value: 0,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 6 },
        },
    });
    valueAlign = alignSlice("valueAlign", "left");
    name = "valueFormat"; displayName = "Value Format";
    slices: FormattingSettingsSlice[] = [
        this.valueFormatType, this.currencySymbol, this.decimalPlaces, this.valueAlign,
    ];
}

// ─── Change Indicator (KPI Card parity, NEXUS cycle-08 parity gaps 1/2/6) ───
// The pill was ALWAYS value/target-1 under a fixed higher-is-better rule, so a
// cost, defect or elapsed-time KPI could not read a fall as good, and an
// independent prior-period comparison could not be shown at all. Direction
// Logic mirrors Card's property name and values exactly; "Up is Good" is the
// default and reproduces the existing band law.
class ChangeSettingsCard extends FormattingSettingsCard {
    changeDirection = new formattingSettings.ItemDropdown({
        name: "changeDirection", displayName: "Direction Logic",
        description: "Up is Good: above target / a rise is success. Down is Good: below target / a fall is success (cost, defects, elapsed time).",
        items: [
            { displayName: "Up is Good", value: "upIsGood" },
            { displayName: "Down is Good", value: "downIsGood" },
            { displayName: "Neutral", value: "neutral" },
        ],
        value: { displayName: "Up is Good", value: "upIsGood" },
    });
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font Family", value: "Segoe UI, sans-serif" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Font Size", description: "0 = automatic (board 12.5)", value: 0 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: true });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Italic", value: false });
    underline = new formattingSettings.ToggleSwitch({ name: "underline", displayName: "Underline", value: false });
    font = new formattingSettings.FontControl({
        name: "changeFont", displayName: "Font",
        fontFamily: this.fontFamily, fontSize: this.fontSize, bold: this.bold, italic: this.italic,
        underline: this.underline
    });
    changeAlign = alignSlice("changeAlign", "left");
    name = "changeSettings"; displayName = "Change Indicator";
    slices: FormattingSettingsSlice[] = [this.changeDirection, this.font, this.changeAlign];
}

// ─── Subtitle (KPI Card parity, NEXUS cycle-08 parity gap 6) ────────────────
// The cell's footer line ("vs/to target N", or the Change Label) had FIXED
// typography — a Card composition could not be reproduced by copying settings.
// Every default below is the current computed style, so nothing moves.
class SubtitleStyleCard extends FormattingSettingsCard {
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font Family", value: "Segoe UI, sans-serif" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Font Size", description: "0 = automatic (board 12.5)", value: 0 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: false });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Italic", value: false });
    underline = new formattingSettings.ToggleSwitch({ name: "underline", displayName: "Underline", value: false });
    font = new formattingSettings.FontControl({
        name: "subtitleFont", displayName: "Font",
        fontFamily: this.fontFamily, fontSize: this.fontSize, bold: this.bold, italic: this.italic,
        underline: this.underline
    });
    subtitleColor = new formattingSettings.ColorPicker({
        name: "subtitleColor", displayName: "Subtitle Colour",
        description: "Blank = automatic (theme token)",
        value: { value: "" }, instanceKind: ConstantOrRule,
    });
    subtitleAlign = alignSlice("subtitleAlign", "left");
    name = "subtitleStyle"; displayName = "Subtitle";
    slices: FormattingSettingsSlice[] = [this.font, this.subtitleColor, this.subtitleAlign];
}

// ─── Card Border (NEXUS cycle-08 parity gap 7) ─────────────────────────────
// Neil, 2026-09-10: "border isn't per card but the whole block of cards, we
// need both". The shared Border card paints the OUTSIDE of the wall; this one
// paints EACH card. Same five properties, same shared resolver — only the
// object name and the pane label differ. OFF by default, so an untouched
// report keeps the theme-token cell border and the 10px stylesheet radius.
class CellBorderSettings extends BorderSettings {
    name = "cellBorder";
    displayName = "Card Border";
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    kpiWall = new KpiWallCard();
    layout = new LayoutCard();
    valueStyle = new ValueStyleCard();
    valueFormat = new ValueFormatCard();
    labelStyle = new LabelStyleCard();
    changeSettings = new ChangeSettingsCard();
    subtitleStyle = new SubtitleStyleCard();
    titleSettings = new TitleSettingsCard();
    background = new BackgroundSettings();
    cardSignature = new CardSignatureSettings();
    cellBorder = new CellBorderSettings();
    visualBorder = new BorderSettings();

    cards = [
        this.kpiWall, this.layout,
        this.valueStyle, this.valueFormat, this.labelStyle,
        this.changeSettings, this.subtitleStyle,
        this.titleSettings, this.background, this.cardSignature,
        this.cellBorder, this.visualBorder,
    ];
}
