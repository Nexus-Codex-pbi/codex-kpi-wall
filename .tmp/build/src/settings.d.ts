import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;
import { BackgroundSettings } from "./shared/backgroundSettings";
import { BorderSettings } from "./shared/borderSettings";
import { CardSignatureSettings } from "./shared/cardSignatureSettings";
export declare function textAlignFor(v: string | undefined): string;
declare class TitleSettingsCard extends FormattingSettingsCard {
    showTitle: formattingSettings.ToggleSwitch;
    titleText: formattingSettings.TextInput;
    titleFontFamily: formattingSettings.FontPicker;
    titleFontSize: formattingSettings.NumUpDown;
    titleBold: formattingSettings.ToggleSwitch;
    titleItalic: formattingSettings.ToggleSwitch;
    titleUnderline: formattingSettings.ToggleSwitch;
    titleFont: formattingSettings.FontControl;
    titleAlign: formattingSettings.AlignmentGroup;
    titleColor: formattingSettings.ColorPicker;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
declare class KpiWallCard extends FormattingSettingsCard {
    accentStyle: formattingSettings.ItemDropdown;
    corners: formattingSettings.ItemDropdown;
    showDot: formattingSettings.ToggleSwitch;
    showPill: formattingSettings.ToggleSwitch;
    showSub: formattingSettings.ToggleSwitch;
    showStrip: formattingSettings.ToggleSwitch;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
declare class LayoutCard extends FormattingSettingsCard {
    columnsMode: formattingSettings.ItemDropdown;
    minCardWidth: formattingSettings.NumUpDown;
    cardGap: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
declare class ValueStyleCard extends FormattingSettingsCard {
    fontFamily: formattingSettings.FontPicker;
    fontSize: formattingSettings.NumUpDown;
    bold: formattingSettings.ToggleSwitch;
    italic: formattingSettings.ToggleSwitch;
    font: formattingSettings.FontControl;
    color: formattingSettings.ColorPicker;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
declare class LabelStyleCard extends FormattingSettingsCard {
    fontFamily: formattingSettings.FontPicker;
    fontSize: formattingSettings.NumUpDown;
    bold: formattingSettings.ToggleSwitch;
    italic: formattingSettings.ToggleSwitch;
    font: formattingSettings.FontControl;
    color: formattingSettings.ColorPicker;
    uppercase: formattingSettings.ToggleSwitch;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
export declare class VisualFormattingSettingsModel extends FormattingSettingsModel {
    kpiWall: KpiWallCard;
    layout: LayoutCard;
    valueStyle: ValueStyleCard;
    labelStyle: LabelStyleCard;
    titleSettings: TitleSettingsCard;
    background: BackgroundSettings;
    cardSignature: CardSignatureSettings;
    visualBorder: BorderSettings;
    cards: (KpiWallCard | LayoutCard | ValueStyleCard | LabelStyleCard | TitleSettingsCard | BackgroundSettings | CardSignatureSettings | BorderSettings)[];
}
export {};
