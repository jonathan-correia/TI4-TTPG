const { CardUtil } = require("../lib/card/card-util");
const { PlayerDesk } = require("../lib/player-desk");
const { AbstractSetup } = require("./abstract-setup");

const TECH_DECK_LOCAL_OFFSET = { x: 11, y: -24, z: 7 };

class SetupGenericTechDeck extends AbstractSetup {
    constructor(playerDesk) {
        super(playerDesk);
    }

    setup() {
        const pos = this.playerDesk.localPositionToWorld(
            TECH_DECK_LOCAL_OFFSET
        );
        const rot = this.playerDesk.rot;

        const nsidPrefix = "card.technology";
        this.spawnDecksThenFilter(pos, rot, nsidPrefix, (nsid) => {
            // "card.technology.red", "card.technology.red.muaat"
            // Accept any that don't have a third component.
            return !this.parseNsidGetTypePart(nsid, nsidPrefix, 3);
        });
    }

    clean() {
        const cards = CardUtil.gatherCards((nsid, cardOrDeck) => {
            if (!nsid.startsWith("card.technology")) {
                return false;
            }
            const pos = cardOrDeck.getPosition();
            const closestDesk = PlayerDesk.getClosest(pos);
            return closestDesk === this.playerDesk;
        });
        for (const card of cards) {
            card.destroy();
        }
    }
}

module.exports = { SetupGenericTechDeck, TECH_DECK_LOCAL_OFFSET };
