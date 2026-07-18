import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
export declare class BorderSettings extends FormattingSettingsCard {
    show: formattingSettings.ToggleSwitch;
    color: formattingSettings.ColorPicker;
    transparency: formattingSettings.Slider;
    width: formattingSettings.NumUpDown;
    radius: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    topLevelSlice: formattingSettings.ToggleSwitch;
    slices: Array<FormattingSettingsSlice>;
}
/** Paint (or clear) the border on the visual's outer render root.
 *  Under high contrast the system foreground wins. Pass `palette` +
 *  `metadataObjects` to honour an fx rule on the colour (the slice's
 *  selector is wired here too — card-level constant persistence, rules
 *  per the wildcard; see feedback_pbi_fx_altconstant_first_row_trap). */
export interface ResolvedBorder {
    colorCss: string;
    width: number;
    radius: number;
}
/** Resolve the Border card to concrete paint values (or null when off).
 *  Wires the fx selector + honours an fx rule; shared by DOM (applyBorder)
 *  and SVG (visuals draw their own stroke-rect) callers. */
export declare function resolveBorder(border: BorderSettings | undefined, opts?: {
    hcActive?: boolean;
    hcColor?: string;
    palette?: unknown;
    metadataObjects?: unknown;
}): ResolvedBorder | null;
export declare function applyBorder(el: HTMLElement, border: BorderSettings | undefined, opts?: {
    hcActive?: boolean;
    hcColor?: string;
    palette?: unknown;
    metadataObjects?: unknown;
}): void;
