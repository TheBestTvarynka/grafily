/**
 * This module builds and modifies the family tree before calculating node positions.
 * When use makes any kind of tree change, for example marriage children collapsing,
 * this module will remove all marriage children nodes from the tree.
 * Or, when the user wants to add new nodes to the tree, this module will add only
 * legal nodes (no edges crossing) to the tree.
 *
 * @module treeBuilder
 */

import { Id, MARRIAGE_NODE_TYPE, PERSON_NODE_TYPE, personIdToNodeId } from 'layout';
import { Index, LEFT_SIDE, MarriageNodeSide } from 'model';

/**
 * The already prepared family tree for nodes coordinates calculation.
 * This tree builder can be used for parents (ancestors) and children (descendants)
 * trees generations. The implemented behaviour is abstract enough.
 *
 * @property {Map<string, Id[]>} children - The abstract node children. For ancestors
 * tree, it will return parent nodes for each person in the marriage. For descendants
 * tree, it will return marriage node children ids.
 * @property {Id} root - The starting node for trees building.
 */
export interface FamilyTree {
    children: Record<string, Id[]>;
    root: Id;
}

/**
 * Tree builder which allows creating and modifying family trees.
 * This tree builder can be used for parents (ancestors) and children (descendants)
 * trees generations. The implemented behaviour is abstract enough.
 */
export class TreeBuilder {
    private family: Index;
    private children: Map<string, Id[]> = new Map();
    private root: Id | null = null;
    private getChildNodes: (nodeId: Id, family: Index) => Id[];

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
        getChildNodes: (nodeId: Id, family: Index) => Id[],
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
    getChildren(): Map<string, Id[]> {
        return this.children;
    }

    /**
     * Build the initial version of the tree. The resulting tree will contain
     * all direct relatives (all parents or all children).
     *
     * @param {string} root - The root node ID of the tree.
     */
    buildInitialTree(root: string) {
        const [id] = personIdToNodeId(root, this.family);
        this.root = id;

        let currentNodes = [id];

        while (currentNodes.length > 0) {
            const newNodes: Id[] = [];
            for (const currentNode of currentNodes) {
                const children = this.getChildNodes(currentNode, this.family);
                this.children.set(currentNode.id, children);

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
            children.filter((id) => id.id != nodeId),
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
            const newChildren: Id[] = [];

            for (const child of children) {
                newChildren.push(...(this.children.get(child) ?? []));

                this.children.delete(child);
            }

            children = newChildren.map((id) => id.id);
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
        let currentNodes: Id[] = [{ id: nodeId, type: MARRIAGE_NODE_TYPE }];

        while (currentNodes.length > 0) {
            const newNodes: Id[] = [];
            for (const currentNode of currentNodes) {
                const children = this.getChildNodes(currentNode, this.family);
                this.children.set(currentNode.id, children);

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

        const children = this.children.get(parentId) ?? [];

        if (side === LEFT_SIDE) {
            children.splice(0, 0, nodeId);
        } else {
            children.push(nodeId);
        }

        this.children.set(parentId, children);
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
export function getNodeParents(nodeId: Id, family: Index): Id[] {
    if (nodeId.type === PERSON_NODE_TYPE) {
        const parentsMarriageId = family.personParents.get(nodeId.id);

        if (!parentsMarriageId) {
            return [];
        }

        return [
            {
                id: parentsMarriageId,
                type: MARRIAGE_NODE_TYPE,
            },
        ];
    } else {
        let parentNodes: Id[] = [];

        const marriage = family.marriageById.get(nodeId.id);
        if (!marriage) {
            return [];
        }

        if (marriage.parent1Id) {
            const parentsMarriageId = family.personParents.get(marriage.parent1Id);

            if (parentsMarriageId) {
                parentNodes.push({
                    id: parentsMarriageId,
                    type: MARRIAGE_NODE_TYPE,
                });
            }
        }

        if (marriage.parent2Id) {
            const parentsMarriageId = family.personParents.get(marriage.parent2Id);

            if (parentsMarriageId) {
                parentNodes.push({
                    id: parentsMarriageId,
                    type: MARRIAGE_NODE_TYPE,
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
export function getNodeChildren(nodeId: Id, family: Index): Id[] {
    if (nodeId.type === PERSON_NODE_TYPE) {
        return [];
    }

    const marriage = family.marriageById.get(nodeId.id);
    if (!marriage) {
        throw new Error(`Marriage ${nodeId.id} should exist`);
    }

    return marriage.childrenIds.map((childId) => {
        const [id] = personIdToNodeId(childId, family);

        return id;
    });
}
