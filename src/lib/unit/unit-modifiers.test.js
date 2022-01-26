const assert = require('assert')
const { UnitModifiers } = require('./unit-modifiers')
const { UnitAttrs } = require('./unit-attrs')

it('apply', () => {
    const unitModifier = {
        localeName: 'unit_modifier.name.morale_boost',
        localeDescription: 'unit_modifier.desc.morale_boost',
        triggerNsids: [
            'card.action:base/morale_boost.1',
            'card.action:base/morale_boost.2',
            'card.action:base/morale_boost.3',
            'card.action:base/morale_boost.4'
        ],
        owner: 'self',
        type: 'adjust',
        isCombat: true,
        apply: (unitToUnitAttrs, selfUnits, opponentUnits) => {
            for (const unitAttrs of Object.values(unitToUnitAttrs)) {
                if (unitAttrs.spaceCombat) {
                    unitAttrs.spaceCombat.hit -= 1
                }
                if (unitAttrs.groundCombat) {
                    unitAttrs.groundCombat.hit -= 1
                }
            }
        }
    }

    const unitToUnitAttrs = UnitAttrs.defaultUnitToUnitAttrs()
    assert.equal(unitToUnitAttrs.fighter.spaceCombat.hit, 9)
    assert.equal(unitToUnitAttrs.infantry.groundCombat.hit, 8)

    UnitModifiers.apply(unitToUnitAttrs, unitModifier)
    assert.equal(unitToUnitAttrs.fighter.spaceCombat.hit, 8)
    assert.equal(unitToUnitAttrs.infantry.groundCombat.hit, 7)
})

it('applyMultiple order', () => {
    const mutate = {
        localeName: 'x',
        localeDescription: 'x',
        owner: 'self',
        type: 'mutate',
        apply: (unitToUnitAttrs, auxData) => {}
    }
    const adjust = {
        localeName: 'x',
        localeDescription: 'x',
        owner: 'self',
        type: 'adjust',
        apply: (unitToUnitAttrs, auxData) => {}
    }
    const choose = {
        localeName: 'x',
        localeDescription: 'x',
        owner: 'self',
        type: 'choose',
        apply: (unitToUnitAttrs, auxData) => {}
    }
    const unitToUnitAttrs = UnitAttrs.defaultUnitToUnitAttrs()

    let modifiers = [ mutate, adjust, choose ]
    let order = UnitModifiers.applyMultiple(unitToUnitAttrs, modifiers)
    order = order.map(modifier => modifier.type)
    assert.deepEqual(order, [ 'mutate', 'adjust', 'choose'] )

    modifiers = [ choose, adjust, mutate ]
    order = UnitModifiers.applyMultiple(unitToUnitAttrs, modifiers)
    order = order.map(modifier => modifier.type)
    assert.deepEqual(order, [ 'mutate', 'adjust', 'choose'] )

    modifiers = [ adjust, choose, mutate ]
    order = UnitModifiers.applyMultiple(unitToUnitAttrs, modifiers)
    order = order.map(modifier => modifier.type)
    assert.deepEqual(order, [ 'mutate', 'adjust', 'choose'] )
})