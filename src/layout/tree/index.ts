/**
 * This module contains the direct ancestors-descendants tree layout algorithm implementation.
 * It is based on the Reingold-Tilford algorithm, but a but modified to fit the current use case.
 *
 * Useful links:
 * - {@link https://tbt.qkation.com/posts/draw-tree-using-reingold-tilford-algorithm/} - Drawing Genealogy Graphs. Part 1: Tree Drawing Using Reingold-Tilford Algorithm.
 * - {@link https://www.cs.unc.edu/techreports/89-034.pdf} - A Node-Positioning Algorithm for General Trees. John Q. Walker II. September, 1989.
 * - {@link https://reingold.co/tidier-drawings.pdf} - Tidier Drawings of Trees Edward M. Reingold and John S. Tilford. March 1981.
 * - {@link https://towardsdatascience.com/reingold-tilford-algorithm-explained-with-walkthrough-be5810e8ed93/} - Reingold Tilford Algorithm Explained With Walkthrough. Sep 12, 2023.
 * - {@link https://williamyaoh.com/posts/2023-04-22-drawing-trees-functionally.html} - Drawing Trees Functionally: Reingold and Tilford, 1981. April 22, 2023.
 *
 * @module tree
 */

import { Edge, Node } from '@xyflow/react';
import { Index, Marriage } from '../../model';
import { PERSON_NODE_TYPE, Id, NODES_GAP, NODE_HEIGHT, MARRIAGE_NODE_TYPE } from '../index';
import { PreNode, ReingoldTilfordLayout } from './reingoldTilford';

/**
 * Returns the rightmost parent of the given node.
 *
 * @param {Id} id The Node id to get the rightmost parent for.
 * @param {Index} family The family index containing all the people and their relationships.
 * @returns The rightmost parent of the given node or null if there are no parents.
 */
function getRightmostParent(id: Id, family: Index): Id | null {
    const parents = getParentNodesIds(id, family);

    if (parents[parents.length - 1]) {
        return parents[parents.length - 1] as Id /* SAFE: checked above */;
    } else {
        return null;
    }
}

/**
 * Returns the leftmost parent of the given node.
 *
 * @param {Id} id The Node id to get the leftmost parent for.
 * @param {Index} family The family index containing all the people and their relationships.
 * @returns The leftmost parent of the given node or null if there are no parents.
 */
function getLeftmostParent(id: Id, family: Index): Id | null {
    const parents = getParentNodesIds(id, family);

    if (parents[0]) {
        return parents[0];
    } else {
        return null;
    }
}

/**
 * Returns the rightmost child of the given node.
 *
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
 *
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
    if (currentNode.type === PERSON_NODE_TYPE) {
        const marriageId = family.personParents.get(currentNode.id);

        if (!marriageId) {
            parents = [];
        } else {
            parents = [{ type: MARRIAGE_NODE_TYPE, id: marriageId }];
        }
    } else {
        const marriage = family.marriageById.get(currentNode.id);

        if (!marriage) {
            throw new Error(`Expected marriage to exist for id ${currentNode.id}`);
        }

        if (marriage.parent1Id) {
            let parent1MarriageId = family.personParents.get(marriage.parent1Id);
            let parent1 = family.personById.get(marriage.parent1Id);

            if (parent1MarriageId && !parent1?.isParentsCollapsible) {
                parents.push({ type: MARRIAGE_NODE_TYPE, id: parent1MarriageId });
            }
        }

        if (marriage.parent2Id) {
            let parent2MarriageId = family.personParents.get(marriage.parent2Id);
            let parent2 = family.personById.get(marriage.parent2Id);

            if (parent2MarriageId && !parent2?.isParentsCollapsible) {
                parents.push({ type: MARRIAGE_NODE_TYPE, id: parent2MarriageId });
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

    if (currentNode.type === PERSON_NODE_TYPE) {
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

    if (marriage.isChildrenCollapsed) {
        return [];
    }

    return marriage.childrenIds.map((id) => {
        const marriages = family.personMarriages.get(id);
        if (!marriages || !marriages[0]) {
            return { type: PERSON_NODE_TYPE, id };
        } else {
            return { type: MARRIAGE_NODE_TYPE, id: marriages[0].id };
        }
    });
}

/**
 * Returns the y coordinate for the parent node of the given generation level.
 *
 * @param {number} level Person (node) generation level.
 * @returns The y coordinate for the given generation level.
 */
function getParentY(level: number): number {
    return -1 * level * (NODE_HEIGHT + NODES_GAP);
}

/**
 * Returns the y coordinate for the child node of the given generation level.
 *
 * @param {number} level Person (node) generation level.
 * @returns The y coordinate for the given generation level.
 */
function getChildY(level: number): number {
    return level * (NODE_HEIGHT + NODES_GAP);
}

export class ReingoldTilford {
    private family: Index;

    /**
     * Creates an instance of the ReingoldTilford layout with the provided family index.
     *
     * @param {Index} family - The family index containing all the information about persons and marriages.
     */
    constructor(family: Index) {
        this.family = family;
    }

    /**
     * Initializes the initial graph, calculates nodes coordinates, and creates graph nodes and edges.
     *
     * @param {string} perspectivePersonId - The person id to build the graph from the perspective of. This person will be in the "center" of the graph.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    buildNodes(perspectiveId: string): [Node[], Edge[]] {
        return buildNodes(perspectiveId, this.family);
    }

    /**
     * Collapses the children of a given marriage.
     *
     * @param {string} nodeId - The id of the node to collapse its children. This node if must be a marriage id.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    collapseChildren(_nodeId: string): [Node[], Edge[]] {
        throw new Error(
            'Collapsing children is not supported in the current version of the Reingold-Tilford layout',
        );
    }

    /**
     * Collapses the parents of a given person.
     *
     * @param {string} personId - The person id to collapse its parents.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    collapseParents(_personId: string): [Node[], Edge[]] {
        throw new Error(
            'Collapsing parents is not supported in the current version of the Reingold-Tilford layout',
        );
    }

    /**
     * Expands the children of a given marriage.
     *
     * @param {string} nodeId - The marriage id to expand its children.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    expandChildren(_nodeId: string): [Node[], Edge[]] {
        throw new Error(
            'Expanding children is not supported in the current version of the Reingold-Tilford layout',
        );
    }

    /**
     * Expands the parents of a given person.
     *
     * @param {string} personId - The person id to expand its parents.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    expandParents(_personId: string): [Node[], Edge[]] {
        throw new Error(
            'Expanding parents is not supported in the current version of the Reingold-Tilford layout',
        );
    }
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
    const marriages = family.personMarriages.get(perspectiveId) ?? [];
    const marriagePersons: string[] = [];
    if (marriages.length > 0) {
        const marriage = marriages[0];
        if (!marriage) {
            throw new Error(
                `Invalid number of marriages for person(${perspectiveId}): ${marriages.length}. Only one marriage per person is supported.`,
            );
        }
        id = { type: MARRIAGE_NODE_TYPE, id: marriage.id };
        if (marriage.parent1Id) {
            marriagePersons.push(marriage.parent1Id);
        }
        if (marriage.parent2Id) {
            marriagePersons.push(marriage.parent2Id);
        }
    } else {
        id = { type: PERSON_NODE_TYPE, id: perspectiveId };
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const parentsTreeBuilder = new ReingoldTilfordLayout(
        getRightmostParent,
        getLeftmostParent,
        getParentNodesIds,
        getParentY,
        family,
        true,
        false,
    );

    // First walk: calculate preliminary X, mod, and shift values.
    const parentsRootPreNode = parentsTreeBuilder.buildPreNodes(id, preNodes, 0, [id]);
    // Second walk: calculate final X and Y values, and create nodes.
    parentsTreeBuilder.finalizeNodesLayout(parentsRootPreNode.id, preNodes, nodes, edges, 0, 0);

    const childTreeBuilder = new ReingoldTilfordLayout(
        getRightmostChild,
        getLeftmostChild,
        getChildNodesIds,
        getChildY,
        family,
        false,
        true,
    );

    // First walk: calculate preliminary X, mod, and shift values.
    const childrenRootPreNode = childTreeBuilder.buildPreNodes(id, preNodes, 0, [id]);

    // We need to build the children tree relatively to the parents tree.
    const rootsDelta = parentsRootPreNode.x - childrenRootPreNode.x;

    // Second walk: calculate final X and Y values, and create nodes.
    childTreeBuilder.finalizeNodesLayout(
        childrenRootPreNode.id,
        preNodes,
        nodes,
        edges,
        0,
        rootsDelta,
    );

    let rootIds = [parentsRootPreNode.id, ...marriagePersons];
    // We built two trees: one for parents and one for children. So, we have two nodes for the root person.
    // We use this flag to filter nodes and keep only one root node.
    let rootAdded = false;

    // Yes, we can do smarter that that but I do not want to overcomplicate it.
    const uniqueEdges = new Set<string>();
    return [
        nodes.filter((node) => {
            if (!rootIds.includes(node.id)) {
                return true;
            }

            if (!rootAdded) {
                rootAdded = true;
                return true;
            }

            // We already added the root node, so we need to skip the second one.
            return true;
        }),
        edges.filter((edge) => {
            if (!uniqueEdges.has(edge.id)) {
                uniqueEdges.add(edge.id);
                return true;
            }

            return false;
        }),
    ];
}
