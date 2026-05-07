/**
 * This module builds and modifies the family tree before calculating node positions.
 * When use makes any kind of tree change, for example marriage children collapsing,
 * this module will remove all marriage children nodes from the tree.
 * Or, when the user wants to add new nodes to the tree, this module will add only
 * legal nodes (no edges crossing) to the tree.
 *
 * @module treeBuilder
 */

import {
    Id,
    MARRIAGE_NODE_TYPE,
    MOVE_PERSON_LEFT,
    PERSON_NODE_TYPE,
    personIdToNodeId,
    RearrangeAction,
    SWAP_MARRIAGE_SPOUSES,
} from 'layout';
import { NodePersons } from 'layout/fullGraph/graphBuilder';
import { Index, LEFT_SIDE, MarriageNodeSide } from 'model';

/**
 * Just an additional information about graph node. It is used for easier graph building and modifying.
 *
 * @property {string} id - node id.
 * @property {NodeType} type - node type.
 * @property {NodePersons} persons - persons associated with the node. For the person node, only `person1` is filled. For the marriage node, both `person1` and `person2` are filled.
 * @property {number} layerNumber - the layer number where the node is located.
 */
export interface TreeNode {
    id: Id;
    persons: NodePersons;
}

function personIdToTreeNode(personId: string, family: Index): TreeNode {
    const [id, marriage] = personIdToNodeId(personId, family);

    let persons: NodePersons = {};
    if (id.type === PERSON_NODE_TYPE) {
        persons.person1 = id.id;
    } else {
        persons.person1 = marriage?.parent1Id;
        persons.person2 = marriage?.parent2Id;
    }

    return { id, persons };
}

function nodeIdToTreeNode(nodeId: Id, family: Index): TreeNode {
    if (nodeId.type === PERSON_NODE_TYPE) {
        return {
            id: nodeId,
            persons: {
                person1: nodeId.id,
            },
        };
    } else {
        const marriage = family.marriageById.get(nodeId.id);
        if (!marriage) {
            throw new Error(`${nodeId.id} marriage should exist`);
        }

        return {
            id: nodeId,
            persons: {
                person1: marriage.parent1Id,
                person2: marriage.parent2Id,
            },
        };
    }
}

/**
 * The already prepared family tree for nodes coordinates calculation.
 * This tree builder can be used for parents (ancestors) and children (descendants)
 * trees generations. The implemented behaviour is abstract enough.
 *
 * @property {Map<string, TreeNode[]>} children - The abstract node children. For ancestors
 * tree, it will return parent nodes for each person in the marriage. For descendants
 * tree, it will return marriage node children ids.
 * @property {Id} root - The starting node for trees building.
 */
export interface FamilyTree {
    children: Record<string, TreeNode[]>;
    root: TreeNode;
}

/**
 * Tree builder which allows creating and modifying family trees.
 * This tree builder can be used for parents (ancestors) and children (descendants)
 * trees generations. The implemented behaviour is abstract enough.
 */
export class TreeBuilder {
    private family: Index;
    private children: Map<string, TreeNode[]> = new Map();
    private root: TreeNode | null = null;
    private getChildNodes: (nodeId: TreeNode, family: Index) => TreeNode[];

    /**
     * Constructs a new tree builder instance.
     *
     * @param {Index} family - The family index containing all the people and their relationships.
     * @param {(nodeId: Id, family: Index) => Id[]} getChildNodes - A function node's children elements.
     * For parents (ancestors) tree, this function returns parent nodes for each person in the marriage.
     * For children (descendants) tree, it returns marriage node children ids.
     */
    constructor(
        family: Index,
        getChildNodes: (nodeId: TreeNode, family: Index) => TreeNode[],
        tree?: FamilyTree,
    ) {
        this.family = family;
        this.getChildNodes = getChildNodes;

        if (tree) {
            this.children = new Map(Object.entries(tree.children));
            this.root = tree.root;
        }
    }

    /**
     * Returns all nodes connections in the current tree.
     *
     * @returns {Map<string, Id[]} - Connections between nodes.
     */
    getChildren(): Map<string, TreeNode[]> {
        return this.children;
    }

    /**
     * Build the initial version of the tree. The resulting tree will contain
     * all direct relatives (all parents or all children).
     *
     * @param {string} root - The root node ID of the tree.
     */
    buildInitialTree(root: string) {
        const id = personIdToTreeNode(root, this.family);
        this.root = id;

        let currentNodes = [id];

        while (currentNodes.length > 0) {
            const newNodes: TreeNode[] = [];
            for (const currentNode of currentNodes) {
                const children = this.getChildNodes(currentNode, this.family);
                this.children.set(currentNode.id.id, children);

                newNodes.push(...children);
            }

            currentNodes = newNodes;
        }
    }

    /**
     * Returns a {@link FamilyTree} instance.
     *
     * @returns {FamilyTree} - A tree that is ready for nodes coordinates calculation.
     */
    familyTree(): FamilyTree {
        if (!this.root) {
            throw new Error(
                'Tree root is not initialized. Please, call `buildInitialTree` method.',
            );
        }

        return {
            children: Object.fromEntries(this.children),
            root: this.root,
        };
    }

    /**
     * Removes the node and it's child nodes from the tree.
     * This method needs the node's parent node id to update its edges.
     *
     * @param {string} nodeId - A node id to remove.
     * @param {string} parentNodeId - A parent node of the `nodeId` parameter.
     */
    removeNode(nodeId: string, parentNodeId: string) {
        this.removeChildrenOf(nodeId);

        const children = this.children.get(parentNodeId);
        if (!children || children.length === 0) {
            return;
        }

        this.children.set(
            parentNodeId,
            children.filter((id) => id.id.id != nodeId),
        );
    }

    /**
     * Removes all nodes children from the tree.
     *
     * @param {string} nodeId - A node id.
     */
    removeChildrenOf(nodeId: string) {
        let children = [nodeId];
        while (children.length > 0) {
            const newChildren: TreeNode[] = [];

            for (const child of children) {
                newChildren.push(...(this.children.get(child) ?? []));

                this.children.delete(child);
            }

            children = newChildren.map((id) => id.id.id);
        }
    }

    /**
     * Created children nodes for the given node.
     * For parents (ancestors) tree, children nodes are parents of the given node.
     * For children (descendants) tree, children nodes are actual children of the given node (marriage).
     *
     * @param {string} nodeId - A node id.
     */
    addChildrenOf(nodeId: string) {
        let currentNodes: TreeNode[] = [personIdToTreeNode(nodeId, this.family)];

        while (currentNodes.length > 0) {
            const newNodes: TreeNode[] = [];
            for (const currentNode of currentNodes) {
                const children = this.getChildNodes(currentNode, this.family);
                this.children.set(currentNode.id.id, children);

                newNodes.push(...children);
            }

            currentNodes = newNodes;
        }
    }

    /**
     * This method is similar to {@link addChildrenOf}, but is used when we want to explicitly
     * specify which child node to add. For example, when the node has many children nodes but we
     * want to add only one of these children to the tree.
     *
     * @param {string} nodeId - A child node we want to add to the tree.
     * @param parentId - A parent node of the `nodeId` parameter.
     * @param side - A place where to append the node. When the `parentId` node already has some
     * children nodes, we need to know where to place a new child node.
     */
    addChildren(nodeId: Id, parentId: string, side: MarriageNodeSide) {
        this.addChildrenOf(nodeId.id);

        let node = nodeIdToTreeNode(nodeId, this.family);

        const children = this.children.get(parentId) ?? [];

        if (side === LEFT_SIDE) {
            children.splice(0, 0, node);
        } else {
            children.push(node);
        }

        this.children.set(parentId, children);
    }

    rearrange(nodeId: Id, action: RearrangeAction) {
        if (action === SWAP_MARRIAGE_SPOUSES) {
            console.warn('unimplemented');
            return;
        }

        let nodeIndex: number = 0;
        let siblings: TreeNode[] | null = null;

        // Yes, we can optimize it by storing parent node id in each node.
        // Usually, direct family trees are small, so it should be fast enough
        // even with such dumb approach.
        for (const [, children] of this.children.entries()) {
            const index = children.findIndex((node) => node.id.id === nodeId.id);
            if (index !== -1) {
                nodeIndex = index;
                siblings = children;
            }
        }

        if (!siblings) {
            console.warn(`${nodeId.id} does not have a parent node.`);
            return;
        }

        let neighborSiblingIndex: number;
        if (action === MOVE_PERSON_LEFT) {
            if (nodeIndex === 0) {
                console.debug(`${nodeId.id} is the leftmost node. Nothing to do.`);
                return;
            }

            neighborSiblingIndex = nodeIndex - 1;
        } else {
            if (nodeIndex === siblings.length - 1) {
                console.debug(`${nodeId.id} is the rightmost node. Nothing to do.`);
                return;
            }

            neighborSiblingIndex = nodeIndex + 1;
        }
        const neighborSibling = siblings[neighborSiblingIndex]!;

        siblings[neighborSiblingIndex] = nodeIdToTreeNode(nodeId, this.family);
        siblings[nodeIndex] = neighborSibling;
    }
}

/**
 * Returns the node parents ids. If the node is a marriage node, then this function will return
 * parents of each person in the marriage. If the node is a person node, then it will return
 * parents id for this person.
 *
 * @param {string} nodeId  - A node id.
 * @param {Index} family - The family index containing all the people and their relationships.
 * @returns {Id[]} - A list of node parents ids.
 */
export function getNodeParents(nodeId: TreeNode, family: Index): TreeNode[] {
    if (nodeId.id.type === PERSON_NODE_TYPE) {
        const parentsMarriageId = family.personParents.get(nodeId.id.id);

        if (!parentsMarriageId) {
            return [];
        }

        const marriage = family.marriageById.get(parentsMarriageId);
        if (!marriage) {
            throw new Error(`${parentsMarriageId} marriage should exist`);
        }

        return [
            {
                id: {
                    id: parentsMarriageId,
                    type: MARRIAGE_NODE_TYPE,
                },
                persons: {
                    person1: marriage.parent1Id,
                    person2: marriage.parent2Id,
                },
            },
        ];
    } else {
        let parentNodes: TreeNode[] = [];

        if (nodeId.persons.person1) {
            const parentsMarriageId = family.personParents.get(nodeId.persons.person1);

            if (parentsMarriageId) {
                const parentsMarriage = family.marriageById.get(parentsMarriageId);
                if (!parentsMarriage) {
                    throw new Error(`${parentsMarriageId} marriage should exist`);
                }

                parentNodes.push({
                    id: {
                        id: parentsMarriageId,
                        type: MARRIAGE_NODE_TYPE,
                    },
                    persons: {
                        person1: parentsMarriage.parent1Id,
                        person2: parentsMarriage.parent2Id,
                    },
                });
            }
        }

        if (nodeId.persons.person2) {
            const parentsMarriageId = family.personParents.get(nodeId.persons.person2);

            if (parentsMarriageId) {
                const parentsMarriage = family.marriageById.get(parentsMarriageId);
                if (!parentsMarriage) {
                    throw new Error(`${parentsMarriageId} marriage should exist`);
                }

                parentNodes.push({
                    id: {
                        id: parentsMarriageId,
                        type: MARRIAGE_NODE_TYPE,
                    },
                    persons: {
                        person1: parentsMarriage.parent1Id,
                        person2: parentsMarriage.parent2Id,
                    },
                });
            }
        }

        return parentNodes;
    }
}

/**
 * Returns node children ids. If the node id is a person node, then the function will
 * return an empty error. A single person cannot have children. If the node id is a
 * marriage node, the the function will return marriage children ids.
 *
 * @param {string} nodeId - A node id.
 * @param {Index} family - The family index containing all the people and their relationships.
 * @returns {Id[]} - A list of marriage children ids.
 */
export function getNodeChildren(nodeId: TreeNode, family: Index): TreeNode[] {
    if (nodeId.id.type === PERSON_NODE_TYPE) {
        return [];
    }

    const marriage = family.marriageById.get(nodeId.id.id);
    if (!marriage) {
        throw new Error(`Marriage ${nodeId.id} should exist`);
    }

    return marriage.childrenIds.map((childId) => personIdToTreeNode(childId, family));
}
