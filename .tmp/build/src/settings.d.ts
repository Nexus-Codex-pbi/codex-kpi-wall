import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
import FormattingSettingsModel = formattingSettings.Model;
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
declare class LayoutCard extends FormattingSettingsCard {
    columnsMode: formattingSettings.ItemDropdown;
    minCardWidth: formattingSettings.NumUpDown;
    cardGap: formattingSettings.NumUpDown;
    outerPadding: formattingSettings.NumUpDown;
    aspectRatio: formattingSettings.ItemDropdown;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
declare class CardStyleCard extends FormattingSettingsCard {
    background: formattingSettings.ColorPicker;
    borderRadius: formattingSettings.NumUpDown;
    borderColor: formattingSettings.ColorPicker;
    borderWidth: formattingSettings.NumUpDown;
    shadow: formattingSettings.ToggleSwitch;
    accentPosition: formattingSettings.ItemDropdown;
    accentWidth: formattingSettings.NumUpDown;
    cardPadding: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
declare class HeadlineStyleCard extends FormattingSettingsCard {
    fontFamily: formattingSettings.FontPicker;
    fontSize: formattingSettings.NumUpDown;
    bold: formattingSettings.ToggleSwitch;
    italic: formattingSettings.ToggleSwitch;
    font: formattingSettings.FontControl;
    color: formattingSettings.ColorPicker;
    useAccentColor: formattingSettings.ToggleSwitch;
    align: formattingSettings.AlignmentGroup;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
declare class LabelStyleCard extends FormattingSettingsCard {
    fontFamily: formattingSettings.FontPicker;
    fontSize: formattingSettings.NumUpDown;
    bold: formattingSettings.ToggleSwitch;
    font: formattingSettings.FontControl;
    color: formattingSettings.ColorPicker;
    uppercase: formattingSettings.ToggleSwitch;
    align: formattingSettings.AlignmentGroup;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
declare class SubtitleStyleCard extends FormattingSettingsCard {
    fontSize: formattingSettings.NumUpDown;
    color: formattingSettings.ColorPicker;
    align: formattingSettings.AlignmentGroup;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
declare class ChangeStyleCard extends FormattingSettingsCard {
    show: formattingSettings.ToggleSwitch;
    fontSize: formattingSettings.NumUpDown;
    positiveColor: formattingSettings.ColorPicker;
    negativeColor: formattingSettings.ColorPicker;
    neutralColor: formattingSettings.ColorPicker;
    upIsGood: formattingSettings.ToggleSwitch;
    showArrow: formattingSettings.ToggleSwitch;
    align: formattingSettings.AlignmentGroup;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
declare class ImageStyleCard extends FormattingSettingsCard {
    show: formattingSettings.ToggleSwitch;
    position: formattingSettings.ItemDropdown;
    size: formattingSettings.NumUpDown;
    shape: formattingSettings.ItemDropdown;
    fit: formattingSettings.ItemDropdown;
    opacity: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
declare class AnimationCard extends FormattingSettingsCard {
    enable: formattingSettings.ToggleSwitch;
    staggerMs: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    slices: FormattingSettingsSlice[];
}
export declare class VisualFormattingSettingsModel extends FormattingSettingsModel {
    titleSettings: TitleSettingsCard;
    layout: LayoutCard;
    cardStyle: CardStyleCard;
    headlineStyle: HeadlineStyleCard;
    labelStyle: LabelStyleCard;
    subtitleStyle: SubtitleStyleCard;
    changeStyle: ChangeStyleCard;
    imageStyle: ImageStyleCard;
    animation: AnimationCard;
    cards: (TitleSettingsCard | LayoutCard | CardStyleCard | HeadlineStyleCard | LabelStyleCard | SubtitleStyleCard | ChangeStyleCard | ImageStyleCard | AnimationCard)[];
}
export {};
