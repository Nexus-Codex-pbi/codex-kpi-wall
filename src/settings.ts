"use strict";

import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;

import { BackgroundSettings } from "./shared/backgroundSettings";
import { BorderSettings } from "./shared/borderSettings";
import { CardSignatureSettings } from "./shared/cardSignatureSettings";

const ConstantOrRule = powerbi.VisualEnumerationInstanceKinds.ConstantOrRule;

export function textAlignFor(v: string | undefined): string {
    return v === "center" || v === "right" ? v : "left";
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
    name = "kpiWall"; displayName = "KPI Wall";
    slices: FormattingSettingsSlice[] = [
        this.accentStyle, this.corners,
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
    font = new formattingSettings.FontControl({
        name: "valueFont", displayName: "Font",
        fontFamily: this.fontFamily, fontSize: this.fontSize, bold: this.bold, italic: this.italic
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
    font = new formattingSettings.FontControl({
        name: "labelFont", displayName: "Font",
        fontFamily: this.fontFamily, fontSize: this.fontSize, bold: this.bold, italic: this.italic
    });
    color = new formattingSettings.ColorPicker({
        name: "color", displayName: "Color",
        description: "Blank = automatic (theme token)",
        value: { value: "" }, instanceKind: ConstantOrRule,
    });
    uppercase = new formattingSettings.ToggleSwitch({ name: "uppercase", displayName: "Uppercase", value: true });
    name = "labelStyle"; displayName = "Label";
    slices: FormattingSettingsSlice[] = [this.font, this.color, this.uppercase];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    kpiWall = new KpiWallCard();
    layout = new LayoutCard();
    valueStyle = new ValueStyleCard();
    labelStyle = new LabelStyleCard();
    titleSettings = new TitleSettingsCard();
    background = new BackgroundSettings();
    cardSignature = new CardSignatureSettings();
    visualBorder = new BorderSettings();

    cards = [
        this.kpiWall, this.layout, this.valueStyle, this.labelStyle,
        this.titleSettings, this.background, this.cardSignature, this.visualBorder,
    ];
}
