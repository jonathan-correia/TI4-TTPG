const assert = require("../../../wrapper/assert-wrapper");
const { DraftSelectionWidget } = require("../draft-selection-widget");
const { MiltyUtil, DEFAULT_WRAP_AT } = require("../milty/milty-util");
const { System } = require("../../system/system");
const {
    Border,
    Button,
    Canvas,
    HorizontalAlignment,
    ImageWidget,
    LayoutBox,
    Text,
    VerticalAlignment,
    refPackageId,
    world,
} = require("../../../wrapper/api");

const DEFAULT_SLICE_SCALE = 10;
const TILE_W = 30;
const TILE_H = TILE_W * 0.866;
const FONT_SIZE = 4;

/**
 * Draw a milty slice as a UI Widget.
 */
class BunkerSliceUI {
    static getSize(scale) {
        assert(typeof scale === "number" && scale >= 1);

        const tileW = Math.floor(TILE_W * scale);
        const tileH = Math.floor(TILE_H * scale);
        const bunkerW = Math.floor(tileW * 2.5);
        const bunkerH = Math.floor(tileH * 3.5);
        return { bunkerW, bunkerH, tileW, tileH };
    }

    static getFontSize(scale) {
        return Math.min(255, Math.floor(FONT_SIZE * scale));
    }

    constructor(canvas, canvasOffset, scale) {
        assert(canvas instanceof Canvas);
        assert(typeof canvasOffset.x === "number");
        assert(typeof canvasOffset.y === "number");
        assert(typeof scale === "number" && scale >= 1);

        // Tile positions in "tile size" space.
        let offsets = [
            { x: 0.75, y: 1 }, // HS, ADD FIRST TO DRAW ON BOTTOM
            { x: 0, y: 1.5 }, // leftmost
            { x: 0, y: 0.5 }, // left of home
            { x: 0.75, y: 0 }, // front of home
            { x: 1.5, y: 0.5 }, // right of home
        ];

        // Translate tile positions to canvas offsets.
        const tileW = Math.floor(TILE_W * scale);
        const tileH = Math.floor(TILE_H * scale);

        // Images are square with some transparency at the top/bottom.
        const dH = (tileW - tileH) / 2;

        offsets = offsets.map((offset) => {
            return {
                x: offset.x * tileW + canvasOffset.x,
                y: offset.y * tileH + canvasOffset.y - dH,
            };
        });

        // Add home system behind other elements (drawn in order).
        this._tileBoxes = offsets.map((offset) => {
            const layoutBox = new LayoutBox();
            canvas.addChild(
                layoutBox,
                offset.x - 1,
                offset.y - 1,
                tileW + 2,
                tileW + 2 // use W for H because image is square with transparent top/bottom
            );
            return layoutBox;
        });
        this._homeSystemBox = this._tileBoxes.shift();

        // Summary.
        this._summaryFontSize = BunkerSliceUI.getFontSize(scale);
        this._summaryBox = new LayoutBox()
            .setHorizontalAlignment(HorizontalAlignment.Center)
            .setVerticalAlignment(VerticalAlignment.Bottom);
        const summaryX = canvasOffset.x;
        const summaryY = canvasOffset.y + tileH - this._summaryFontSize / 2;
        const summaryW = tileW * 2.5;
        const summaryH = tileH * 0.75;
        canvas.addChild(
            this._summaryBox,
            summaryX,
            summaryY,
            summaryW,
            summaryH
        );

        // Label / button area.
        this._labelFontSize = BunkerSliceUI.getFontSize(scale);
        this._labelBox = new LayoutBox();
        const labelX = canvasOffset.x;
        const labelY = canvasOffset.y + tileH * 2.5;
        const labelW = tileW * 2.5;
        const labelH = tileH;
        canvas.addChild(this._labelBox, labelX, labelY, labelW, labelH);
    }

    setSlice(bunkerSlice) {
        assert(Array.isArray(bunkerSlice));
        assert(bunkerSlice.length === 4);

        for (let i = 0; i < bunkerSlice.length; i++) {
            const tile = bunkerSlice[i];
            const system = world.TI4.getSystemByTileNumber(tile);
            const imgPath = system.raw.img;
            const tileBox = this._tileBoxes[i];
            tileBox.setChild(new ImageWidget().setImage(imgPath, refPackageId));
        }

        const summaryValue = System.summarize(bunkerSlice);
        const summary = new Text()
            .setFontSize(this._summaryFontSize)
            .setAutoWrap(true)
            .setText(summaryValue);
        this._summaryBox.setChild(new Border().setChild(summary));

        return this;
    }

    setColor(color) {
        assert(typeof color.r === "number");
        this._homeSystemBox.setChild(
            new ImageWidget()
                .setImage("global/ui/tiles/blank.png", refPackageId)
                .setTintColor(color)
        );
        return this;
    }

    setLabel(label, onClickedGenerator) {
        assert(typeof label === "string");
        assert(typeof onClickedGenerator === "function");

        label = MiltyUtil.wrapSliceLabel(label, DEFAULT_WRAP_AT);
        const button = new Button()
            .setFontSize(this._labelFontSize)
            .setText(label);
        const draftSelection = new DraftSelectionWidget().setChild(button);
        button.onClicked.add(onClickedGenerator(draftSelection));
        this._labelBox.setChild(draftSelection.getWidget());
        return this;
    }

    clear() {
        for (let i = 0; i < 5; i++) {
            const tileBox = this._tileBoxes[i];
            tileBox.setChild();
        }
        this._homeSystemBox.setChild(new LayoutBox());
        this._labelBox.setChild(new LayoutBox());
    }
}

module.exports = { BunkerSliceUI, DEFAULT_SLICE_SCALE };
