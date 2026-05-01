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
import { getNodeChildren, getNodeParents, TreeBuilder } from './treeBuilder';

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

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const parentsTreeBuilder = new TreeBuilder(family, perspectiveId, getNodeParents);
    const parentsTreeData = parentsTreeBuilder.familyTree();
    const parentsTree = new ReingoldTilfordLayout(parentsTreeData, family, getParentY, true, false);

    // First walk: calculate preliminary X, mod, and shift values.
    const parentsRootPreNode = parentsTree.buildPreNodes(parentsTreeData.root, preNodes, 0, [
        parentsTreeData.root,
    ]);
    // Second walk: calculate final X and Y values, and create nodes.
    parentsTree.finalizeNodesLayout(parentsRootPreNode.id, preNodes, nodes, edges, 0, 0);

    const childrenTreeBuilder = new TreeBuilder(family, perspectiveId, getNodeChildren);
    const childrenTreeData = childrenTreeBuilder.familyTree();
    const childTreeBuilder = new ReingoldTilfordLayout(
        childrenTreeData,
        family,
        getChildY,
        false,
        true,
    );

    // First walk: calculate preliminary X, mod, and shift values.
    const childrenRootPreNode = childTreeBuilder.buildPreNodes(childrenTreeData.root, preNodes, 0, [
        parentsTreeData.root,
    ]);

    // We need to build the children tree relatively to the parents tree.
    const rootsDelta =
        parentsRootPreNode.x +
        parentsRootPreNode.shift -
        (childrenRootPreNode.x + childrenRootPreNode.shift);

    // Second walk: calculate final X and Y values, and create nodes.
    childTreeBuilder.finalizeNodesLayout(
        childrenRootPreNode.id,
        preNodes,
        nodes,
        edges,
        0,
        rootsDelta,
    );

    let rootIds = [parentsRootPreNode.id.id];
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
