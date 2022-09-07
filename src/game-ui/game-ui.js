const assert = require("../wrapper/assert-wrapper");
const locale = require("../lib/locale");
const { AutoRoller } = require("../objects/roller/auto-roller");
const { GameSetup } = require("../setup/game-setup/game-setup");
const { MapTool } = require("./tab-map/tab-map-tool/map-tool");
const {
    MiltyDraftSettings,
} = require("./tab-map/tab-draft/tab-milty/milty-draft-settings");
const { NavEntry } = require("../lib/ui/nav/nav-entry");
const { NavPanel } = require("../lib/ui/nav/nav-panel");
const { NavFolder } = require("../lib/ui/nav/nav-folder");
const { ObjectNamespace } = require("../lib/object-namespace");
const { PremadeMap } = require("./tab-map/tab-premade/premade-map");
const {
    SCPTDraftSettings,
} = require("./tab-map/tab-draft/tab-scpt/scpt-draft-settings");
const { TabAction } = require("./tab-action/tab-action");
const { TabAgenda } = require("./tab-agenda/tab-agenda");
const { TabBagDraft } = require("./tab-map/tab-draft/tab-bag/tab-bag");
const { TabbedPanel } = require("../lib/ui/tabbed-panel");
const { TabHelpUI } = require("./tab-help/tab-help-ui");
const { TableLayout } = require("../table/table-layout");
const { TabMap } = require("./tab-map/tab-map");
const { TabStrategy } = require("./tab-strategy/tab-strategy");
const { TabStatus } = require("./tab-status/tab-status");
const { TurnOrderPanel } = require("../lib/ui/turn-order-panel");
const CONFIG = require("./game-ui-config");
const {
    Border,
    HorizontalBox,
    LayoutBox,
    Rotator,
    UIElement,
    Vector,
    globalEvents,
    world,
} = require("../wrapper/api");
const { TabDisplay } = require("./tab-map/tab-display/tab-display");
const { TabFogOfWar } = require("./tab-map/tab-fog/tab-fog");

/**
 * The "Savant", collected game UI and utilities organized into tabs.
 * This has grown rapidly, it deserves a user experience rethink.
 */
class GameUI {
    constructor() {
        const anchor = TableLayout.anchor.gameUI;

        this._layout = new LayoutBox().setPadding(
            CONFIG.padding,
            CONFIG.padding,
            CONFIG.padding,
            CONFIG.padding
        );

        this._uiElement = new UIElement();
        this._uiElement.scale = 1 / CONFIG.scale;
        this._uiElement.width = anchor.width * CONFIG.scale;
        this._uiElement.height = anchor.height * CONFIG.scale;
        this._uiElement.useWidgetSize = false;

        this._uiElement.position = new Vector(
            anchor.pos.x,
            anchor.pos.y,
            world.getTableHeight() + 0.01
        );
        this._uiElement.rotation = new Rotator(0, anchor.yaw, 0);
        this._uiElement.widget = new Border().setChild(this._layout);

        world.addUI(this._uiElement);

        globalEvents.TI4.onGameSetup.add(() => {
            this.fill();
        });

        // Resetting scripting may orphan zones.
        this.destroyNopeZone();
        this.createNopeZone();
    }

    destroyNopeZone() {
        for (const zone of world.getAllZones()) {
            if (zone.getSavedData() === "game-ui-nope-zone") {
                zone.destroy();
            }
        }
    }

    /**
     * Create a zone to keep objects from laying atop.
        // A card on the UI can't be picked up without selection drag
        // b/c UI takes pointer.
     */
    createNopeZone() {
        const anchor = TableLayout.anchor.gameUI;

        const zoneHeight = 0.5;
        const zonePos = new Vector(
            anchor.pos.x,
            anchor.pos.y,
            world.getTableHeight() + zoneHeight / 2
        );
        const zoneRot = new Rotator(0, anchor.yaw, 0);
        const zoneScale = new Vector(
            anchor.height / 10,
            anchor.width / 10,
            zoneHeight
        );
        const zone = world.createZone(zonePos);
        zone.setSavedData("game-ui-nope-zone");
        zone.setRotation(zoneRot);
        zone.setScale(zoneScale);
        zone.setColor([1, 0, 0, 0.2]);
        zone.setAlwaysVisible(false);
        zone.onBeginOverlap.add((zone, obj) => {
            const nsid = ObjectNamespace.getNsid(obj);
            console.log(`GameUI.onBeginOverlap: "${nsid}"`);

            // Move to outside zone.
            const x = 25 + Math.random() * 5;
            const y = 70 + Math.random() * 5;
            const z = world.getTableHeight() + 20 + Math.random() * 3;
            const outside = new Vector(x, y, z);
            obj.setPosition(outside, 1);
        });
        zone.onEndOverlap.add((zone, obj) => {
            const nsid = ObjectNamespace.getNsid(obj);
            console.log(`GameUI.onEndOverlap: "${nsid}"`);
        });
    }

    fill() {
        if (world.TI4.config.timestamp <= 0) {
            this.fillForSetup();
        } else {
            this.fillForGame();
        }
    }

    fillForSetup() {
        const gameSetup = new GameSetup();
        this._layout.setChild(gameSetup.getUI());
    }

    fillForGame() {
        const panel = new HorizontalBox().setChildDistance(CONFIG.spacing);
        this._layout.setChild(panel);

        const turnOrderPanel = new TurnOrderPanel()
            .setFontSize(CONFIG.fontSize)
            .setSpacing(CONFIG.spacing);
        const navPanel = new NavPanel();

        panel.addChild(turnOrderPanel, 1);
        panel.addChild(new Border().setColor(CONFIG.spacerColor));
        panel.addChild(navPanel, 4);

        this.fillNavPanel(navPanel);
        navPanel.setCurrentNavEntry(navPanel.getRootFolder());
    }

    _createDraftFolder() {
        const draftFolder = new NavFolder().setName(locale("nav.map.draft"));

        const miltyDraftEntry = new NavEntry()
            .setName(locale("nav.map.draft.milty"))
            .setWidgetFactory((navPanel, navEntry) => {
                return new MiltyDraftSettings().getUI();
            });
        draftFolder.addChild(miltyDraftEntry);

        const scptDraftSettings = new NavEntry()
            .setName(locale("nav.map.draft.scpt"))
            .setWidgetFactory((navPanel, navEntry) => {
                return new SCPTDraftSettings().getUI();
            });
        draftFolder.addChild(scptDraftSettings);

        const bagDraft = new NavEntry()
            .setName(locale("nav.map.draft.bag"))
            .setWidgetFactory((navPanel, navEntry) => {
                return new TabBagDraft().getUI();
            });
        draftFolder.addChild(bagDraft);

        return draftFolder;
    }

    _createMapFolder() {
        const mapFolder = new NavFolder().setName(locale("nav.map"));

        const mapToolEntry = new NavEntry()
            .setName(locale("nav.map.maptool"))
            .setWidgetFactory((navPanel, navEntry) => {
                return new MapTool().getUI();
            });
        mapFolder.addChild(mapToolEntry);

        const premadeMapsEntry = new NavEntry()
            .setName(locale("nav.map.premade"))
            .setWidgetFactory((navPanel, navEntry) => {
                return new PremadeMap().getUI();
            });
        mapFolder.addChild(premadeMapsEntry);

        const draftFolder = this._createDraftFolder();
        mapFolder.addChild(draftFolder);

        const factionBordersEntry = new NavEntry()
            .setName(locale("nav.map.borders"))
            .setWidgetFactory((navPanel, navEntry) => {
                return new TabDisplay().getUI();
            });
        mapFolder.addChild(factionBordersEntry);

        const fogOfWarEntry = new NavEntry()
            .setName(locale("nav.map.fog"))
            .setWidgetFactory((navPanel, navEntry) => {
                return new TabFogOfWar().getUI();
            });
        mapFolder.addChild(fogOfWarEntry);

        return mapFolder;
    }

    _createActionPhaseFolder(navPanel) {
        assert(navPanel instanceof NavPanel);

        const actionPhaseFolder = new NavFolder().setName(
            locale("nav.action_phase")
        );

        const autoRoller = new AutoRoller(); // adds event handlers, reuse one instance
        const autoRollerEntry = new NavEntry()
            .setName(locale("nav.autoroller"))
            .setIconPath("global/ui/icons/d6.png")
            .setWidgetFactory((navPanel, navEntry) => {
                return autoRoller.getUI();
            });
        actionPhaseFolder.addChild(autoRollerEntry);
        globalEvents.TI4.onSystemActivated.add((systemTileObj, player) => {
            navPanel.setCurrentNavEntry(autoRollerEntry);
        });

        return actionPhaseFolder;
    }

    fillNavPanel(navPanel) {
        assert(navPanel instanceof NavPanel);
        const rootFolder = navPanel.getRootFolder();

        // Help.
        const helpEntry = new NavEntry()
            .setName(locale("nav.help"))
            .setIconPath("global/ui/icons/help.png")
            .setWidgetFactory((navPanel, navEntry) => {
                return new TabHelpUI();
            });
        rootFolder.addChild(helpEntry);

        // Map.
        const mapFolder = this._createMapFolder();
        rootFolder.addChild(mapFolder);

        // Phases.
        const strategyPhaseEntry = new NavEntry()
            .setName(locale("nav.strategy_phase"))
            .setWidgetFactory((navPanel, navEntry) => {
                return new TabStrategy().getUI();
            });
        rootFolder.addChild(strategyPhaseEntry);

        const actionPhaseFolder = this._createActionPhaseFolder(navPanel);
        rootFolder.addChild(actionPhaseFolder);

        const statusPhaseEntry = new NavEntry()
            .setName(locale("nav.status_phase"))
            .setWidgetFactory((navPanel, navEntry) => {
                return new TabStatus().getUI();
            });
        rootFolder.addChild(statusPhaseEntry);

        const tabAgenda = new TabAgenda(); // registers event handler, reuse
        const agendaPhaseEntry = new NavEntry()
            .setName(locale("nav.agenda_phase"))
            .setWidgetFactory((navPanel, navEntry) => {
                return tabAgenda.getUI();
            });
        rootFolder.addChild(agendaPhaseEntry);
        globalEvents.TI4.onAgendaChanged.add((agendaCard) => {
            if (agendaCard) {
                navPanel.setCurrentNavEntry(agendaPhaseEntry);
            }
        });
    }

    fillForGameORIG() {
        const panel = new HorizontalBox().setChildDistance(CONFIG.spacing);
        this._layout.setChild(panel);

        const tabbedPanel = new TabbedPanel()
            .setFontSize(CONFIG.fontSize)
            .setSpacing(CONFIG.spacing);

        const turnOrderPanel = new TurnOrderPanel()
            .setFontSize(CONFIG.fontSize)
            .setSpacing(CONFIG.spacing);

        // Line between main UI and turn order.
        panel.addChild(turnOrderPanel, 1);
        panel.addChild(new Border().setColor(CONFIG.spacerColor));
        panel.addChild(tabbedPanel, 4);

        const tabHelp = new TabHelpUI();
        tabbedPanel.addTab(locale("ui.tab.help"), tabHelp, true);

        const tabMap = new TabMap();
        tabbedPanel.addTab(locale("ui.tab.map"), tabMap.getUI());

        const tabStrategy = new TabStrategy();
        tabbedPanel.addTab(
            locale("ui.tab.strategy_phase"),
            tabStrategy.getUI()
        );

        const tabAction = new TabAction();
        tabbedPanel.addTab(locale("ui.tab.action_phase"), tabAction.getUI());

        const tabStatus = new TabStatus();
        tabbedPanel.addTab(locale("ui.tab.status_phase"), tabStatus.getUI());

        const tabAgenda = new TabAgenda();
        tabbedPanel.addTab(locale("ui.tab.agenda_phase"), tabAgenda.getUI());

        globalEvents.TI4.onSystemActivated.add((systemTileObj, player) => {
            tabbedPanel.selectTab(locale("ui.tab.action_phase"));
        });
        globalEvents.TI4.onAgendaChanged.add((agendaCard) => {
            if (agendaCard) {
                tabbedPanel.selectTab(locale("ui.tab.agenda_phase"));
            }
        });
    }
}

const gameUI = new GameUI();

if (!world.__isMock) {
    process.nextTick(() => {
        gameUI.fill();
    });
}
