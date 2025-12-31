import { Node } from '@xyflow/react';

import { Index } from 'model';

const NODE_WIDTH = 100;
const NODE_HEIGHT = 40;
const MARRIAGE_NODE_SIZE = 10;
const MARRIAGE_GAP = 40;
const NODES_GAP = 40;

// +------------+                             +------------+
// |  parent1   |--------------o--------------|  parent2   |
// +------------+                             +------------+
// 
// | NODE_WIDTH | MARRIAGE_GAP | MARRIAGE_GAP | NODE_WIDTH |
// |                    MARRIAGE_WIDTH                     |
const MARRIAGE_WIDTH = (NODE_WIDTH + MARRIAGE_GAP) * 2;

const PERSON_TYPE = 'person';
const MARRIAGE_TYPE = 'marriage';
type PreNodeType = typeof PERSON_TYPE | typeof MARRIAGE_TYPE;

type Id = {
    type: PreNodeType;
    // If the node is a person, this is the person id.
    // If the node is a marriage, this is marriage id.
    id: string;
}

// PreNode is used during the layout computation.
// It represents a node in the preliminary layout tree.
type PreNode = {
    id: Id;
    // The x coordinate of the node. This is not the final x coordinate, but before applying modifiers.
    x: number;
    // The mod modifier for the x coordinate. It shifts the node subtree to the right.
    mod: number;
    // The shift modifier for the x coordinate. It shifts node and its subtree to the right.
    shift: number;
};

function buildPreNodes(perspectiveId: Id, family: Index, preNodes: Map<string, PreNode>, preX: number): PreNode {
    let parents: Id[] = [];
    if (perspectiveId.type === PERSON_TYPE) {
        const marriageId = family.personParents.get(perspectiveId.id);

        if (!marriageId) {
            parents = [];
        } else {
            parents = [{ type: MARRIAGE_TYPE, id: marriageId }];
        }
    } else {
        const marriage = family.marriageById.get(perspectiveId.id);

        if (!marriage) {
            throw new Error(`Expected marriage to exist for id ${perspectiveId.id}`);
        }

        if (marriage.parent1_id) {
            let parent1MarriageId = family.personParents.get(marriage.parent1_id);
            if (parent1MarriageId) {
                parents.push({ type: MARRIAGE_TYPE, id: parent1MarriageId });
            }
        }

        if (marriage.parent2_id) {
            let parent2MarriageId = family.personParents.get(marriage.parent2_id);
            if (parent2MarriageId) {
                parents.push({ type: MARRIAGE_TYPE, id: parent2MarriageId });
            }
        }
    }

    if (parents.length === 0) {
        const preNode: PreNode = {
            id: perspectiveId,
            x: preX,
            mod: 0,
            shift: 0,
        };

        preNodes.set(perspectiveId.id, preNode);

        return preNode;
    }

    if (parents.length === 1) {
        let parent = parents[0];
        if (!parent) {
            throw new Error('should not be possible');
        }

        const parentNode = buildPreNodes(parent, family, preNodes, 0);

        // Now we need to do different actions depending on whether the current node is a left-most node or not.
        // We do that with a simple trick: the current node is the left-most node if its `preX` is equal to 0.
        let x: number;
        let mod: number;
        if (preX === 0) {
            x = parentNode.x / 2;
            mod = 0;
        } else {
            x = preX;
            mod = x - parentNode.x / 2;
        }
        
        const preNode: PreNode = {
            id: perspectiveId,
            x,
            mod,
            // TODO: properly calculate shift.
            shift: 0,
        };

        preNodes.set(perspectiveId.id, preNode);

        return preNode;
    }

    // parents.length === 2
    let firstParent = parents[0];
    if (!firstParent) {
        throw new Error('should not be possible: first parent must present');
    }
    let secondParent = parents[1];
    if (!secondParent) {
        throw new Error('should not be possible: second parent must present');
    }

    let firstPreNode = buildPreNodes(firstParent, family, preNodes, 0);
    let deltaX: number;
    if (firstPreNode.id.type === PERSON_TYPE) {
        deltaX = NODE_WIDTH + NODES_GAP;
    } else {
        deltaX = MARRIAGE_WIDTH + NODES_GAP;
    }

    let secondPreNode = buildPreNodes(secondParent, family, preNodes, deltaX);

    // Now we need to do different actions depending on whether the current node is a left-most node or not.
    // We do that with a simple trick: the current node is the left-most node if its `preX` is equal to 0.
    let x: number;
    let mod: number;
    if (preX === 0) {
        x = (firstPreNode.x + secondPreNode.x) / 2;
        mod = 0;
    } else {
        x = preX;
        mod = x - (firstPreNode.x + secondPreNode.x) / 2;
    }

    const preNode: PreNode = {
        id: perspectiveId,
        x,
        mod,
        // TODO: properly calculate shift.
        shift: 0,
    };

    preNodes.set(perspectiveId.id, preNode);

    return preNode;
}

export function buildNodes(perspectiveId: string, family: Index): Node[] {
    const preNodes = new Map<string, PreNode>();

    let id: Id;
    const marriage = family.personMarriages.get(perspectiveId) ?? [];
    if (marriage.length > 0) {
        if (!marriage[0]) {
            throw new Error(`Expected first marriage to exist for person ${perspectiveId}`);
        }
        id = { type: MARRIAGE_TYPE, id: marriage[0].id };
    } else {
        id = { type: PERSON_TYPE, id: perspectiveId };
    }

    const rootPreNode = buildPreNodes(id, family, preNodes, 0);

    return [];
}
