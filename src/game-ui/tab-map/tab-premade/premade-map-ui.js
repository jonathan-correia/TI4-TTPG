const locale = require("../../../lib/locale");
const CONFIG = require("../../game-ui-config");
const MAP_ATLAS_DB = require("../../../lib/map-string/map-atlas-db.json");
const MAP_STRING_DB = require("../../../lib/map-string/map-string-db.json");
const { WidgetFactory } = require("../../../lib/ui/widget-factory");

class PremadeMapUI {
    constructor(onClickHandlers) {
        this._verticalBox = WidgetFactory.verticalBox().setChildDistance(
            CONFIG.spacing
        );

        this._onClickHandlers = onClickHandlers;
        this._scheduleUpdateHandle = undefined;
        this._selectedMapString = undefined;

        const topPanel = WidgetFactory.horizontalBox().setChildDistance(
            CONFIG.spacing
        );
        this._verticalBox.addChild(topPanel, 0);
        topPanel.addChild(
            WidgetFactory.text()
                .setFontSize(CONFIG.fontSize)
                .setText(locale("ui.label.search"))
        );

        this._searchText = WidgetFactory.textBox().setFontSize(CONFIG.fontSize);
        // Changing the UI causes the TextBox to lose focus.
        // this._searchText.onTextChanged.add((textBox, player, text) => {
        //     this.scheduleUpdate();
        // });
        this._searchText.onTextCommitted.add((textBox, player, text) => {
            this.update();
        });
        topPanel.addChild(this._searchText, 1);

        this._choicesBox = WidgetFactory.layoutBox();
        this._verticalBox.addChild(this._choicesBox, 1);

        this.update();
    }

    getWidget() {
        return this._verticalBox;
    }

    scheduleUpdate() {
        if (this._scheduleUpdateHandle) {
            clearTimeout(this._scheduleUpdateHandle);
            this._scheduleUpdateHandle = undefined;
        }
        const handler = () => {
            this._scheduleUpdateHandle = undefined;
            this.update();
        };
        this._scheduleUpdateHandle = setTimeout(handler, 100);
    }

    update() {
        const searchParts = this._searchText
            .getText()
            .replace(/,/g, " ")
            .split(" ")
            .map((s) => {
                return s.trim().toLowerCase();
            })
            .filter((s) => {
                return s.length > 0;
            });
        const accept = (candidate) => {
            for (const searchPart of searchParts) {
                if (!candidate._lowerName.includes(searchPart)) {
                    return false;
                }
            }
            return true;
        };

        const candidates = [];
        candidates.push(...MAP_STRING_DB);
        candidates.push(...MAP_ATLAS_DB);

        for (const candidate of candidates) {
            let displayName = candidate.name;
            const attributes = candidate.attributes;
            const playerCount = candidate.playerCount;
            if (attributes && playerCount !== undefined) {
                displayName = `${displayName} [${playerCount}p, ${attributes}]`;
            }
            candidate._displayName = displayName;
            candidate._lowerName = displayName.toLowerCase();
        }

        const panel = WidgetFactory.verticalBox();
        for (const candidate of candidates) {
            if (!accept(candidate)) {
                continue;
            }
            const button = WidgetFactory.button()
                .setFontSize(CONFIG.fontSize)
                .setText(candidate._displayName);
            button.onClicked.add((clickedButton, player) => {
                console.log(`PremadeMapUI.onClicked ${candidate._displayName}`);
                this._onClickHandlers.useMap(candidate);
            });
            panel.addChild(button);
        }
        this._choicesBox.setChild(panel);
    }
}

module.exports = { PremadeMapUI };
