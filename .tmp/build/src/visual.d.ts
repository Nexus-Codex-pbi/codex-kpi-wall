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
    private localizationManager;
    private formattingSettings;
    private formattingSettingsService;
    private isHighContrast;
    private hcForeground;
    private hcBackground;
    private cornerSignature;
    constructor(options: VisualConstructorOptions);
    update(options: VisualUpdateOptions): void;
    /** Untouched default ink flips to the dark-theme token (suite sentinel
     *  idiom); a user-set colour is honoured as-is. */
    private adaptive;
    private renderTitle;
    private renderEmpty;
    private parseCards;
    private renderGrid;
    private renderCard;
    private formatValue;
    getFormattingModel(): powerbi.visuals.FormattingModel;
    destroy(): void;
}
