const assert = require("../../wrapper/assert-wrapper");

/**
 * main: main UI state
 * active: active player's desk (missing for none)
 * waiting: not-active players' desks (missing for none)
 * next: "continue" to this state
 */
const STATES = {
    START: {
        main: "START.MAIN",
        next: "OUTCOME_TYPE",
    },
    OUTCOME_TYPE: {
        main: "OUTCOME_TYPE.MAIN",
        next: "WHEN",
    },
    WHEN: {
        main: "WHEN.MAIN",
        desk: "WHEN-AFTER.DESK",
        next: "AFTER",
    },
    AFTER: {
        main: "AFTER.MAIN",
        desk: "WHEN-AFTER.DESK",
        next: "VOTE",
    },
    VOTE: {
        main: "VOTE.MAIN",
        desk: "VOTE.DESK",
        next: "FINISH",
    },
    FINISH: {
        main: "FINISH.MAIN",
        next: "START",
    },
};

class AgendaStateMachine {
    constructor() {
        this._state = STATES.START;
    }

    get main() {
        return this._state.main;
    }

    get desk() {
        return this._state.desk;
    }

    /**
     * Advance the active state.  If the current state has an active state
     * list advance the index.  If at the end or if no active state list,
     * move to the "next" state.
     *
     * @returns {AgendaStateMachine} self, for chaining
     */
    next() {
        this._state = STATES[this._state.next];
        assert(this._state);
        return this;
    }
}

module.exports = { AgendaStateMachine };
