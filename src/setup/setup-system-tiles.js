const assert = require("../wrapper/assert");
const { ObjectNamespace } = require("../lib/object-namespace");
const { Spawn } = require("./spawn/spawn");
const { System } = require("../lib/system/system");
const { Rotator, Vector, world } = require("../wrapper/api");
const { AbstractSetup } = require("./abstract-setup");

class SetupSystemTiles extends AbstractSetup {
    constructor() {
        super();
    }

    setup() {
        const pos = new Vector(0, 100, world.getTableHeight() + 5);
        const rot = new Rotator(0, 0, 0);
        const bag = Spawn.spawnGenericContainer(pos, rot);

        const nsids = Spawn.getAllNSIDs().filter((nsid) => {
            const parsedNsid = ObjectNamespace.parseNsid(nsid);
            return (
                parsedNsid.type.startsWith("tile.system") &&
                !parsedNsid.source.startsWith("homebrew")
            );
        });
        for (const nsid of nsids) {
            const above = pos.add([0, 0, 20]);
            const obj = Spawn.spawn(nsid, above, rot);

            // Sanity check system tile before adding it.
            const parsed = ObjectNamespace.parseSystemTile(obj);
            assert(parsed);
            const system = System.getByTile(parsed.tile);
            assert(system);

            bag.addObjects([obj]);
        }
    }
}

module.exports = { SetupSystemTiles };
