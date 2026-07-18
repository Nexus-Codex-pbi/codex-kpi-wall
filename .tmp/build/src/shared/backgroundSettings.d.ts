import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
export declare class BackgroundSettings extends FormattingSettingsCard {
    name: string;
    displayName: string;
    backgroundColor: formattingSettings.ColorPicker;
    transparency: formattingSettings.Slider;
    slices: FormattingSettingsSlice[];
}
