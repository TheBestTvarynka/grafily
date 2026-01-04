import { Edge, Node } from '@xyflow/react';
import { Family, Index, Marriage } from 'model';

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

function oppositeSide(side: Side): Side {
    if (side === LEFT_SIDE) {
        return RIGHT_SIDE;
    } else {
        return LEFT_SIDE;
    }
}

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
    leftSibling?: string;
    // The sibling id that must be placed at the rightmost position among siblings.
    rightSibling?: string;
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

function isPersonMarried(personId: string, family: Index): boolean {
    if (getPersonSpouseId(personId, family)) {
        return true;
    } else {
        return false;
    }
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

function preBuildSiblings(
    preX: number,
    siblings: string[],
    perspective: Perspective,
    family: Index,
    preNodes: SiblingsUnit[],
): SiblingsUnit {
    if (!siblings[0]) {
        throw new Error('expected at least one sibling');
    }

    const parentsMarriageId = family.personParents.get(siblings[0]);

    if (!parentsMarriageId) {
        // Person does not have parents.
        if (siblings.length > 1) {
            throw new Error(`expected marriage to exist. Child id: ${siblings[0]}`);
        }

        const unit: SiblingsUnit = {
            siblings,
            x: preX,
            width: getSingleSiblingsWidth(siblings),
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
    );

    if (!parentsMarriage.parent2_id) {
        throw new Error(
            `expected the second parent in marriage (id=${parentsMarriageId}) to exist`,
        );
    }
    const secondParentUnit = preBuildSiblings(
        firstParentUnit.width,
        getPersonSiblings(parentsMarriage.parent2_id, family),
        { id: parentsMarriage.parent1_id, side: LEFT_SIDE },
        family,
        preNodes,
    );

    const parentsUnitsWidth = secondParentUnit.x + secondParentUnit.width - firstParentUnit.x;
    let siblingsWidth = getSingleSiblingsWidth(siblings);

    const marriedSiblingId = findMarriedSibling(siblings, family, perspective.id);

    let leftSibling, rightSibling;
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
    const mod = middlePoint - (firstParentUnit.x + firstParentUnit.width);

    if (siblingsWidth < parentsUnitsWidth) {
        if (leftSibling) {
            const delta = x - firstParentUnit.x;
            x = firstParentUnit.x;
            siblingsWidth += delta;
        }

        if (rightSibling) {
            const delta = secondParentUnit.x + secondParentUnit.width - (x + siblingsWidth);
            siblingsWidth += delta;
        }
    }

    const unit: SiblingsUnit = {
        siblings,
        leftSibling,
        rightSibling,
        x,
        width: siblingsWidth,
        mod,
        // TODO: properly calculate shift.
        shift: 0,
    };

    preNodes.push(unit);

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
        );
    }

    return unit;
}

export function buildNodes(perspectiveId: string, family: Index): [Node[], Edge[]] {
    const preNodes: SiblingsUnit[] = [];

    const siblings = getPersonSiblings(perspectiveId, family);
    const perspective: Perspective = {
        id: perspectiveId,
        side: RIGHT_SIDE,
    };
    const rootSiblingsUnit = preBuildSiblings(0, siblings, perspective, family, preNodes);

    return [[], []];
}
