import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import type { CardSignatureHandle, CardSignatureVariant } from "./cardSignature";
import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsSlice = formattingSettings.Slice;
export declare class CardSignatureSettings extends FormattingSettingsCard {
    show: formattingSettings.ToggleSwitch;
    style: formattingSettings.ItemDropdown;
    autoColor: formattingSettings.ToggleSwitch;
    color: formattingSettings.ColorPicker;
    mirrorCorners: formattingSettings.ToggleSwitch;
    cornerRadius: formattingSettings.NumUpDown;
    name: string;
    displayName: string;
    topLevelSlice: formattingSettings.ToggleSwitch;
    slices: Array<FormattingSettingsSlice>;
}
export interface CardSignatureParams {
    /** The colour the visual would use on its own (theme accent / muted). */
    autoHex: string;
    hcActive?: boolean;
    hcColor?: string;
    glowMix?: number;
    muted?: boolean;
    mirror?: boolean;
    cardRadius?: number;
}
export interface ResolvedCardSignature {
    visible: boolean;
    variant: CardSignatureVariant;
    hex: string;
}
/** Resolve the user's Corner Accents settings against the visual's own
 *  derivation. Precedence: HC system colour > user custom colour >
 *  the visual's auto colour. Muted (empty-state) renders keep the
 *  visual's muted colour but still honour show + style. */
export declare function resolveCardSignature(sig: CardSignatureSettings | undefined, p: CardSignatureParams): ResolvedCardSignature;
/** Drive an existing CardSignatureHandle from the settings (update-style
 *  call sites). Hides the elements when show is off; styleBracket's
 *  display reset un-hides them on the next visible update. */
export declare function applyCardSignature(handle: CardSignatureHandle | null, sig: CardSignatureSettings | undefined, p: CardSignatureParams): void;
