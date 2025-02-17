// the "it(string, function)" style works with mocha and jest frameworks
const { validate, parse, format } = require("./map-string-parser");
const assert = require("assert");

// test validation
it("validate with numeric only", () => {
    assert.equal(validate("7 18 23"), true);
});

it("validate with 0 and -1", () => {
    assert.equal(validate("7 0 -1"), true);
});

it("validate with only mecatol", () => {
    assert.equal(validate(""), true);
});

it("validate with custom home tile", () => {
    assert.equal(validate("{4} 7 18 23"), true);
});

it("validate with side and rotation", () => {
    assert.equal(validate("7 83B2"), true);
});

it("validate start with side and rotation", () => {
    assert.equal(validate("83b2"), true);
});

it("validate supports multiple and mixed delimiters", () => {
    assert.deepEqual(validate("{4}   ,7   18,   23"), true);
});

it("validate supports upper or lower case side values", () => {
    assert.equal(validate("7 83B2"), true);
});

it("validate does not support invalid map string", () => {
    assert.notEqual(validate("7 83B2 75B"), true);
});

it("validate does not support invalid characters", () => {
    assert.notEqual(validate("{4} ^  ,7 $  18,   23"), true);
});

// test parsing
it("parse empty", () => {
    assert.deepEqual(parse(""), [{ tile: 18 }]);
});

it("parse with numeric only", () => {
    assert.deepEqual(parse("7 18 23"), [
        { tile: 18 },
        { tile: 7 },
        { tile: 18 },
        { tile: 23 },
    ]);
});

it("parse with 0 and -1", () => {
    assert.deepEqual(parse("7 0 -1"), [
        { tile: 18 },
        { tile: 7 },
        { tile: 0 },
        { tile: -1 },
    ]);
});

it("parse with custom home tile", () => {
    assert.deepEqual(parse("{4} 7 18 23"), [
        { tile: 4 },
        { tile: 7 },
        { tile: 18 },
        { tile: 23 },
    ]);
});

it("parse with side and rotation", () => {
    assert.deepEqual(parse("7 83b2"), [
        { tile: 18 },
        { tile: 7 },
        { tile: 83, side: "b", rotation: 2 },
    ]);
});
it("parse start with side and rotation", () => {
    assert.deepEqual(parse("{83b2}"), [{ tile: 83, side: "b", rotation: 2 }]);
});

it("parse supports multiple and mixed delimiters", () => {
    assert.deepEqual(parse("{4}   ,7   18,   23"), [
        { tile: 4 },
        { tile: 7 },
        { tile: 18 },
        { tile: 23 },
    ]);
});

it("validate supports upper or lower case side values", () => {
    assert.deepEqual(parse("7 83B2"), [
        { tile: 18 },
        { tile: 7 },
        { tile: 83, side: "b", rotation: 2 },
    ]);
});

it("parse throws for invalid map string", () => {
    assert.throws(() => parse("7 83B2 75B"));
});

it("parse throws for support invalid characters", () => {
    assert.throws(() => parse("{4} ^  ,7 $  18,   23"));
});

// test formatting
it("format with numeric only", () => {
    assert.equal(
        format([{ tile: 18 }, { tile: 7 }, { tile: 18 }, { tile: 23 }]),
        "7 18 23"
    );
});

it("format with custom home tile", () => {
    assert.equal(
        format([{ tile: 4 }, { tile: 7 }, { tile: 18 }, { tile: 23 }]),
        "{4} 7 18 23"
    );
});

it("format with side and rotation", () => {
    assert.equal(
        format([
            { tile: 18 },
            { tile: 7 },
            { tile: 83, side: "b", rotation: 2 },
        ]),
        "7 83B2"
    );
});

it("format with missing tile", () => {
    const mapTiles = [];
    (mapTiles[0] = { tile: 18 }),
        (mapTiles[1] = { tile: 1 }),
        (mapTiles[3] = { tile: 3 }),
        assert.equal(format(mapTiles), "1 -1 3");
});
