import powerbi from "powerbi-visuals-api";
import "./../style/visual.less";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
export declare class Visual implements IVisual {
    private host;
    private target;
    private rootDiv;
    private events;
    private selectionManager;
    private tooltipService;
    private formattingSettings;
    private formattingSettingsService;
    private isHighContrast;
    private hcForeground;
    private hcBackground;
    private cornerSignature;
    private highlightActive;
    private cardEls;
    private selectedIdx;
    constructor(options: VisualConstructorOptions);
    update(options: VisualUpdateOptions): void;
    private parseCards;
    private renderGrid;
    private renderCard;
    private wireCard;
    /** Board .k2.sel — accent ring on selected cards, others untouched. */
    private applySelectionRing;
    private renderTitle;
    private renderEmpty;
    private formatValue;
    getFormattingModel(): powerbi.visuals.FormattingModel;
    destroy(): void;
}
