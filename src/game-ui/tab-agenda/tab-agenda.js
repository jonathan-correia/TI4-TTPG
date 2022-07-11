const assert = require("../../wrapper/assert-wrapper");
const locale = require("../../lib/locale");
const { AgendaOutcome, OUTCOME_TYPE } = require("./agenda-outcome");
const { AgendaStateMachine } = require("./agenda-state-machine");
const { AgendaTurnOrder } = require("./agenda-turn-order");
const { AgendaUiMain } = require("./agenda-ui-main");
const { Broadcast } = require("../../lib/broadcast");
const { CardUtil } = require("../../lib/card/card-util");
const { Hex } = require("../../lib/hex");
const { ObjectNamespace } = require("../../lib/object-namespace");
const {
    Card,
    LayoutBox,
    Player,
    Rotator,
    globalEvents,
    world,
} = require("../../wrapper/api");
const { AgendaUiDesk } = require("./agenda-ui-desk");

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

class TabAgenda {
    static getDeskIndexToPerPlanetBonus() {
        const deskIndexToPerPlanetBonus = {};
        for (const playerDesk of world.TI4.getAllPlayerDesks()) {
            deskIndexToPerPlanetBonus[playerDesk.index] = 0;
        }

        let xxchaCommanderIndex = -1;
        let xxchaAllianceIndex = -1;

        const checkIsDiscardPile = false;
        const allowFaceDown = false;
        for (const obj of world.getAllObjects()) {
            if (obj.getContainer()) {
                continue;
            }
            if (!CardUtil.isLooseCard(obj, checkIsDiscardPile, allowFaceDown)) {
                continue;
            }
            const nsid = ObjectNamespace.getNsid(obj);
            if (nsid === "card.leader.commander.xxcha:pok/elder_qanoj") {
                const pos = obj.getPosition();
                const closestDesk = world.TI4.getClosestPlayerDesk(pos);
                xxchaCommanderIndex = closestDesk.index;
            } else if (nsid === "card.alliance:pok/xxcha") {
                const pos = obj.getPosition();
                const closestDesk = world.TI4.getClosestPlayerDesk(pos);
                xxchaAllianceIndex = closestDesk.index;
            }
        }

        if (xxchaCommanderIndex >= 0) {
            deskIndexToPerPlanetBonus[xxchaCommanderIndex] = 1;

            // Alliance only applies if commander is unlocked.
            if (
                xxchaAllianceIndex >= 0 &&
                xxchaAllianceIndex != xxchaCommanderIndex
            ) {
                deskIndexToPerPlanetBonus[xxchaAllianceIndex] = 1;
            }
        }
        return deskIndexToPerPlanetBonus;
    }

    static getDeskIndexToAvailableVotes() {
        const deskIndexToPerPlanetBonus =
            TabAgenda.getDeskIndexToPerPlanetBonus();

        const gromOmegaNsid =
            "card.leader.hero.xxcha:codex.vigil/xxekir_grom.omega";
        const gromOmegaDeskIndexSet = new Set();
        const checkIsDiscardPile = false;
        const allowFaceDown = false;
        for (const obj of world.getAllObjects()) {
            if (obj.getContainer()) {
                continue;
            }
            if (!CardUtil.isLooseCard(obj, checkIsDiscardPile, allowFaceDown)) {
                continue;
            }
            const nsid = ObjectNamespace.getNsid(obj);
            if (nsid === gromOmegaNsid) {
                const pos = obj.getPosition();
                const closestDesk = world.TI4.getClosestPlayerDesk(pos);
                gromOmegaDeskIndexSet.add(closestDesk.index);
            }
        }

        const deskIndexToAvailableVotes = {};
        for (const playerDesk of world.TI4.getAllPlayerDesks()) {
            deskIndexToAvailableVotes[playerDesk.index] = 0;
        }

        for (const obj of world.getAllObjects()) {
            if (obj.getContainer()) {
                continue;
            }
            if (!CardUtil.isLooseCard(obj, checkIsDiscardPile, allowFaceDown)) {
                continue;
            }
            const planet = world.TI4.getPlanetByCard(obj);
            if (!planet) {
                continue;
            }

            const pos = obj.getPosition();
            const closestDesk = world.TI4.getClosestPlayerDesk(pos);
            if (!closestDesk) {
                continue;
            }

            const deskIndex = closestDesk.index;
            const oldValue = deskIndexToAvailableVotes[deskIndex] || 0;
            let newValue = oldValue + planet.raw.influence;

            const bonus = deskIndexToPerPlanetBonus[deskIndex] || 0;
            newValue += bonus;

            if (gromOmegaDeskIndexSet.has(deskIndex)) {
                newValue += planet.raw.resources;
            }

            deskIndexToAvailableVotes[deskIndex] = newValue;
        }
        return deskIndexToAvailableVotes;
    }

    static resetPlanetCards() {
        const systemHexes = new Set();
        for (const systemTileObj of world.TI4.getAllSystemTileObjects()) {
            const pos = systemTileObj.getPosition();
            const hex = Hex.fromPosition(pos);
            systemHexes.add(hex);
        }

        const checkIsDiscardPile = false;
        const allowFaceDown = true;
        for (const obj of world.getAllObjects()) {
            if (!CardUtil.isLooseCard(obj, checkIsDiscardPile, allowFaceDown)) {
                continue; // not a loose card
            }
            const nsid = ObjectNamespace.getNsid(obj);
            if (
                !nsid.startsWith("card.planet") &&
                !nsid.startsWith("card.legendary_planet")
            ) {
                continue; // not a planet card
            }
            if (obj.isFaceUp()) {
                continue; // already face up
            }
            const pos = obj.getPosition();
            const hex = Hex.fromPosition(pos);
            if (systemHexes.has(hex)) {
                continue; // on a aystem tile
            }

            const rotation = obj.getRotation();
            const newRotation = new Rotator(rotation.pitch, rotation.yaw, -180);
            obj.setPosition(pos.add([0, 0, 3]));
            obj.setRotation(newRotation, 1);
        }
    }

    constructor() {
        this._widget = new LayoutBox();
        this._stateMachine = undefined;

        this._outcomeType = undefined;
        this._outcomeNames = undefined;
        this._deskUIs = undefined;
        this._deskIndexToAvailableVotes = undefined;

        globalEvents.TI4.onAgendaChanged.add((agendaCard) => {
            world.TI4.turns.clearAllPassed();
            if (agendaCard) {
                this._stateMachine = new AgendaStateMachine();
            } else {
                this._stateMachine = undefined;
            }
            this._outcomeType = undefined;
            this._outcomeNames = undefined;
            this._deskIndexToAvailableVotes =
                TabAgenda.getDeskIndexToAvailableVotes();
            this.resetForCurrentState();
        });

        globalEvents.TI4.onTurnChanged.add(() => {
            this.updateWaitingForMessage();
        });

        // This is not working reliably.
        //globalEvents.TI4.onPlanetCardFlipped.add((card, isFaceUp) => {
        //    this._onPlanetCardFlipped(card, isFaceUp);
        //});

        this.resetForCurrentState();
    }

    _onPlanetCardFlipped(card, isFaceUp) {
        assert(card instanceof Card);
        assert(typeof isFaceUp === "boolean");

        if (!this._stateMachine || !this._deskUIs) {
            return;
        }

        const pos = card.getPosition();
        const closestDesk = world.TI4.getClosestPlayerDesk(pos);
        const deskIndex = closestDesk.index;

        const planet = world.TI4.getPlanetByCard(card);
        assert(planet);
        let influence = planet.raw.influence;

        // If xxcha hero add resources to influence value.
        const playerSlot = closestDesk.playerSlot;
        const gromOmegaNsid =
            "card.leader.hero.xxcha:codex.vigil/xxekir_grom.omega";
        if (CardUtil.hasCard(playerSlot, gromOmegaNsid, false)) {
            influence += planet.raw.resources;
        }

        // Apply bonus votes.
        const deskIndexToPerPlanetBonus =
            TabAgenda.getDeskIndexToPerPlanetBonus();
        const bonus = deskIndexToPerPlanetBonus[deskIndex] || 0;
        influence += bonus;
        const deltaValue = influence * (isFaceUp ? -1 : 1);

        console.log(
            `TabAgenda.onPlanetCardFlipped: ${deltaValue} for ${closestDesk.colorName}`
        );

        let foundDeskUi = undefined;
        for (const deskUi of this._deskUIs) {
            if (deskUi._playerDesk === closestDesk) {
                foundDeskUi = deskUi;
                break;
            }
        }
        if (foundDeskUi._votedOutcomeIndex < 0) {
            console.log("TabAgenda.onPlanetCardFlipped: no outcome selected");
            return;
        }
        if (foundDeskUi._voteLocked) {
            console.log("TabAgenda.onPlanetCardFlipped: vote locked");
            return;
        }
        foundDeskUi.addVotes(deltaValue);
    }

    getUI() {
        return this._widget;
    }

    /**
     * Reset for the current state.  Sets turn order appropriates, as well as
     * setting current turn to the first player.
     *
     * If all players have pre-passed (clicked "no afters" during WHEN phase),
     * recursively advance to the following phase.
     *
     * @returns {void}
     */
    resetForCurrentState() {
        // Make sure desk UIs exist before trying to use them.
        this.maybeCreateDeskUI();

        const onResetPlanetCards = () => {
            TabAgenda.resetPlanetCards();
        };
        const onNext = (button, player) => {
            this._stateMachine.next();
            this.resetForCurrentState();
        };
        const onCancel = (button, player) => {
            this._stateMachine = undefined;
            this.resetForCurrentState();
        };
        const onOutcomeType = (outcomeType) => {
            this._outcomeType = outcomeType;
            this._outcomeNames =
                AgendaOutcome.getDefaultOutcomeNames(outcomeType);
            this._stateMachine.next();
            this.resetForCurrentState();
        };
        const outcomeButtonTextsAndOnClicks = [
            {
                text: locale("ui.agenda.outcome_type.for_against"),
                onClick: (button, player) => {
                    onOutcomeType(OUTCOME_TYPE.FOR_AGAINST);
                },
            },
            {
                text: locale("ui.agenda.outcome_type.player"),
                onClick: (button, player) => {
                    onOutcomeType(OUTCOME_TYPE.PLAYER);
                },
            },
            {
                text: locale("ui.agenda.outcome_type.other"),
                onClick: (button, player) => {
                    onOutcomeType(OUTCOME_TYPE.OTHER);
                },
            },
        ];

        // Abort if not active.
        if (!this._stateMachine) {
            this._widget.setChild(
                AgendaUiMain.simpleButton(
                    locale("ui.agenda.clippy.place_agenda_to_start"),
                    locale("ui.agenda.clippy.reset_cards"),
                    onResetPlanetCards
                )
            );
            return;
        }

        let order;
        let summary = "";

        switch (this._stateMachine.main) {
            case "START.MAIN":
                this._widget.setChild(
                    AgendaUiMain.simpleYesNo(
                        locale("ui.agenda.clippy.would_you_like_help"),
                        onNext,
                        onCancel
                    )
                );
                break;
            case "OUTCOME_TYPE.MAIN":
                this._widget.setChild(
                    AgendaUiMain.simpleButtonList(
                        locale("ui.agenda.clippy.outcome_category"),
                        outcomeButtonTextsAndOnClicks
                    )
                );
                break;
            case "WHEN.MAIN":
                this._widget.setChild(
                    AgendaUiMain.simple(locale("ui.agenda.clippy.whens"))
                );
                order = AgendaTurnOrder.getResolveOrder();
                world.TI4.turns.setTurnOrder(order);
                if (!this.updatePassedAndSetTurnForPhase()) {
                    this._stateMachine.next();
                    this.resetForCurrentState();
                    return;
                }
                break;
            case "AFTER.MAIN":
                this._widget.setChild(
                    AgendaUiMain.simple(locale("ui.agenda.clippy.afters"))
                );
                order = AgendaTurnOrder.getResolveOrder();
                world.TI4.turns.setTurnOrder(order);
                if (!this.updatePassedAndSetTurnForPhase()) {
                    this._stateMachine.next();
                    this.resetForCurrentState();
                    return;
                }
                break;
            case "VOTE.MAIN":
                this._widget.setChild(
                    AgendaUiMain.simple(locale("ui.agenda.clippy.voting"))
                );
                order = AgendaTurnOrder.getVoteOrder();
                world.TI4.turns.setTurnOrder(order);
                if (!this.updatePassedAndSetTurnForPhase()) {
                    this._stateMachine.next();
                    this.resetForCurrentState();
                    return;
                }
                break;
            case "POST.MAIN":
                this._widget.setChild(
                    AgendaUiMain.simple(locale("ui.agenda.clippy.post"))
                );
                order = AgendaTurnOrder.getResolveOrder();
                world.TI4.turns.setTurnOrder(order);
                world.TI4.turns.setCurrentTurn(order[0], undefined);
                this.resetForCurrentState();
                break;
            case "FINISH.MAIN":
                summary = AgendaUiDesk.summarizeVote(this._deskUIs);
                summary = locale("ui.agenda.clippy.outcome", {
                    outcome: summary,
                });
                this._stateMachine = undefined;
                this.resetForCurrentState();
                this._widget.setChild(
                    AgendaUiMain.simpleButton(
                        summary,
                        locale("ui.agenda.clippy.reset_cards"),
                        onResetPlanetCards
                    )
                );
                Broadcast.chatAll(summary);
                break;
            default:
                throw new Error(`unknown state "${this._stateMachine.main}"`);
        }

        this.updateWaitingForMessage();

        // Discard them when finished.
        this.maybeDestroyDeskUI();
    }

    updateWaitingForMessage() {
        if (!this._stateMachine || !this._deskUIs) {
            return;
        }
        if (this._stateMachine.main === "WHEN.MAIN") {
            AgendaUiDesk.updateWaitingForWhen(this._deskUIs);
        } else if (this._stateMachine.main === "AFTER.MAIN") {
            AgendaUiDesk.updateWaitingForAfter(this._deskUIs);
        } else if (this._stateMachine.main === "VOTE.MAIN") {
            AgendaUiDesk.updateWaitingForVote(this._deskUIs);
        }
    }

    maybeCreateDeskUI() {
        if (!this._stateMachine || !this._outcomeNames) {
            return;
        }
        if (this._deskUIs) {
            return;
        }

        const callbacks = {
            onNoWhens: (playerDesk, clickingPlayer) => {
                this._passForPhase(playerDesk, clickingPlayer, "WHEN.MAIN");
            },
            onPlayWhen: (playerDesk, clickingPlayer) => {
                const playerName = capitalizeFirstLetter(playerDesk.colorName);
                Broadcast.chatAll(
                    locale("ui.agenda.clippy.playing_when_player_name", {
                        playerName,
                    })
                );
                if (
                    this._stateMachine.main === "WHEN.MAIN" &&
                    world.TI4.turns.getCurrentTurn() === playerDesk
                ) {
                    world.TI4.turns.endTurn(clickingPlayer);
                }
            },
            onNoAfters: (playerDesk, clickingPlayer) => {
                this._passForPhase(playerDesk, clickingPlayer, "AFTER.MAIN");
            },
            onPlayAfter: (playerDesk, clickingPlayer) => {
                const playerName = capitalizeFirstLetter(playerDesk.colorName);
                Broadcast.chatAll(
                    locale("ui.agenda.clippy.playing_after_player_name", {
                        playerName,
                    })
                );
                if (
                    this._stateMachine.main === "AFTER.MAIN" &&
                    world.TI4.turns.getCurrentTurn() === playerDesk
                ) {
                    world.TI4.turns.endTurn(clickingPlayer);
                }
            },
            onVoteLocked: (playerDesk, clickingPlayer, isLocked) => {
                this._passForPhase(playerDesk, clickingPlayer, "VOTE.MAIN");
            },
        };

        // Create if missing.
        this._deskUIs = [];
        for (const playerDesk of world.TI4.getAllPlayerDesks()) {
            const deskUi = new AgendaUiDesk(
                playerDesk,
                this._outcomeNames,
                this._outcomeType === OUTCOME_TYPE.OTHER,
                this._deskIndexToAvailableVotes,
                callbacks
            );
            deskUi.attach();
            this._deskUIs.push(deskUi);
        }
        for (const deskUi of this._deskUIs) {
            deskUi.setPeers(this._deskUIs);
        }
    }

    maybeDestroyDeskUI() {
        if (!this._stateMachine || !this._outcomeNames) {
            if (this._deskUIs) {
                for (const deskUI of this._deskUIs) {
                    deskUI.detach();
                }
            }
            this._deskUIs = undefined;
        }
    }

    /**
     * Called when player clicks "no whens", "no afters", or "vote locked".
     * If in the linked phase AND it was the clicking player's turn, advance
     * to the next state.
     *
     * Do not process that next state here, regenerate the main UI and it will
     * advance state again if all players have early-passed for the next phase.
     *
     * @param {PlayerDesk} playerDesk
     * @param {Player} clickingPlayer
     * @param {string} stateMachineMain
     * @returns {void}
     */
    _passForPhase(playerDesk, clickingPlayer, stateMachineMain) {
        assert(playerDesk);
        assert(clickingPlayer instanceof Player);
        assert(typeof stateMachineMain === "string");

        assert(
            stateMachineMain === "WHEN.MAIN" ||
                stateMachineMain === "AFTER.MAIN" ||
                stateMachineMain === "VOTE.MAIN"
        );

        if (this._stateMachine.main !== stateMachineMain) {
            return; // not in this phase (early pass)
        }

        // It is the correct phase, mark passed and advance turn.
        world.TI4.turns.setPassed(playerDesk.playerSlot, true);
        if (world.TI4.turns.getCurrentTurn() !== playerDesk) {
            return; // Not our turn (early pass)
        }

        // At this point it is correct phase and our turn.
        if (!world.TI4.turns.isTurnOrderEmpty()) {
            world.TI4.turns.endTurn(clickingPlayer);
            return; // Advance to next player, same phase
        }

        // Everyone passed.  Advance phases and reset UI to process it.
        this._stateMachine.next();
        this.resetForCurrentState();
    }

    updatePassedAndSetTurnForPhase() {
        world.TI4.turns.clearAllPassed();
        if (!this._deskUIs) {
            return false;
        }

        // Players can click "no whens", etc, early.  Mark them as passed when
        // changing to a new state.
        const passedSlotSet = new Set();
        for (const deskUi of this._deskUIs) {
            let active = true;
            assert(typeof deskUi._noWhens === "boolean");
            if (this._stateMachine.main === "WHEN.MAIN" && deskUi._noWhens) {
                active = false;
            }
            assert(typeof deskUi._noAfters === "boolean");
            if (this._stateMachine.main === "AFTER.MAIN" && deskUi._noAfters) {
                active = false;
            }
            assert(typeof deskUi._voteLocked === "boolean");
            if (this._stateMachine.main === "VOTE.MAIN" && deskUi._voteLocked) {
                active = false;
            }
            if (!active) {
                if (!world.__isMock) {
                    console.log(
                        `TabAgenda.updatePassedAndSetTurnForPhase: ${deskUi._playerDesk.colorName} passing`
                    );
                }
                const playerSlot = deskUi._playerDesk.playerSlot;
                passedSlotSet.add(playerSlot);
                world.TI4.turns.setPassed(playerSlot, true);
            }
        }

        // Set turn to first unpassed player.
        const order = world.TI4.turns.getTurnOrder();
        for (const desk of order) {
            if (passedSlotSet.has(desk.playerSlot)) {
                continue;
            }
            world.TI4.turns.setCurrentTurn(desk, undefined);
            return true;
        }

        // If we get here all players have passed.
        return false;
    }
}

module.exports = { TabAgenda };
