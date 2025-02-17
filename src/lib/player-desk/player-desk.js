const assert = require("../../wrapper/assert-wrapper");
const locale = require("../locale");
const { ColorUtil } = require("../color/color-util");
const { GameSetupUI } = require("../../setup/game-setup/game-setup-ui");
const { FactionToken } = require("../faction/faction-token");
const { ObjectNamespace } = require("../object-namespace");
const { PlayerDeskColor, PLAYER_DESK_COLORS } = require("./player-desk-color");
const { PlayerDeskSetup } = require("./player-desk-setup");
const { PlayerDeskPlayerNameUI } = require("./player-desk-player-name-ui");
const { PlayerDeskUI } = require("./player-desk-ui");
const { TableLayout } = require("../../table/table-layout");
const {
    GlobalSavedData,
    GLOBAL_SAVED_DATA_KEY,
} = require("../saved-data/global-saved-data");
const {
    CardHolder,
    Color,
    Player,
    Rotator,
    Vector,
    globalEvents,
    world,
} = require("../../wrapper/api");

const TAKE_SEAT_CAMERA = {
    pos: { x: -90, y: 0, z: 70 },
};

let _playerDesks = false;

// ----------------------------------------------------------------------------

/**
 * The player desk represents a player's private area.
 */
class PlayerDesk {
    /**
     * Move newly joined players to a non-seat player slot.
     *
     * @param {Player} player
     */
    static moveNewPlayerToNonSeatSlot(player) {
        assert(player instanceof Player);

        const reservedSlots = new Set();
        for (const playerDesk of PlayerDesk.getAllPlayerDesks()) {
            reservedSlots.add(playerDesk.playerSlot);
        }
        for (const otherPlayer of world.getAllPlayers()) {
            if (otherPlayer === player) {
                continue;
            }
            reservedSlots.add(otherPlayer.getSlot());
        }
        if (!reservedSlots.has(player.getSlot())) {
            return; // player is in a safe slot
        }
        for (let i = 0; i < 20; i++) {
            if (!reservedSlots.has(i)) {
                const before = player.getSlot();
                player.switchSlot(i);
                const after = player.getSlot();
                console.log(
                    `moveNewPlayerToNonSeatSlot: ${before} -> ${after}`
                );
                return;
            }
        }
        throw new Error("unable to find open slot");
    }

    /**
     * Get all player desks, accounting for current player count.
     * Player desks are read-only and shared, DO NOT MUTATE!
     *
     * @returns {Array.{PlayerDesk}}
     */
    static getAllPlayerDesks() {
        const playerCount = world.TI4.config.playerCount;

        // Sanity check player count.
        if (_playerDesks && _playerDesks.length != playerCount) {
            _playerDesks = undefined;
        }

        // Use cached version if available.
        if (_playerDesks) {
            return [..._playerDesks]; // copy in case caller mutates order
        }

        _playerDesks = [];
        // Walk backwards so "south-east" is index 0 then clockwise.
        const tableDesks = TableLayout.desks();
        for (let i = tableDesks.length - 1; i >= 0; i--) {
            const attrs = tableDesks[i];
            if (!attrs.playerCounts.includes(playerCount)) {
                continue;
            }
            _playerDesks.push(new PlayerDesk(attrs, _playerDesks.length));
        }

        // Apply any saved desk state.
        const deskState = GlobalSavedData.get(
            GLOBAL_SAVED_DATA_KEY.DESK_STATE,
            []
        );
        if (deskState.length === _playerDesks.length) {
            for (let i = 0; i < _playerDesks.length; i++) {
                _playerDesks[i]._color = ColorUtil.colorFromHex(deskState[i].c);
                _playerDesks[i]._plasticColor = ColorUtil.colorFromHex(
                    deskState[i].pc
                );
                _playerDesks[i]._colorName = deskState[i].cn;
                _playerDesks[i]._playerSlot = deskState[i].s;
                _playerDesks[i]._ready = deskState[i].r;

                PlayerDeskColor.reset(_playerDesks[i]);
            }
        }

        return _playerDesks;
    }

    /**
     * Get player desk closest to this position.
     *
     * @param {Vector} position
     * @returns {PlayerDesk}
     */
    static getClosest(position) {
        assert(typeof position.x === "number"); // "instanceof Vector" broken

        let closestDistanceSq = Number.MAX_VALUE;
        let closest = false;

        // This might be called a lot, find without creating new objects.
        for (const playerDesk of PlayerDesk.getAllPlayerDesks()) {
            const dx = position.x - playerDesk._center.x;
            const dy = position.y - playerDesk._center.y;
            const dSq = dx * dx + dy * dy;
            if (dSq < closestDistanceSq) {
                closestDistanceSq = dSq;
                closest = playerDesk;
            }
        }
        if (!closest) {
            throw new Error(`unable to find closest for ${position}`);
        }
        return closest;
    }

    /**
     * Get player desk associated with player slot.
     *
     * @param {number} playerSlot
     * @returns {PlayerDesk|undefined}
     */
    static getByPlayerSlot(playerSlot) {
        assert(typeof playerSlot === "number");
        for (const playerDesk of PlayerDesk.getAllPlayerDesks()) {
            if (playerDesk.playerSlot === playerSlot) {
                return playerDesk;
            }
        }
    }

    static resetUIs() {
        for (const playerDesk of PlayerDesk.getAllPlayerDesks()) {
            playerDesk.resetUI();
        }
    }

    static createDummy(index, playerSlot) {
        assert(typeof index === "number");
        assert(typeof playerSlot === "number");

        return new PlayerDesk(
            {
                colorName: "white",
                hexColor: "#000000",
                plasticHexColor: "#000000",
                pos: { x: 0, y: 0 },
                yaw: 0,
                defaultPlayerSlot: playerSlot,
            },
            index
        );
    }

    constructor(attrs, index) {
        assert(typeof index === "number");

        this._index = index;
        this._colorName = attrs.colorName;
        this._pos = new Vector(
            attrs.pos.x,
            attrs.pos.y,
            world.getTableHeight()
        );
        this._rot = new Rotator(0, (attrs.yaw + 360 + 90) % 360, 0);
        this._playerSlot = attrs.defaultPlayerSlot;

        // Base attrs might be just color name.  ALWAYS look up color values.
        const colorAttrs = PlayerDeskColor.getColorAttrs(attrs.colorName);
        this._color = ColorUtil.colorFromHex(colorAttrs.hexColor);
        this._plasticColor = ColorUtil.colorFromHex(colorAttrs.plasticHexColor);

        this._ui = false;
        this._nameUI = false;

        // Pos is center, but allow for non-center pos.
        this._center = this._pos.clone();

        this._showColors = false;
        this._factionSetupInProgress = false;
        this._ready = false;
    }

    get center() {
        return this._center;
    }
    get color() {
        return this._color;
    }
    get plasticColor() {
        return this._plasticColor;
    }
    get colorName() {
        return this._colorName;
    }
    get index() {
        return this._index;
    }
    get playerSlot() {
        return this._playerSlot;
    }
    get pos() {
        return this._pos;
    }
    get rot() {
        return this._rot;
    }

    resetUI() {
        const playerSlot = this.playerSlot;
        const isOccupied = world.getPlayerBySlot(playerSlot);
        const isReady = this.isDeskReady();
        const config = {
            isReady,
            isOccupied,
            showColors: !isReady && this._showColors,
            canFaction:
                !isReady &&
                world.TI4.config.timestamp > 0 &&
                !this._factionSetupInProgress,
            hasFaction: world.TI4.getFactionByPlayerSlot(playerSlot)
                ? true
                : false,
        };

        // Always add name UI.
        if (!this._nameUI) {
            this._nameUI = new PlayerDeskPlayerNameUI(this);
            this._nameUI.addUI();
        }

        // If player is seated and ready, remove UI.
        if (isOccupied && isReady) {
            if (this._playerDeskUI) {
                this._playerDeskUI.removeUI();
                this._playerDeskUI = undefined;
            }
            return;
        }

        if (!this._playerDeskUI) {
            this.addUI();
        }
        this._playerDeskUI.update(config);
    }

    addUI() {
        const colorOptions = this.getColorOptions();

        assert(!this._playerDeskUI);
        this._playerDeskUI = new PlayerDeskUI(this, colorOptions, {
            onTakeSeat: (button, player) => {
                this.seatPlayer(player);
                this.resetUI();
            },
            onLeaveSeat: (button, player) => {
                if (player.getSlot() !== this.playerSlot) {
                    return;
                }
                PlayerDesk.moveNewPlayerToNonSeatSlot(player);
                this.resetUI();
            },
            onToggleColors: (button, player) => {
                this._showColors = !this._showColors;
                this.resetUI();
            },
            onChangeColor: (colorOption, player) => {
                const { colorName, colorTint, plasticColorTint } = colorOption;
                assert(colorName);
                assert(colorTint);
                assert(plasticColorTint);
                if (!this.changeColor(colorName, colorTint, plasticColorTint)) {
                    player.showMessage(locale("ui.desk.color_in_use"));
                }
                this._showColors = false;
                this.resetUI();
            },
            onSetupFaction: (button, player) => {
                if (!FactionToken.getByPlayerDesk(this)) {
                    // No faction token, show faction selector.
                    // TODO XXX
                    // For now fall through and unpack a random one.
                }
                // Have a faction token, use it.
                this._factionSetupInProgress = true;
                const onFinished = () => {
                    this._factionSetupInProgress = false;
                    this.resetUI();
                };
                new PlayerDeskSetup(this).setupFactionAsync(false, onFinished);
                this.resetUI();
            },
            onCleanFaction: (button, player) => {
                this._factionSetupInProgress = false;
                // BUG REPORT: "no faction for 15"
                new PlayerDeskSetup(this).cleanFaction();
                this.resetUI();
            },
            onReady: (button, player) => {
                this.setReady(true);
                this.resetUI();
            },
        });
        this._playerDeskUI.addUI();
    }

    removeUI() {
        if (this._playerDeskUI) {
            this._playerDeskUI.removeUI();
            this._playerDeskUI = false;
        }
        if (this._nameUI) {
            this._nameUI.removeUI();
            this._nameUI = false;
        }
    }

    /**
     * Translate a local-to-desk position to world space.
     *
     * @param {Vector} pos - can be a {x,y,z} object
     * @returns {Vector}
     */
    localPositionToWorld(pos) {
        assert(typeof pos.x === "number"); // instanceof Vector broken
        return new Vector(pos.x, pos.y, pos.z)
            .rotateAngleAxis(this.rot.yaw, [0, 0, 1])
            .add(this.pos);
    }

    /**
     * Traslate a local-to-desk rotation to world space.
     *
     * @param {Rotator} rot - can be a {yaw, pitch, roll} object
     * @returns {Rotator}
     */
    localRotationToWorld(rot) {
        assert(typeof rot.yaw === "number"); // instanceof Rotator broken
        return new Rotator(rot.pitch, rot.yaw, rot.roll).compose(this.rot);
    }

    worldPositionToLocal(pos) {
        assert(typeof pos.x === "number"); // instanceof Vector broken
        return new Vector(pos.x, pos.y, pos.z)
            .subtract(this.pos)
            .rotateAngleAxis(-this.rot.yaw, [0, 0, 1]);
    }

    worldRotationToLocal(rot) {
        assert(typeof rot.yaw === "number"); // instanceof Rotator broken
        return this.rot.getInverse().compose(rot);
    }

    /**
     * Move a player to this seat.
     *
     * @param {Player} player
     */
    seatPlayer(player) {
        assert(player instanceof Player);
        player.switchSlot(this.playerSlot);

        // Link the hand.
        let cardHolder = false;
        for (const obj of world.getAllObjects()) {
            if (obj.getContainer()) {
                continue;
            }
            if (obj.getOwningPlayerSlot !== this.playerSlot) {
                continue;
            }
            if (!(obj instanceof CardHolder)) {
                continue;
            }
            cardHolder = obj;
            break;
        }
        player.setHandHolder(cardHolder);

        // Careful, need to look at a position on the top surface of
        // the table or else the camera can bug out and fall below table.
        const pos = this.localPositionToWorld(TAKE_SEAT_CAMERA.pos);
        const rot = pos.findLookAtRotation(
            new Vector(0, 0, world.getTableHeight())
        );
        player.setPositionAndRotation(pos, rot);
    }

    unseatPlayer() {
        const player = world.getPlayerBySlot(this.playerSlot);
        if (player) {
            PlayerDesk.moveNewPlayerToNonSeatSlot(player);
        }
    }

    /**
     * Get changeColor options.
     *
     * @returns {Array.{colorName:string,color:Color,plasticColor:Color}}
     */
    getColorOptions() {
        return PLAYER_DESK_COLORS.map((attrs) => {
            return {
                colorName: attrs.colorName,
                colorTint: ColorUtil.colorFromHex(attrs.hexColor),
                plasticColorTint: ColorUtil.colorFromHex(attrs.plasticHexColor),
            };
        });
    }

    /**
     * Change seat color.
     *
     * Note this does not attempt to recolor other objects, caller should
     * clean up any per-color components and restore in the new color after.
     *
     * @param {string} colorName - for promissory notes ("Ceasefile (Blue)")
     * @param {Color} colorTint
     */
    changeColor(colorName, colorTint, plasticColorTint) {
        assert(typeof colorName === "string");
        assert(ColorUtil.isColor(colorTint));
        assert(ColorUtil.isColor(plasticColorTint));

        let legalColorName = false;
        for (const attrs of PLAYER_DESK_COLORS) {
            if (attrs.colorName === colorName) {
                legalColorName = true;
                break;
            }
        }
        assert(legalColorName);

        const srcColorName = this.colorName;
        const srcPlayerSlot = this.playerSlot;
        const srcSetup = this.isDeskSetup();
        const srcFaction = world.TI4.getFactionByPlayerSlot(srcPlayerSlot);
        const dstColorName = colorName;
        let dstPlayerSlot = -1;
        let dstSetup = false;
        let dstFaction = false;

        // This another desk is already using this color name, swap the two.
        let swapWith = false;
        for (const otherDesk of PlayerDesk.getAllPlayerDesks()) {
            if (otherDesk.colorName === colorName && otherDesk !== this) {
                swapWith = otherDesk;
                break;
            }
        }
        if (swapWith) {
            dstPlayerSlot = swapWith.playerSlot;
            dstSetup = swapWith.isDeskSetup();
            dstFaction = world.TI4.getFactionByPlayerSlot(dstPlayerSlot);
        }

        // Reject change request if swap-with is seated.
        if (dstPlayerSlot >= 0 && world.getPlayerBySlot(dstPlayerSlot)) {
            return false;
        }

        // Take care changing colors with an active seat!
        if (srcFaction) {
            new PlayerDeskSetup(this).cleanFaction();
        }
        if (srcSetup) {
            new PlayerDeskSetup(this).cleanGeneric();
        }
        if (dstFaction) {
            new PlayerDeskSetup(swapWith).cleanFaction();
        }
        if (dstSetup) {
            new PlayerDeskSetup(swapWith).cleanGeneric();
        }

        // At this point all src/dst values are known.
        PlayerDeskColor.change(this, dstColorName);
        if (swapWith) {
            PlayerDeskColor.change(swapWith, srcColorName);
        }

        // Recreate initial setup/faction state.
        if (srcSetup) {
            // BUG REPORT: Setup home system generic failed, playerSlot wasn't recognized?
            new PlayerDeskSetup(this).setupGeneric();
        }
        if (srcFaction) {
            new PlayerDeskSetup(this).setupFaction(srcFaction.nsidName);
        }
        if (dstSetup) {
            new PlayerDeskSetup(swapWith).setupGeneric();
        }
        if (dstFaction) {
            new PlayerDeskSetup(swapWith).setupFaction(dstFaction.nsidName);
        }

        this.resetUI();
        if (swapWith) {
            swapWith.resetUI();
        }

        this.saveDesksState();

        globalEvents.TI4.onPlayerColorChanged.trigger(this.color, this.index);
        if (swapWith) {
            globalEvents.TI4.onPlayerColorChanged.trigger(
                swapWith.color,
                swapWith.index
            );
        }

        return true;
    }

    setReady(value) {
        this._ready = value;
        this.saveDesksState();
        this.resetUI();
    }

    saveDesksState() {
        // Save slots and tint colors for reload.
        const deskState = [];
        for (let i = 0; i < _playerDesks.length; i++) {
            deskState.push({
                c: ColorUtil.colorToHex(_playerDesks[i].color),
                pc: ColorUtil.colorToHex(_playerDesks[i].plasticColor),
                cn: _playerDesks[i].colorName,
                s: _playerDesks[i]._playerSlot,
                r: _playerDesks[i]._ready,
            });
        }
        GlobalSavedData.set(GLOBAL_SAVED_DATA_KEY.DESK_STATE, deskState);
    }

    /**
     * Has the player marked the desk as ready?
     *
     * @returns {boolean}
     */
    isDeskReady() {
        return this._ready;
    }

    /**
     * Has this desk been setup?  That is, per-desk items unpacked.
     *
     * @returns {boolean}
     */
    isDeskSetup() {
        const playerSlot = this.playerSlot;
        for (const obj of world.getAllObjects()) {
            if (obj.getContainer()) {
                continue; // ignore inside container
            }
            if (obj.getOwningPlayerSlot() !== playerSlot) {
                continue; // require sheet be linked to slot
            }
            if (ObjectNamespace.isCommandSheet(obj)) {
                return true;
            }
        }
    }

    /**
     * Visualize the player area center / rotation.
     */
    drawDebug() {
        const colorLine = new Color(0, 1, 0);
        const colorPoint = new Color(1, 0, 0);
        const duration = 10;
        const thicknessLine = 1;
        const sizePoint = thicknessLine * 3;

        const dir = this.center.add(
            this.rot.getForwardVector().multiply(sizePoint * 5)
        );

        world.drawDebugPoint(this.center, sizePoint, colorPoint, duration);
        world.drawDebugLine(
            this.center,
            dir,
            colorLine,
            duration,
            thicknessLine
        );
    }
}

// ----------------------------------------------------------------------------

// Bounce joining players to unseated.
globalEvents.TI4.onPlayerJoinedDelayed.add((player) => {
    // Wait a tick to make sure player is fully set up.
    process.nextTick(() => {
        PlayerDesk.moveNewPlayerToNonSeatSlot(player);
    });
});

// Unseat host when first loading game.
const runOnce = () => {
    for (const player of world.getAllPlayers()) {
        PlayerDesk.moveNewPlayerToNonSeatSlot(player);
    }
    PlayerDesk.resetUIs(); // show "take seat" UI
};
if (!world.__isMock && world.getExecutionReason() !== "ScriptReload") {
    process.nextTick(runOnce);
}

// Reset on load.
if (!world.__isMock) {
    process.nextTick(() => {
        PlayerDesk.resetUIs();
    });
}

globalEvents.TI4.onPlayerJoinedDelayed.add((player) => {
    PlayerDesk.resetUIs();
});
globalEvents.onPlayerLeft.add((player) => {
    PlayerDesk.resetUIs();
});
globalEvents.onPlayerSwitchedSlots.add((player, oldPlayerSlot) => {
    PlayerDesk.resetUIs();
});
globalEvents.TI4.onGameSetup.add((state, player) => {
    PlayerDesk.resetUIs();
});

globalEvents.TI4.onPlayerCountAboutToChange.add((newPlayerCount, player) => {
    if (world.__isMock) {
        _playerDesks = false;
        return;
    }

    // Remove any desk UIs.
    if (_playerDesks) {
        for (const playerDesk of _playerDesks) {
            assert(playerDesk instanceof PlayerDesk);
            playerDesk.removeUI();
        }
    }

    // Clean any existing desks, reset desks list.
    // USE SYNCHRONOUS VERSION, DESKS ARRAY WILL CHANGE!
    if (_playerDesks) {
        for (const playerDesk of _playerDesks) {
            assert(playerDesk instanceof PlayerDesk);
            new PlayerDeskSetup(playerDesk).cleanGeneric();
        }
    }
    _playerDesks = false;
});

globalEvents.TI4.onPlayerCountChanged.add((newPlayerCount, player) => {
    if (world.__isMock) {
        _playerDesks = false;
        return;
    }

    assert(!_playerDesks);

    // Lock in player count until finished.
    GameSetupUI.disablePlayerCountSlider();

    // Use async setup to spread out load.
    const setup = () => {
        // Reset to new count.
        _playerDesks = false;

        // Add UIs to new desks.
        PlayerDesk.resetUIs();

        // Redo setup for all desks.
        for (const playerDesk of world.TI4.getAllPlayerDesks()) {
            assert(playerDesk instanceof PlayerDesk);
            new PlayerDeskSetup(playerDesk).setupGenericAsync();
        }

        // Re-enable player count changes.
        PlayerDeskSetup.getSharedAsyncTaskQueue().add(() => {
            GameSetupUI.enablePlayerCountSlider();
        });
    };

    // Leverage the shared task queue to make sure all cleanup tasks finish
    // before resetting desks.
    PlayerDeskSetup.getSharedAsyncTaskQueue().add(setup);
});

module.exports = { PlayerDesk };
