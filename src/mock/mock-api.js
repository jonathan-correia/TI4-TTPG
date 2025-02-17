// If using any custom events or world methods, require global.js to register them!

// Export under the mock names so tests can be explicit they are not using TTPG objects.
Object.assign(module.exports, {
    MockBorder: require("./mock-border"),
    MockButton: require("./mock-button"),
    MockCanvas: require("./mock-canvas"),
    MockCard: require("./mock-card"),
    MockCardDetails: require("./mock-card-details"),
    MockCardHolder: require("./mock-card-holder"),
    MockCheckBox: require("./mock-check-box"),
    MockColor: require("./mock-color"),
    MockContainer: require("./mock-container"),
    MockDice: require("./mock-dice"),
    MockDrawingLine: require("./mock-drawing-line"),
    MockGameObject: require("./mock-game-object"),
    MockGameWorld: require("./mock-game-world"),
    MockGlobalScriptingEvents: require("./mock-global-scripting-events"),
    MockHiddenCardsType: require("./mock-hidden-cards-type"),
    MockHorizontalAlignment: require("./mock-horizontal-alignment"),
    MockHorizontalBox: require("./mock-horizontal-box"),
    MockImageButton: require("./mock-image-button"),
    MockImageWidget: require("./mock-image-widget"),
    MockLayoutBox: require("./mock-layout-box"),
    MockMultilineTextBox: require("./mock-multiline-text-box"),
    MockObjectType: require("./mock-object-type"),
    MockPanel: require("./mock-panel"),
    MockPlayer: require("./mock-player"),
    MockPlayerPermission: require("./mock-player-permission"),
    MockRotator: require("./mock-rotator"),
    MockScreenUIElement: require("./mock-screen-ui-element"),
    MockSlider: require("./mock-slider"),
    MockSound: require("./mock-sound"),
    MockText: require("./mock-text"),
    MockTextBox: require("./mock-text-box"),
    MockTextJustification: require("./mock-text-justification"),
    MockTextWidgetBase: require("./mock-text-widget-base"),
    MockUIElement: require("./mock-ui-element"),
    MockUIPresentationStyle: require("./mock-ui-presentation-style"),
    MockVector: require("./mock-vector"),
    MockVerticalAlignment: require("./mock-vertical-alignment"),
    MockVerticalBox: require("./mock-vertical-box"),
    MockWidget: require("./mock-widget"),
    MockZone: require("./mock-zone"),
    MockZonePermission: require("./mock-zone-permission"),
    MockZoneShape: require("./mock-zone-shape"),
});

// Export under the TTPG api names for unaware consumers.
Object.assign(module.exports, {
    Border: module.exports.MockBorder,
    Button: module.exports.MockButton,
    Canvas: module.exports.MockCanvas,
    Card: module.exports.MockCard,
    CardDetails: module.exports.MockCardDetails,
    CardHolder: module.exports.MockCardHolder,
    CheckBox: module.exports.MockCheckBox,
    Color: module.exports.MockColor,
    Container: module.exports.MockContainer,
    Dice: module.exports.MockDice,
    DrawingLine: module.exports.MockDrawingLine,
    GameObject: module.exports.MockGameObject,
    GameWorld: module.exports.MockGameWorld,
    GlobalScriptingEvents: module.exports.MockGlobalScriptingEvents,
    HiddenCardsType: module.exports.MockHiddenCardsType,
    HorizontalAlignment: module.exports.MockHorizontalAlignment,
    HorizontalBox: module.exports.MockHorizontalBox,
    ImageButton: module.exports.MockImageButton,
    ImageWidget: module.exports.MockImageWidget,
    LayoutBox: module.exports.MockLayoutBox,
    MultilineTextBox: module.exports.MockMultilineTextBox,
    ObjectType: module.exports.MockObjectType,
    Panel: module.exports.MockPanel,
    Player: module.exports.MockPlayer,
    PlayerPermission: module.exports.MockPlayerPermission,
    Rotator: module.exports.MockRotator,
    ScreenUIElement: module.exports.MockScreenUIElement,
    Slider: module.exports.MockSlider,
    Sound: module.exports.MockSound,
    Text: module.exports.MockText,
    TextBox: module.exports.MockTextBox,
    TextJustification: module.exports.MockTextJustification,
    TextWidgetBase: module.exports.MockTextWidgetBase,
    UIElement: module.exports.MockUIElement,
    UIPresentationStyle: module.exports.MockUIPresentationStyle,
    Vector: module.exports.MockVector,
    VerticalAlignment: module.exports.MockVerticalAlignment,
    VerticalBox: module.exports.MockVerticalBox,
    Widget: module.exports.MockWidget,
    Zone: module.exports.MockZone,
    ZonePermission: module.exports.MockZonePermission,
    ZoneShape: module.exports.MockZoneShape,
});

// SHARE global objects.
const globalEvents = new module.exports.GlobalScriptingEvents();
const world = new module.exports.GameWorld();

// 'refObject' is tricky, it should be per-object and potentially meaningful.
// Create a dummy catch-all, specific tests can override if needed.
const refObject = new module.exports.GameObject();

// Create TTPG runtime objects.
Object.assign(module.exports, {
    refObject,
    globalEvents,
    world,
});
