import { Edge, Node } from '@xyflow/react';
import { Family, Index, Marriage } from 'model';
import { KNOWN_PERSON } from 'view/node';

export const NODE_WIDTH = 140;
export const NODE_HEIGHT = 70;
export const MARRIAGE_NODE_SIZE = 10;
const MARRIAGE_GAP = 20;
const NODES_GAP = 40;

// +------------+                             +------------+
// |  parent1   |--------------o--------------|  parent2   |
// +------------+                             +------------+
//
// | NODE_WIDTH | MARRIAGE_GAP | MARRIAGE_GAP | NODE_WIDTH |
// |                    MARRIAGE_WIDTH                     |
const MARRIAGE_WIDTH = (NODE_WIDTH + MARRIAGE_GAP) * 2;

const LEFT_SIDE = 'left_side';
const RIGHT_SIDE = 'right_side';

type Side = 'left_side' | 'right_side';

type Perspective = {
    // Sibling id.
    id: string;
    // Perspective side. The sibling with this id will be places at the specified side in the siblings nodes list.
    side: Side;
};

// PreNode is used during the layout computation.
// It represents a node in the preliminary layout tree.
type SiblingsUnit = {
    // All siblings ids for this family unit.
    siblings: string[];
    // The sibling id that must be placed at the leftmost position among siblings.
    leftSibling: string | null;
    // The sibling id that must be placed at the rightmost position among siblings.
    rightSibling: string | null;
    // The x coordinate of the node. This is not the final x coordinate, but before applying modifiers.
    x: number;
    // The width of the node.
    width: number;
    // The mod modifier for the x coordinate. It shifts the node subtree to the right.
    mod: number;
    // The shift modifier for the x coordinate. It shifts node and its subtree to the right.
    shift: number;
};

function getPersonSiblings(personId: string, family: Index): string[] {
    const parentsMarriageId = family.personParents.get(personId);
    if (!parentsMarriageId) {
        // Person does not have parents and do not have any siblings.
        return [personId];
    }

    const marriage = family.marriageById.get(parentsMarriageId);
    if (!marriage) {
        throw new Error(`expected marriage to exist. Child id: ${personId}`);
    }

    return marriage.children_ids;
}

function getSingleSiblingsWidth(sibling: string[]): number {
    return sibling.length * NODE_WIDTH + (sibling.length - 1) * NODES_GAP;
}

function getPersonSpouseId(personId: string, family: Index): string | null {
    const marriages = family.personMarriages.get(personId);

    if (marriages) {
        if (marriages.length === 0) {
            return null;
        }

        // This sibling is married.
        if (!marriages[0] || marriages.length > 1) {
            throw new Error(`person (id=${personId}) has invalid marriages assigned`);
        }

        const marriage = marriages[0];

        if (marriage.parent1_id && marriage.parent1_id === personId) {
            if (marriage.parent2_id) {
                return marriage.parent2_id;
            } else {
                return null;
            }
        }

        if (marriage.parent2_id && marriage.parent2_id === personId) {
            if (marriage.parent1_id) {
                return marriage.parent1_id;
            } else {
                return null;
            }
        }

        throw new Error(`invalid marriage(${JSON.stringify(marriage)}) for person(id=${personId})`);
    }

    return null;
}

function findMarriedSibling(siblings: string[], family: Index, except: string): string | null {
    for (const sibling of siblings) {
        if (sibling === except) {
            continue;
        }

        const marriages = family.personMarriages.get(sibling);
        if (marriages) {
            // This sibling is married.
            if (!marriages[0] || marriages.length > 1) {
                throw new Error(`person (id=${sibling}) has invalid marriages assigned`);
            }

            return sibling;
        }
    }

    return null;
}

function getPersonSiblingUnit(personId: string, units: SiblingsUnit[]): SiblingsUnit | null {
    for (const unit of units) {
        if (unit.siblings.contains(personId)) {
            return unit;
        }
    }
    return null;
}

function getLeftmostParentUnit(
    unit: SiblingsUnit,
    units: SiblingsUnit[],
    family: Index,
): SiblingsUnit | null {
    if (!unit.siblings[0]) {
        throw new Error(`siblings array must contain at least one person`);
    }

    const parentsMarriageId = family.personParents.get(unit.siblings[0]);

    if (!parentsMarriageId) {
        return null;
    }

    const parentsMarriage = family.marriageById.get(parentsMarriageId);
    if (!parentsMarriage) {
        throw new Error(`expected marriage(id=${parentsMarriageId} to exist)`);
    }

    let parentUnit: SiblingsUnit | null = null;
    if (parentsMarriage.parent1_id) {
        const unit = getPersonSiblingUnit(parentsMarriage.parent1_id, units);
        if (!unit) {
            throw new Error(
                `expected sibling unit to exist for person(id=${parentsMarriage.parent1_id})`,
            );
        }

        parentUnit = unit;
    }

    if (parentsMarriage.parent2_id) {
        const unit = getPersonSiblingUnit(parentsMarriage.parent2_id, units);
        if (!unit) {
            throw new Error(
                `expected sibling unit to exist for person(id=${parentsMarriage.parent2_id})`,
            );
        }

        parentUnit = unit;
    }

    if (!parentUnit) {
        throw new Error(
            `invalid marriage(id=${parentsMarriageId}) detected: both parents are not defined`,
        );
    }

    let i = 0;
    while (true) {
        i += 1;

        if (parentUnit.leftSibling) {
            const spouseId = getPersonSpouseId(parentUnit.leftSibling, family);
            if (!spouseId) {
                // This is the last parallel family tree.
                return parentUnit;
            }

            const spouseUnit = getPersonSiblingUnit(spouseId, units);
            if (!spouseUnit) {
                throw new Error(
                    `spouse(id=${spouseId}) unit expected to exist (marriage(id=${parentsMarriageId}))`,
                );
            }

            parentUnit = spouseUnit;
        } else {
            return parentUnit;
        }

        if (i === 10) {
            throw new Error(`something wrong here i=${i}`);
        }
    }
}

function getRightmostParentUnit(
    unit: SiblingsUnit,
    units: SiblingsUnit[],
    family: Index,
): SiblingsUnit | null {
    if (!unit.siblings[0]) {
        throw new Error(`siblings array must contain at least one person`);
    }

    const parentsMarriageId = family.personParents.get(unit.siblings[0]);

    if (!parentsMarriageId) {
        return null;
    }

    const parentsMarriage = family.marriageById.get(parentsMarriageId);
    if (!parentsMarriage) {
        throw new Error(`expected marriage(id=${parentsMarriageId} to exist)`);
    }

    let parentUnit: SiblingsUnit | null = null;
    if (parentsMarriage.parent2_id) {
        const unit = getPersonSiblingUnit(parentsMarriage.parent2_id, units);
        if (!unit) {
            throw new Error(
                `expected sibling unit to exist for person(id=${parentsMarriage.parent2_id})`,
            );
        }

        parentUnit = unit;
    }

    if (parentsMarriage.parent1_id) {
        const unit = getPersonSiblingUnit(parentsMarriage.parent1_id, units);
        if (!unit) {
            throw new Error(
                `expected sibling unit to exist for person(id=${parentsMarriage.parent1_id})`,
            );
        }

        parentUnit = unit;
    }

    if (!parentUnit) {
        throw new Error(
            `invalid marriage(id=${parentsMarriageId}) detected: both parents are not defined`,
        );
    }

    let i = 0;
    while (true) {
        i += 1;

        if (parentUnit.rightSibling) {
            const spouseId = getPersonSpouseId(parentUnit.rightSibling, family);
            if (!spouseId) {
                // This is the last parallel family tree.
                return parentUnit;
            }

            const spouseUnit = getPersonSiblingUnit(spouseId, units);
            if (!spouseUnit) {
                throw new Error(
                    `spouse(id=${spouseId}) unit expected to exist (marriage(id=${parentsMarriageId}))`,
                );
            }

            parentUnit = spouseUnit;
        } else {
            return parentUnit;
        }

        if (i === 10) {
            throw new Error(`something wrong here i=${i}`);
        }
    }
}

function calculateShift(
    leftUnit: SiblingsUnit,
    leftShift: number,
    rightUnit: SiblingsUnit,
    rightShift: number,
    units: SiblingsUnit[],
    family: Index,
): number {
    console.log({ leftUnit, rightUnit });

    const leftUnitEndPoint = leftUnit.x + leftUnit.width + leftUnit.shift + leftShift;
    const rightUnitEnd = rightUnit.x + rightUnit.shift + rightShift;

    let shift = 0;
    if (rightUnitEnd - leftUnitEndPoint < NODES_GAP) {
        shift = NODES_GAP - (rightUnitEnd - leftUnitEndPoint);
    }
    console.log({ shift });

    leftShift += leftUnit.mod + leftUnit.shift;
    rightShift += rightUnit.mod + rightUnit.shift;

    const nextLeftUnit = getRightmostParentUnit(leftUnit, units, family);
    const nextRightUnit = getLeftmostParentUnit(rightUnit, units, family);

    if (!nextLeftUnit || !nextRightUnit) {
        return shift;
    }

    return Math.max(
        shift,
        calculateShift(nextLeftUnit, leftShift, nextRightUnit, rightShift, units, family),
    );
}

function preBuild(perspectiveId: string, family: Index, units: SiblingsUnit[]): SiblingsUnit {
    const siblings = getPersonSiblings(perspectiveId, family);
    const perspective: Perspective = {
        id: perspectiveId,
        side: RIGHT_SIDE,
    };
    const rootSiblingsUnit = preBuildSiblings(0, siblings, perspective, family, units, null);

    const spouseId = getPersonSpouseId(perspectiveId, family);
    if (spouseId) {
        // Perspective is married.
        const secondParentUnit = preBuildSiblings(
            rootSiblingsUnit.width,
            getPersonSiblings(spouseId, family),
            { id: spouseId, side: LEFT_SIDE },
            family,
            units,
            rootSiblingsUnit,
        );
    }

    return rootSiblingsUnit;
}

function preBuildSiblings(
    preX: number,
    siblings: string[],
    perspective: Perspective,
    family: Index,
    preNodes: SiblingsUnit[],
    neighborUnit: SiblingsUnit | null,
): SiblingsUnit {
    // console.log({ perspective, neighborUnit });
    if (!siblings[0]) {
        throw new Error('expected at least one sibling');
    }

    const parentsMarriageId = family.personParents.get(siblings[0]);

    if (!parentsMarriageId) {
        const width = getSingleSiblingsWidth(siblings);
        // Person does not have parents.
        if (siblings.length > 1) {
            throw new Error(`expected marriage to exist. Child id: ${siblings[0]}`);
        }

        const marriedSiblingId = findMarriedSibling(siblings, family, perspective.id);
        // console.log({ id: perspective.id, marriedSiblingId, siblings });

        let leftSibling = null,
            rightSibling = null;
        if (perspective.side === RIGHT_SIDE) {
            rightSibling = perspective.id;
            if (marriedSiblingId) {
                leftSibling = marriedSiblingId;
            }
        } else {
            leftSibling = perspective.id;
            if (marriedSiblingId) {
                rightSibling = marriedSiblingId;
            }
        }

        let x = preX;
        if (perspective.side === RIGHT_SIDE) {
            x -= width;
        }

        // console.log({ preX, width, x, perspective });

        const unit: SiblingsUnit = {
            siblings,
            x,
            leftSibling,
            rightSibling,
            width: width,
            mod: 0,
            shift: 0,
        };

        preNodes.push(unit);

        return unit;
    }

    // Person has parents.
    const parentsMarriage = family.marriageById.get(parentsMarriageId);
    if (!parentsMarriage) {
        throw new Error(`expected marriage (id=${parentsMarriageId}) to exist`);
    }

    if (!parentsMarriage.parent1_id) {
        throw new Error(`expected the first parent in marriage (id=${parentsMarriageId}) to exist`);
    }
    const firstParentUnit = preBuildSiblings(
        0,
        getPersonSiblings(parentsMarriage.parent1_id, family),
        { id: parentsMarriage.parent1_id, side: RIGHT_SIDE },
        family,
        preNodes,
        null,
    );

    if (!parentsMarriage.parent2_id) {
        throw new Error(
            `expected the second parent in marriage (id=${parentsMarriageId}) to exist`,
        );
    }
    const secondParentUnit = preBuildSiblings(
        NODES_GAP,
        getPersonSiblings(parentsMarriage.parent2_id, family),
        { id: parentsMarriage.parent2_id, side: LEFT_SIDE },
        family,
        preNodes,
        firstParentUnit,
    );

    // console.log({ firstParentUnit, secondParentUnit });

    const parentsUnitsWidth = secondParentUnit.x + secondParentUnit.width - firstParentUnit.x;
    let siblingsWidth = getSingleSiblingsWidth(siblings);

    const marriedSiblingId = findMarriedSibling(siblings, family, perspective.id);
    // console.log({ id: perspective.id, marriedSiblingId, siblings });

    let leftSibling = null,
        rightSibling = null;
    if (perspective.side === RIGHT_SIDE) {
        rightSibling = perspective.id;
        if (marriedSiblingId) {
            leftSibling = marriedSiblingId;
        }
    } else {
        leftSibling = perspective.id;
        if (marriedSiblingId) {
            rightSibling = marriedSiblingId;
        }
    }

    let x = preX;
    if (perspective.side === RIGHT_SIDE) {
        x -= siblingsWidth;
    }

    const middlePoint = x + siblingsWidth / 2;
    const mod = middlePoint - (firstParentUnit.x + firstParentUnit.width + NODES_GAP / 2);

    // if (siblingsWidth < parentsUnitsWidth) {
    //     if (leftSibling) {
    //         const delta = x - firstParentUnit.x;
    //         x = firstParentUnit.x;
    //         siblingsWidth += delta;
    //     }

    //     if (rightSibling) {
    //         const delta = secondParentUnit.x + secondParentUnit.width - (x + siblingsWidth);
    //         siblingsWidth += delta;
    //     }
    // }

    const unit: SiblingsUnit = {
        siblings,
        leftSibling,
        rightSibling,
        x,
        width: siblingsWidth,
        mod,
        shift: 0,
    };

    preNodes.push(unit);

    if (neighborUnit) {
        if (perspective.side == RIGHT_SIDE) {
            const shift = calculateShift(unit, 0, neighborUnit, 0, preNodes, family);
            console.log({ shift: shift * -1, id: perspective.id });
            unit.shift = shift * -1 /* shift subgraph left */;
        } else {
            const shift = calculateShift(neighborUnit, 0, unit, 0, preNodes, family);
            console.log({ shift });
            unit.shift = shift /* shift subgraph right */;
        }
    }

    if (marriedSiblingId) {
        // We have the parallel family tree: marriageById spouse's family.
        const siblingSpouseId = getPersonSpouseId(marriedSiblingId, family);
        if (!siblingSpouseId) {
            throw new Error(`expected sibling(id=${marriedSiblingId}) to have a spouse`);
        }

        let siblingPreX = x;
        if (perspective.side == LEFT_SIDE) {
            siblingPreX += unit.width;
        }

        preBuildSiblings(
            siblingPreX,
            getPersonSiblings(siblingSpouseId, family),
            { id: siblingSpouseId, side: perspective.side },
            family,
            preNodes,
            unit,
        );
    }

    return unit;
}

function finalizeNodesLayout(
    unit: SiblingsUnit,
    units: SiblingsUnit[],
    family: Index,
    nodes: Node[],
    edges: Edge[],
    level: number,
    mod: number,
    renderedSide: Side | null,
) {
    // console.log({ unit, units, renderedSide });
    if (!unit.siblings[0]) {
        throw new Error(`siblings array must contain at least one person`);
    }

    if (unit.leftSibling && (!renderedSide || renderedSide === RIGHT_SIDE)) {
        const spouseId = getPersonSpouseId(unit.leftSibling, family);
        // console.log({ sibling: unit.leftSibling, spouse: spouseId });
        if (spouseId) {
            const spouseUnit = getPersonSiblingUnit(spouseId, units);
            // console.log({ spouseUnit, units });
            if (!spouseUnit) {
                throw new Error(`expected unit to exist for person(id=${spouseId})`);
            }

            finalizeNodesLayout(spouseUnit, units, family, nodes, edges, level, mod, RIGHT_SIDE);
        }
    }

    const parentsMarriageId = family.personParents.get(unit.siblings[0]);

    if (parentsMarriageId) {
        const parentsMarriage = family.marriageById.get(parentsMarriageId);
        if (!parentsMarriage) {
            throw new Error(`expected marriage(id=${parentsMarriageId} to exist)`);
        }

        let parentId: string | null = null;
        if (parentsMarriage.parent1_id) {
            parentId = parentsMarriage.parent1_id;
        }

        if (parentsMarriage.parent2_id) {
            parentId = parentsMarriage.parent2_id;
        }

        if (!parentId) {
            throw new Error(
                `invalid marriage(id=${parentsMarriage.id}) detected: both parents are undefined`,
            );
        }

        const parentUnit = getPersonSiblingUnit(parentId, units);
        if (!parentUnit) {
            throw new Error(`parent(id=${parentId}) unit foes not exist`);
        }

        finalizeNodesLayout(
            parentUnit,
            units,
            family,
            nodes,
            edges,
            level - 1,
            mod + unit.mod + unit.shift,
            null,
        );
    }

    let x = unit.x + mod + unit.shift;
    const y = level * (NODE_HEIGHT + NODES_GAP);

    if (unit.rightSibling) {
        const person = family.personById.get(unit.rightSibling);
        if (!person) {
            throw new Error(`expected person(id=${unit.rightSibling}) to exist`);
        }

        nodes.push({
            id: person.id,
            data: { person, kind: KNOWN_PERSON },
            position: { x: x + unit.width - NODE_WIDTH, y },
            type: 'personNode',
            style: {
                color: '#222',
            },
        });
    }

    if (unit.leftSibling) {
        const person = family.personById.get(unit.leftSibling);
        if (!person) {
            throw new Error(`expected person(id=${unit.leftSibling}) to exist`);
        }

        nodes.push({
            id: person.id,
            data: { person, kind: KNOWN_PERSON },
            position: { x, y },
            type: 'personNode',
            style: {
                color: '#222',
            },
        });

        x += NODE_WIDTH + NODES_GAP;
    }

    for (const sibling of unit.siblings) {
        if (sibling == unit.leftSibling || sibling == unit.rightSibling) {
            continue;
        }

        const person = family.personById.get(sibling);
        if (!person) {
            throw new Error(`expected person(id=${unit.leftSibling}) to exist`);
        }

        nodes.push({
            id: person.id,
            data: { person, kind: KNOWN_PERSON },
            position: { x, y },
            type: 'personNode',
            style: {
                color: '#222',
            },
        });

        x += NODE_WIDTH + NODES_GAP;
    }

    if (unit.rightSibling && (!renderedSide || renderedSide === LEFT_SIDE)) {
        const spouseId = getPersonSpouseId(unit.rightSibling, family);
        if (spouseId) {
            const spouseUnit = getPersonSiblingUnit(spouseId, units);
            if (!spouseUnit) {
                throw new Error(`expected unit to exist for person(id=${spouseId})`);
            }

            finalizeNodesLayout(spouseUnit, units, family, nodes, edges, level, mod, LEFT_SIDE);
        }
    }
}

export function buildNodes(perspectiveId: string, family: Index): [Node[], Edge[]] {
    const units: SiblingsUnit[] = [];

    const rootSiblingsUnit = preBuild(perspectiveId, family, units);

    // console.log(units);

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    finalizeNodesLayout(rootSiblingsUnit, units, family, nodes, edges, 0, 0, null);

    // console.log(nodes);

    return [nodes, edges];
}
