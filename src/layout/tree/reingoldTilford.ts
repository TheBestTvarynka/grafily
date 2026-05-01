import {
    Id,
    MARRIAGE_GAP,
    MARRIAGE_NODE_SIZE,
    MARRIAGE_NODE_TYPE,
    MARRIAGE_WIDTH,
    NODE_HEIGHT,
    NODE_WIDTH,
    NODES_GAP,
    nodeWidth,
    PERSON_NODE_TYPE,
} from 'layout';
import { Index, LEFT_SIDE, RIGHT_SIDE } from 'model';
import { v4 as uuidv4 } from 'uuid';
import { Edge, Node } from '@xyflow/react';
import { FamilyTree } from './treeBuilder';

/**
 * Represents a preliminary tree node used during the layout computation.
 *
 * @property {Id} id - The node id.
 * @property {number} x - The x coordinate of the node. This is not the final x coordinate, but before applying modifiers.
 * @property {number} mod - The mod modifier for the x coordinate. It shifts the node subtree to the right.
 * @property {number} shift - The shift modifier for the x coordinate. It shifts node and its subtree to the right.
 */
export type PreNode = {
    id: Id;
    x: number;
    mod: number;
    shift: number;
};

/**
 * The Reingold-Tilford algorithm implementation for tree layout. It calculates the position of each node in the tree to create a tidy layout.
 */
export class ReingoldTilfordLayout {
    private tree: FamilyTree;
    private family: Index;
    private getY: (level: number) => number;
    // Rendering options.
    private isParentsCollapsed: boolean;
    private isChildrenCollapsible: boolean;

    getRightmostChildren(id: Id): Id | null {
        const children = this.tree.children.get(id);

        if (!children || children.length === 0) {
            return null;
        }

        // SAFE: Checked above.
        return children.last()!;
    }

    getLeftmostChildren(id: Id): Id | null {
        const children = this.tree.children.get(id);

        if (!children || children.length === 0) {
            return null;
        }

        // SAFE: Checked above.
        return children.first()!;
    }

    getChildNodesIds(currentNode: Id): Id[] {
        return this.tree.children.get(currentNode) ?? [];
    }

    /**
     * Creates an instance of the ReingoldTilford algorithm with the provided functions to access the family relationships and calculating the y coordinate.
     *
     * @param {FamilyTree} tree pre-built tree structure that contains only nodes we need to render.
     * @param {Index} family
     * @param {(level: number) => number} getY calculates the node Y coordinate based on the generation level.
     */
    constructor(
        tree: FamilyTree,
        family: Index,
        getY: (level: number) => number,
        isParentsCollapsed: boolean,
        isChildrenCollapsible: boolean,
    ) {
        this.tree = tree;
        this.getY = getY;
        this.family = family;
        this.isParentsCollapsed = isParentsCollapsed;
        this.isChildrenCollapsible = isChildrenCollapsible;
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
    private calculateShift(
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

        const nextLeftSibling = this.getRightmostChildren(siblingLeft);
        const nextRightSibling = this.getLeftmostChildren(singlingRight);

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
        const childIds = this.getChildNodesIds(perspectiveId);

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

            if (childId.type === PERSON_NODE_TYPE) {
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
        const parents = this.getChildNodesIds(nodeId);

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
        const y = this.getY(level);

        if (nodeId.type === MARRIAGE_NODE_TYPE) {
            const marriage = this.family.marriageById.get(nodeId.id);
            if (!marriage) {
                throw new Error(`Expected marriage to exist for id ${nodeId.id}`);
            }

            // Create a marriage node first.
            nodes.push({
                id: marriage.id,
                data: {
                    id: marriage.id,
                    isChildrenCollapsible:
                        this.isChildrenCollapsible && marriage.childrenIds.length > 0,
                    isChildrenCollapsed: marriage.isChildrenCollapsed,
                },
                type: MARRIAGE_NODE_TYPE,
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
                person.isParentsCollapsed = this.isParentsCollapsed;
                nodes.push({
                    id: parent1NodeId,
                    data: { id: person.id, side: person.marriageNodeSide },
                    position: { x, y },
                    type: PERSON_NODE_TYPE,
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
                person.isParentsCollapsed = this.isParentsCollapsed;
                nodes.push({
                    id: parent2NodeId,
                    data: { id: person.id, side: person.marriageNodeSide },
                    position: { x: x + NODE_WIDTH + 2 * MARRIAGE_GAP, y },
                    type: PERSON_NODE_TYPE,
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

            person.isParentsCollapsed = this.isParentsCollapsed;
            nodes.push({
                id: nodeId.id,
                data: { id: person.id, side: person.marriageNodeSide },
                position: { x, y },
                type: PERSON_NODE_TYPE,
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
