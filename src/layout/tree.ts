/**
 * This module contains the direct ancestors-descendants tree layout algorithm implementation.
 * It is based on the Reingold-Tilford algorithm, but a but modified to fit the current use case.
 * @packageDocumentation
 */

import { Edge, Node } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { Index, LEFT_SIDE, Marriage, RIGHT_SIDE } from '../model';

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

const PERSON_TYPE = 'person';
const MARRIAGE_TYPE = 'marriage';
type PreNodeType = typeof PERSON_TYPE | typeof MARRIAGE_TYPE;

/**
 * Represents a preliminary tree node id.
 *
 * @property {PreNodeType} type - The type of the node (person or marriage).
 * @property {string} id - If `type` is a person type, this is the person id. If `type` is a marriage type, this is marriage id.
 */
type Id = {
    type: PreNodeType;
    id: string;
};

/**
 * Represents a preliminary tree node used during the layout computation.
 *
 * @property {Id} id - The node id.
 * @property {number} x - The x coordinate of the node. This is not the final x coordinate, but before applying modifiers.
 * @property {number} mod - The mod modifier for the x coordinate. It shifts the node subtree to the right.
 * @property {number} shift - The shift modifier for the x coordinate. It shifts node and its subtree to the right.
 */
type PreNode = {
    id: Id;
    x: number;
    mod: number;
    shift: number;
};

/**
 * Returns the width of the node based on its type.
 *
 * @param {Id} id The Node id to get the width for.
 * @returns The width of the node.
 */
function nodeWidth(id: Id): number {
    if (id.type === PERSON_TYPE) {
        return NODE_WIDTH;
    } else {
        return MARRIAGE_WIDTH;
    }
}

class ReingoldTilford {
    getRightmostChildren: (id: Id, family: Index) => Id | null;
    getLeftmostChildren: (id: Id, family: Index) => Id | null;
    getChildNodesIds: (currentNode: Id, family: Index) => Id[];
    getY: (level: number) => number;
    family: Index;

    constructor(
        getRightmostChildren: (id: Id, family: Index) => Id | null,
        getLeftmostChildren: (id: Id, family: Index) => Id | null,
        getChildNodesIds: (currentNode: Id, family: Index) => Id[],
        getY: (level: number) => number,
        family: Index,
    ) {
        this.getRightmostChildren = getRightmostChildren;
        this.getLeftmostChildren = getLeftmostChildren;
        this.getChildNodesIds = getChildNodesIds;
        this.getY = getY;
        this.family = family;
    }

    /**
     * Calculates the shift needed to apply to the current node and its subtree to avoid overlaps with the sibling node to the left and its subtree.
     *
     * @param {Id} siblingLeft The sibling node to the left of the current node.
     * @param {number} leftShift The accumulated shift value for the left sibling.
     * @param {Id} singlingRight The sibling node to the right - the current node.
     * @param {number} rightShift The accumulated shift value for the right sibling.
     * @param {Map<string, PreNode>} preNodes The map of preliminary nodes.
     * @returns The calculated shift value.
     */
    calculateShift(
        siblingLeft: Id,
        leftShift: number,
        singlingRight: Id,
        rightShift: number,
        preNodes: Map<string, PreNode>,
    ): number {
        const leftNode = preNodes.get(siblingLeft.id);
        if (!leftNode) {
            throw new Error(
                `Failed to calculate shift: expected left sibling pre-node to exist for id ${siblingLeft.id}`,
            );
        }

        const rightNode = preNodes.get(singlingRight.id);
        if (!rightNode) {
            throw new Error(
                `Failed to calculate shift: expected right sibling pre-node to exist for id ${singlingRight.id}`,
            );
        }

        const leftX = leftNode.x + leftShift + leftNode.shift + nodeWidth(siblingLeft);
        const rightX = rightNode.x + rightShift + rightNode.shift;

        let shift = 0;
        if (rightX - leftX < NODES_GAP) {
            shift = NODES_GAP - (rightX - leftX);
        }

        leftShift += leftNode.mod + leftNode.shift;
        rightShift += rightNode.mod + rightNode.shift;

        const nextLeftSibling = this.getRightmostChildren(siblingLeft, this.family);
        const nextRightSibling = this.getLeftmostChildren(singlingRight, this.family);

        if (!nextLeftSibling || !nextRightSibling) {
            return shift;
        }

        return Math.max(
            shift,
            this.calculateShift(nextLeftSibling, leftShift, nextRightSibling, rightShift, preNodes),
        );
    }

    /**
     * Reingold-Tilford algorithm first walk implementation: it builds the preliminary nodes with their preX coordinates, modifiers, and shifts.
     *
     * @param {iD} perspectiveId The person ID to build the tree for. This person will be the root.
     * @param {Map<string, PreNode>} preNodes The map of preliminary nodes that are already built.
     * @param {number} preX The preliminary x coordinate of the current node.
     * @param {Id[]} siblings The list of siblings to the left of the current node.
     * @returns The preliminary node for the current perspectiveId.
     */
    buildPreNodes(
        perspectiveId: Id,
        preNodes: Map<string, PreNode>,
        preX: number,
        siblings: Id[],
    ): PreNode {
        const childIds = this.getChildNodesIds(perspectiveId, this.family);

        if (childIds.length === 0) {
            const preNode: PreNode = {
                id: perspectiveId,
                x: preX,
                mod: 0,
                shift: 0,
            };

            preNodes.set(perspectiveId.id, preNode);

            for (const sibling of siblings) {
                if (perspectiveId === sibling) {
                    break;
                }

                const shift = this.calculateShift(sibling, 0, perspectiveId, 0, preNodes);
                preNode.shift += shift;
            }

            return preNode;
        }

        let deltaX: number = 0;
        const childPreNodes: PreNode[] = [];
        for (const childId of childIds) {
            childPreNodes.push(this.buildPreNodes(childId, preNodes, deltaX, childIds));

            if (childId.type === PERSON_TYPE) {
                deltaX += NODE_WIDTH + NODES_GAP;
            } else {
                deltaX += MARRIAGE_WIDTH + NODES_GAP;
            }
        }

        const firstPreNode = childPreNodes[0];
        if (!firstPreNode) {
            throw new Error('should not be possible');
        }
        const lastPreNode = childPreNodes[childPreNodes.length - 1];
        if (!lastPreNode) {
            throw new Error('should not be possible');
        }

        // Now we need to do different actions depending on whether the current node is a left-most node or not.
        // We do that with a simple trick: the current node is the left-most node if its `preX` is equal to 0.
        let x: number;
        let mod: number;
        if (preX === 0) {
            x = (firstPreNode.x + firstPreNode.shift + (lastPreNode.x + lastPreNode.shift)) / 2;
            mod = 0;
        } else {
            x = preX;
            mod =
                x - (firstPreNode.x + firstPreNode.shift + (lastPreNode.x + lastPreNode.shift)) / 2;
        }

        const preNode: PreNode = {
            id: perspectiveId,
            x,
            mod,
            shift: 0,
        };

        preNodes.set(perspectiveId.id, preNode);

        for (const sibling of siblings) {
            if (perspectiveId === sibling) {
                break;
            }

            const shift = this.calculateShift(sibling, 0, perspectiveId, 0, preNodes);
            preNode.shift += shift;
        }

        return preNode;
    }

    /**
     * Calculates the final layout of the nodes, creates nodes and edges.
     *
     * @param {Id} nodeId Current node to calculate the layout for.
     * @param {Map<string, PreNode>} preNodes The map of preliminary nodes that are already built.
     * @param {Node[]} nodes Final nodes array with calculated positions that will be rendered.
     * @param {Edge[]} edges Final edges array that will be rendered.
     * @param {number} level Current node level in the tree. It is used to calculate the y coordinate of the node.
     * @param {number} mod The accumulated modifier value that is passed down from the root nodes.
     */
    finalizeNodesLayout(
        nodeId: Id,
        preNodes: Map<string, PreNode>,
        nodes: Node[],
        edges: Edge[],
        level: number,
        mod: number,
    ) {
        const parents = this.getChildNodesIds(nodeId, this.family);

        const preNode = preNodes.get(nodeId.id);
        if (!preNode) {
            throw new Error(`Expected pre-node to exist for id ${nodeId.id}`);
        }

        for (const parent of parents) {
            this.finalizeNodesLayout(
                parent,
                preNodes,
                nodes,
                edges,
                level + 1,
                mod + preNode.mod + preNode.shift,
            );
        }

        const x = preNode.x + mod + preNode.shift;
        // const y = level * (NODE_HEIGHT + NODES_GAP);
        const y = this.getY(level);

        if (nodeId.type === MARRIAGE_TYPE) {
            const marriage = this.family.marriageById.get(nodeId.id);
            if (!marriage) {
                throw new Error(`Expected marriage to exist for id ${nodeId.id}`);
            }

            // Create a marriage node first.
            nodes.push({
                id: marriage.id,
                data: { id: marriage.id },
                type: 'marriageNode',
                position: {
                    x: x + NODE_WIDTH + MARRIAGE_GAP - MARRIAGE_NODE_SIZE / 2,
                    y: y + NODE_HEIGHT / 2 - MARRIAGE_NODE_SIZE / 2,
                },
                style: {
                    width: 10,
                    height: 10,
                    borderRadius: 4,
                    background: '#555',
                    color: '#fff',
                    fontSize: 8,
                    textAlign: 'center',
                },
            });

            const parent1NodeId = marriage.parent1Id ?? uuidv4();
            if (marriage.parent1Id) {
                const person = this.family.personById.get(marriage.parent1Id);
                if (!person) {
                    throw new Error(`Expected person to exist for id ${marriage.parent1Id}`);
                }

                person.marriageNodeSide = RIGHT_SIDE;
                person.parentNodesFoldable = true;
                nodes.push({
                    id: parent1NodeId,
                    data: { person },
                    position: { x, y },
                    type: 'personNode',
                    style: {
                        color: '#222',
                    },
                });

                edges.push({
                    id: marriage.id + '-to-' + parent1NodeId,
                    target: parent1NodeId,
                    source: marriage.id,
                    sourceHandle: 'left',
                    targetHandle: 'right',
                });
            }

            const parent2NodeId = marriage.parent2Id ?? uuidv4();
            if (marriage.parent2Id) {
                const person = this.family.personById.get(marriage.parent2Id);
                if (!person) {
                    throw new Error(`Expected person to exist for id ${marriage.parent2Id}`);
                }

                person.marriageNodeSide = LEFT_SIDE;
                person.parentNodesFoldable = true;
                nodes.push({
                    id: parent2NodeId,
                    data: { person },
                    position: { x: x + NODE_WIDTH + 2 * MARRIAGE_GAP, y },
                    type: 'personNode',
                    style: {
                        color: '#222',
                    },
                });

                edges.push({
                    id: marriage.id + '-to-' + parent2NodeId,
                    target: parent2NodeId,
                    source: marriage.id,
                    sourceHandle: 'right',
                    targetHandle: 'left',
                });
            }

            for (const childId of marriage.childrenIds) {
                edges.push({
                    id: marriage.id + '-to-' + childId,
                    source: marriage.id,
                    target: childId,
                    sourceHandle: 'bottom',
                    targetHandle: 'top',
                });
            }
        } else {
            const person = this.family.personById.get(nodeId.id);
            if (!person) {
                throw new Error(`Expected person to exist for id ${nodeId.id}`);
            }

            person.parentNodesFoldable = true;
            nodes.push({
                id: nodeId.id,
                data: { person },
                position: { x, y },
                type: 'personNode',
                style: {
                    color: '#222',
                },
            });

            for (const childId of this.family.personChildren.get(nodeId.id) ?? []) {
                edges.push({
                    id: nodeId.id + '-to-' + childId,
                    source: nodeId.id,
                    target: childId,
                    sourceHandle: 'bottom',
                    targetHandle: 'top',
                });
            }
        }
    }
}

/**
 * Returns the rightmost parent of the given node.
 * @param {Id} id The Node id to get the rightmost parent for.
 * @param {Index} family The family index containing all the people and their relationships.
 * @returns The rightmost parent of the given node or null if there are no parents.
 */
function getRightmostParent(id: Id, family: Index): Id | null {
    if (id.type === MARRIAGE_TYPE) {
        const marriage = family.marriageById.get(id.id);
        if (!marriage) {
            throw new Error(`Expected marriage to exist for id ${id.id}`);
        }

        if (marriage.parent2Id) {
            const parents = family.personParents.get(marriage.parent2Id);
            const parent2 = family.personById.get(marriage.parent2Id);

            if (parents && !parent2?.isParentNodesHidden) {
                return { type: MARRIAGE_TYPE, id: parents };
            }
        }

        if (marriage.parent1Id) {
            const parents = family.personParents.get(marriage.parent1Id);
            const parent1 = family.personById.get(marriage.parent1Id);

            if (parents && !parent1?.isParentNodesHidden) {
                return { type: MARRIAGE_TYPE, id: parents };
            }
        }

        return null;
    } else {
        // Currently, this case is not supported, but let's handle it.
        const parents = family.personParents.get(id.id);

        if (!parents) {
            return null;
        } else {
            return { type: MARRIAGE_TYPE, id: parents };
        }
    }
}

/**
 * Returns the leftmost parent of the given node.
 * @param {Id} id The Node id to get the leftmost parent for.
 * @param {Index} family The family index containing all the people and their relationships.
 * @returns The leftmost parent of the given node or null if there are no parents.
 */
function getLeftmostParent(id: Id, family: Index): Id | null {
    if (id.type === MARRIAGE_TYPE) {
        const marriage = family.marriageById.get(id.id);
        if (!marriage) {
            throw new Error(`Expected marriage to exist for id ${id.id}`);
        }

        if (marriage.parent1Id) {
            const parentsMarriageId = family.personParents.get(marriage.parent1Id);
            const parent1 = family.personById.get(marriage.parent1Id);

            if (parentsMarriageId && !parent1?.isParentNodesHidden) {
                return { type: MARRIAGE_TYPE, id: parentsMarriageId };
            }
        }

        if (marriage.parent2Id) {
            const parentsMarriageId = family.personParents.get(marriage.parent2Id);
            const parent2 = family.personById.get(marriage.parent2Id);

            if (parentsMarriageId && !parent2?.isParentNodesHidden) {
                return { type: MARRIAGE_TYPE, id: parentsMarriageId };
            }
        }

        return null;
    } else {
        // Currently, this case is not supported, but let's handle it.
        const parents = family.personParents.get(id.id);

        if (!parents) {
            return null;
        } else {
            return { type: MARRIAGE_TYPE, id: parents };
        }
    }
}

/**
 * Returns the rightmost child of the given node.
 * @param {Id} id The Node id to get the rightmost child for.
 * @param {Index} family The family index containing all the people and their relationships.
 * @returns The rightmost child of the given node or null if there are no children.
 */
function getRightmostChild(id: Id, family: Index): Id | null {
    const children = getChildNodesIds(id, family);

    if (children[children.length - 1]) {
        return children[children.length - 1] as Id /* SAFE: checked above */;
    } else {
        return null;
    }
}

/**
 * Returns the leftmost child of the given node.
 * @param {Id} id The Node id to get the leftmost child for.
 * @param {Index} family The family index containing all the people and their relationships.
 * @returns The leftmost child of the given node or null if there are no children.
 */
function getLeftmostChild(id: Id, family: Index): Id | null {
    const children = getChildNodesIds(id, family);

    if (children[0]) {
        return children[0];
    } else {
        return null;
    }
}

/**
 * Returns current node parent nodes.
 *
 * @param {Id} currentNode The current node to get the parent nodes for.
 * @param {Index} family The family index containing all the people and their relationships.
 * @returns The list of parent nodes ids.
 */
function getParentNodesIds(currentNode: Id, family: Index): Id[] {
    let parents: Id[] = [];
    if (currentNode.type === PERSON_TYPE) {
        const marriageId = family.personParents.get(currentNode.id);

        if (!marriageId) {
            parents = [];
        } else {
            parents = [{ type: MARRIAGE_TYPE, id: marriageId }];
        }
    } else {
        const marriage = family.marriageById.get(currentNode.id);

        if (!marriage) {
            throw new Error(`Expected marriage to exist for id ${currentNode.id}`);
        }

        if (marriage.parent1Id) {
            let parent1MarriageId = family.personParents.get(marriage.parent1Id);
            let parent1 = family.personById.get(marriage.parent1Id);

            if (parent1MarriageId && !parent1?.isParentNodesHidden) {
                parents.push({ type: MARRIAGE_TYPE, id: parent1MarriageId });
            }
        }

        if (marriage.parent2Id) {
            let parent2MarriageId = family.personParents.get(marriage.parent2Id);
            let parent2 = family.personById.get(marriage.parent2Id);

            if (parent2MarriageId && !parent2?.isParentNodesHidden) {
                parents.push({ type: MARRIAGE_TYPE, id: parent2MarriageId });
            }
        }
    }

    return parents;
}

/**
 * Returns current node child nodes.
 *
 * @param {Id} currentNode The current node to get the child nodes for.
 * @param {Index} family The family index containing all the people and their relationships.
 * @returns The list of child nodes ids.
 */
function getChildNodesIds(currentNode: Id, family: Index): Id[] {
    let marriage: Marriage;

    if (currentNode.type === PERSON_TYPE) {
        const marriages = family.personMarriages.get(currentNode.id);

        if (!marriages || !marriages[0]) {
            return [];
        }

        marriage = marriages[0];
    } else {
        const nodeMarriage = family.marriageById.get(currentNode.id);

        if (!nodeMarriage) {
            throw new Error(`Expected marriage to exist for id ${currentNode.id}`);
        }

        marriage = nodeMarriage;
    }

    return marriage.childrenIds.map((id) => {
        const marriages = family.personMarriages.get(id);
        if (!marriages || !marriages[0]) {
            return { type: PERSON_TYPE, id };
        } else {
            return { type: MARRIAGE_TYPE, id: marriages[0].id };
        }
    });
}

function getParentY(level: number): number {
    return -1 * level * (NODE_HEIGHT + NODES_GAP);
}

function getChildY(level: number): number {
    return level * (NODE_HEIGHT + NODES_GAP);
}

/**
 * Builds the nodes and edges for the family tree layout.
 *
 * @param {string} perspectiveId The person ID to build the tree for. This person will be the root.
 * @param {Index} family The family index containing all the people and their relationships.
 * @returns Nodes and Edges that are already positioned and ready to be rendered.
 */
export function buildNodes(perspectiveId: string, family: Index): [Node[], Edge[]] {
    const preNodes = new Map<string, PreNode>();

    let id: Id;
    const marriage = family.personMarriages.get(perspectiveId) ?? [];
    if (marriage.length > 0) {
        if (!marriage[0]) {
            throw new Error(
                `Invalid number of marriages for person(${perspectiveId}): ${marriage.length}. Only one marriage per person is supported.`,
            );
        }
        id = { type: MARRIAGE_TYPE, id: marriage[0].id };
    } else {
        id = { type: PERSON_TYPE, id: perspectiveId };
    }

    // const reingoldTilford = new ReingoldTilford(
    //     getRightmostParent,
    //     getLeftmostParent,
    //     getParentNodesIds,
    //     getParentY,
    //     family,
    // );
    const reingoldTilford = new ReingoldTilford(
        getRightmostChild,
        getLeftmostChild,
        getChildNodesIds,
        getChildY,
        family,
    );

    // First walk: calculate preliminary X, mod, and shift values.
    const rootPreNode = reingoldTilford.buildPreNodes(id, preNodes, 0, [id]);

    const nodes: Node[] = [];
    const edges: Edge[] = [];
    // Second walk: calculate final X and Y values, and create nodes.
    reingoldTilford.finalizeNodesLayout(rootPreNode.id, preNodes, nodes, edges, 0, 0);

    return [nodes, edges];
}
