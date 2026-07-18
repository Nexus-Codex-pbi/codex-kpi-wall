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

class LayoutCard extends FormattingSettingsCard {
    columnsMode = new formattingSettings.ItemDropdown({
        name: "columnsMode", displayName: "Columns",
        items: [
            { displayName: "Auto-fit", value: "auto" },
            { displayName: "1", value: "1" }, { displayName: "2", value: "2" },
            { displayName: "3", value: "3" }, { displayName: "4", value: "4" },
            { displayName: "5", value: "5" }, { displayName: "6", value: "6" }
        ],
        value: { displayName: "Auto-fit", value: "auto" }
    });
    minCardWidth = new formattingSettings.NumUpDown({ name: "minCardWidth", displayName: "Min card width (px)", value: 180 });
    cardGap = new formattingSettings.NumUpDown({ name: "cardGap", displayName: "Gap (px)", value: 12 });
    outerPadding = new formattingSettings.NumUpDown({ name: "outerPadding", displayName: "Outer padding (px)", value: 0 });
    aspectRatio = new formattingSettings.ItemDropdown({
        name: "aspectRatio", displayName: "Aspect ratio",
        items: [
            { displayName: "Free", value: "free" },
            { displayName: "Square", value: "square" },
            { displayName: "Wide (16:9)", value: "wide" },
            { displayName: "Tall (3:4)", value: "tall" }
        ],
        value: { displayName: "Free", value: "free" }
    });
    name = "layout"; displayName = "Layout";
    slices: FormattingSettingsSlice[] = [this.columnsMode, this.minCardWidth, this.cardGap, this.outerPadding, this.aspectRatio];
}

class CardStyleCard extends FormattingSettingsCard {
    background = new formattingSettings.ColorPicker({ name: "background", displayName: "Background", value: { value: "#ffffff" }, instanceKind: ConstantOrRule });
    borderRadius = new formattingSettings.NumUpDown({ name: "borderRadius", displayName: "Border radius (px)", value: 8 });
    borderColor = new formattingSettings.ColorPicker({ name: "borderColor", displayName: "Border colour", value: { value: "#e8e6e0" }, instanceKind: ConstantOrRule });
    borderWidth = new formattingSettings.NumUpDown({ name: "borderWidth", displayName: "Border width (px)", value: 1 });
    shadow = new formattingSettings.ToggleSwitch({ name: "shadow", displayName: "Drop shadow", value: false });
    accentPosition = new formattingSettings.ItemDropdown({
        name: "accentPosition", displayName: "Accent stripe",
        items: [
            { displayName: "None", value: "none" },
            { displayName: "Top", value: "top" },
            { displayName: "Left", value: "left" },
            { displayName: "Bottom", value: "bottom" }
        ],
        value: { displayName: "Top", value: "top" }
    });
    accentWidth = new formattingSettings.NumUpDown({ name: "accentWidth", displayName: "Accent width (px)", value: 4 });
    cardPadding = new formattingSettings.NumUpDown({ name: "cardPadding", displayName: "Inner padding (px)", value: 16 });
    name = "cardStyle"; displayName = "Card Style";
    slices: FormattingSettingsSlice[] = [this.background, this.borderRadius, this.borderColor, this.borderWidth, this.shadow, this.accentPosition, this.accentWidth, this.cardPadding];
}

function alignSlice(name: string, defaultValue: string = "left") {
    return new formattingSettings.AlignmentGroup({
        name, displayName: "Alignment",
        mode: powerbi.visuals.AlignmentGroupMode.Horizonal,
        value: defaultValue
    });
}

class HeadlineStyleCard extends FormattingSettingsCard {
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font Family", value: "Segoe UI, sans-serif" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Font Size", value: 28 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: true });
    italic = new formattingSettings.ToggleSwitch({ name: "italic", displayName: "Italic", value: false });
    font = new formattingSettings.FontControl({
        name: "headlineFont", displayName: "Font",
        fontFamily: this.fontFamily, fontSize: this.fontSize, bold: this.bold, italic: this.italic
    });
    color = new formattingSettings.ColorPicker({ name: "color", displayName: "Color", value: { value: "#1a1a2e" }, instanceKind: ConstantOrRule });
    useAccentColor = new formattingSettings.ToggleSwitch({ name: "useAccentColor", displayName: "Use accent colour", value: false });
    align = alignSlice("align", "left");
    name = "headlineStyle"; displayName = "Headline Value";
    slices: FormattingSettingsSlice[] = [this.font, this.color, this.useAccentColor, this.align];
}

class LabelStyleCard extends FormattingSettingsCard {
    fontFamily = new formattingSettings.FontPicker({ name: "fontFamily", displayName: "Font Family", value: "Segoe UI, sans-serif" });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Font Size", value: 11 });
    bold = new formattingSettings.ToggleSwitch({ name: "bold", displayName: "Bold", value: false });
    font = new formattingSettings.FontControl({
        name: "labelFont", displayName: "Font",
        fontFamily: this.fontFamily, fontSize: this.fontSize, bold: this.bold
    });
    color = new formattingSettings.ColorPicker({ name: "color", displayName: "Color", value: { value: "#5e5d5a" }, instanceKind: ConstantOrRule });
    uppercase = new formattingSettings.ToggleSwitch({ name: "uppercase", displayName: "Uppercase", value: true });
    align = alignSlice("align", "left");
    name = "labelStyle"; displayName = "Card Label";
    slices: FormattingSettingsSlice[] = [this.font, this.color, this.uppercase, this.align];
}

class SubtitleStyleCard extends FormattingSettingsCard {
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Font Size", value: 11 });
    color = new formattingSettings.ColorPicker({ name: "color", displayName: "Color", value: { value: "#7a7773" }, instanceKind: ConstantOrRule });
    align = alignSlice("align", "left");
    name = "subtitleStyle"; displayName = "Subtitle";
    slices: FormattingSettingsSlice[] = [this.fontSize, this.color, this.align];
}

class ChangeStyleCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show", value: true });
    fontSize = new formattingSettings.NumUpDown({ name: "fontSize", displayName: "Font Size", value: 11 });
    positiveColor = new formattingSettings.ColorPicker({ name: "positiveColor", displayName: "Positive colour", value: { value: "#107c10" }, instanceKind: ConstantOrRule });
    negativeColor = new formattingSettings.ColorPicker({ name: "negativeColor", displayName: "Negative colour", value: { value: "#c50f1f" }, instanceKind: ConstantOrRule });
    neutralColor = new formattingSettings.ColorPicker({ name: "neutralColor", displayName: "Neutral colour", value: { value: "#7a7773" }, instanceKind: ConstantOrRule });
    upIsGood = new formattingSettings.ToggleSwitch({ name: "upIsGood", displayName: "Up is good", value: true });
    showArrow = new formattingSettings.ToggleSwitch({ name: "showArrow", displayName: "Show arrow", value: true });
    align = alignSlice("align", "left");
    name = "changeStyle"; displayName = "Change Pill";
    slices: FormattingSettingsSlice[] = [this.show, this.fontSize, this.positiveColor, this.negativeColor, this.neutralColor, this.upIsGood, this.showArrow, this.align];
}

class ImageStyleCard extends FormattingSettingsCard {
    show = new formattingSettings.ToggleSwitch({ name: "show", displayName: "Show", value: true });
    position = new formattingSettings.ItemDropdown({
        name: "position", displayName: "Position",
        items: [
            { displayName: "Top", value: "top" },
            { displayName: "Left", value: "left" },
            { displayName: "Right", value: "right" },
            { displayName: "Background", value: "background" }
        ],
        value: { displayName: "Top", value: "top" }
    });
    size = new formattingSettings.NumUpDown({ name: "size", displayName: "Size (px)", value: 48 });
    shape = new formattingSettings.ItemDropdown({
        name: "shape", displayName: "Shape",
        items: [
            { displayName: "Square", value: "square" },
            { displayName: "Rounded", value: "rounded" },
            { displayName: "Circle", value: "circle" }
        ],
        value: { displayName: "Rounded", value: "rounded" }
    });
    fit = new formattingSettings.ItemDropdown({
        name: "fit", displayName: "Fit",
        items: [
            { displayName: "Contain", value: "contain" },
            { displayName: "Cover", value: "cover" }
        ],
        value: { displayName: "Contain", value: "contain" }
    });
    opacity = new formattingSettings.NumUpDown({ name: "opacity", displayName: "Opacity (background only, 0-100)", value: 25 });
    name = "imageStyle"; displayName = "Card Image";
    slices: FormattingSettingsSlice[] = [this.show, this.position, this.size, this.shape, this.fit, this.opacity];
}

class AnimationCard extends FormattingSettingsCard {
    enable = new formattingSettings.ToggleSwitch({ name: "enable", displayName: "Enable", value: true });
    staggerMs = new formattingSettings.NumUpDown({ name: "staggerMs", displayName: "Stagger (ms)", value: 60 });
    name = "animation"; displayName = "Animation";
    slices: FormattingSettingsSlice[] = [this.enable, this.staggerMs];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    titleSettings = new TitleSettingsCard();
    layout = new LayoutCard();
    cardStyle = new CardStyleCard();
    headlineStyle = new HeadlineStyleCard();
    labelStyle = new LabelStyleCard();
    subtitleStyle = new SubtitleStyleCard();
    changeStyle = new ChangeStyleCard();
    imageStyle = new ImageStyleCard();
    animation = new AnimationCard();
    background = new BackgroundSettings();
    cardSignature = new CardSignatureSettings();
    visualBorder = new BorderSettings();
    cards = [
        this.titleSettings, this.layout, this.cardStyle,
        this.headlineStyle, this.labelStyle, this.subtitleStyle,
        this.changeStyle, this.imageStyle, this.animation,
        this.background, this.cardSignature, this.visualBorder
    ];
}
