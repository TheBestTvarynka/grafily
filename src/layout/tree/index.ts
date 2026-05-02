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
import { Index, LEFT_SIDE, MarriageNodeSide, NONE_SIDE, RIGHT_SIDE } from '../../model';
import {
    MARRIAGE_NODE_TYPE,
    personIdToNodeId,
    REINGOLD_TILFORD,
    SerializableLayout,
} from '../index';
import { getChildY, getParentY, PreNode, ReingoldTilfordLayout } from './reingoldTilford';
import { FamilyTree, getNodeChildren, getNodeParents, TreeBuilder } from './treeBuilder';

export class ReingoldTilford {
    private family: Index;
    private parentsTreeBuilder: TreeBuilder;
    private childrenTreeBuilder: TreeBuilder;
    private root: string | null = null;

    /**
     * Creates an instance of the ReingoldTilford layout with the provided family index.
     *
     * @param {Index} family - The family index containing all the information about persons and marriages.
     */
    constructor(
        family: Index,
        parentsTreeBuilder?: TreeBuilder,
        childrenTreeBuilder?: TreeBuilder,
    ) {
        this.family = family;

        if (parentsTreeBuilder) {
            this.parentsTreeBuilder = parentsTreeBuilder;
        } else {
            this.parentsTreeBuilder = new TreeBuilder(this.family, getNodeParents);
        }

        if (childrenTreeBuilder) {
            this.childrenTreeBuilder = childrenTreeBuilder;
        } else {
            this.childrenTreeBuilder = new TreeBuilder(this.family, getNodeChildren);
        }
    }

    private buildNodesInternal(): [Node[], Edge[]] {
        const parentsTreeData = this.parentsTreeBuilder.familyTree();
        const parentsTree = new ReingoldTilfordLayout(
            parentsTreeData,
            this.family,
            getParentY,
            true,
            false,
        );

        const childrenTreeData = this.childrenTreeBuilder.familyTree();
        const childTreeBuilder = new ReingoldTilfordLayout(
            childrenTreeData,
            this.family,
            getChildY,
            false,
            true,
        );

        const preNodes = new Map<string, PreNode>();

        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // First walk: calculate preliminary X, mod, and shift values.
        const parentsRootPreNode = parentsTree.buildPreNodes(parentsTreeData.root, preNodes, 0, [
            parentsTreeData.root,
        ]);
        // Second walk: calculate final X and Y values, and create nodes.
        parentsTree.finalizeNodesLayout(parentsRootPreNode.id, preNodes, nodes, edges, 0, 0);

        // First walk: calculate preliminary X, mod, and shift values.
        const childrenRootPreNode = childTreeBuilder.buildPreNodes(
            childrenTreeData.root,
            preNodes,
            0,
            [parentsTreeData.root],
        );

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

        const [id, marriage] = personIdToNodeId(this.root!, this.family);
        const rootIds: Map<string, boolean> = new Map();
        rootIds.set(id.id, false);
        if (id.type === MARRIAGE_NODE_TYPE) {
            if (!marriage) {
                throw new Error(`Marriage should exist for id ${id.id}`);
            }

            if (marriage.parent1Id) {
                rootIds.set(marriage.parent1Id, false);
            }

            if (marriage.parent2Id) {
                rootIds.set(marriage.parent2Id, false);
            }
        }

        // Yes, we can do smarter that that but I do not want to overcomplicate it.
        const uniqueEdges = new Set<string>();
        return [
            nodes.filter((node) => {
                if (!rootIds.has(node.id)) {
                    return true;
                }

                // SAFE: checked above.
                const rootId = rootIds.get(node.id)!;

                if (!rootId) {
                    // Is not used yet.
                    rootIds.set(node.id, true);

                    const person = this.family.personById.get(node.id);
                    if (person) {
                        person.isParentsCollapsible = true;

                        const parentsId = this.family.personParents.get(node.id);
                        if (parentsId) {
                            const [id] = personIdToNodeId(node.id, this.family);
                            let isParentsCollapsed = false;

                            const nodeParents =
                                this.parentsTreeBuilder.getChildren().get(id.id) ?? [];
                            if (nodeParents.find((id) => id.id === parentsId)) {
                                isParentsCollapsed = false;
                            } else {
                                isParentsCollapsed = true;
                            }

                            person.isParentsCollapsed = isParentsCollapsed;
                        }
                    }

                    return true;
                } else {
                    return false;
                }
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

    /**
     * Initializes the initial graph, calculates nodes coordinates, and creates graph nodes and edges.
     *
     * @param {string} perspectivePersonId - The person id to build the graph from the perspective of. This person will be in the "center" of the graph.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    buildNodes(perspectiveId: string): [Node[], Edge[]] {
        this.root = perspectiveId;
        this.parentsTreeBuilder.buildInitialTree(perspectiveId);
        this.childrenTreeBuilder.buildInitialTree(perspectiveId);

        return this.buildNodesInternal();
    }

    /**
     * Collapses the children of a given marriage.
     *
     * @param {string} nodeId - The id of the node to collapse its children. This node if must be a marriage id.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    collapseChildren(nodeId: string): [Node[], Edge[]] {
        this.childrenTreeBuilder.removeChildrenOf(nodeId);

        return this.buildNodesInternal();
    }

    /**
     * Collapses the parents of a given person.
     *
     * @param {string} personId - The person id to collapse its parents.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    collapseParents(personId: string): [Node[], Edge[]] {
        const parents = this.family.personParents.get(personId);
        if (!parents) {
            console.warn(`Person ${personId} should have parents.`);

            return this.buildNodesInternal();
        }

        const [id] = personIdToNodeId(personId, this.family);
        this.parentsTreeBuilder.removeNode(parents, id.id);

        return this.buildNodesInternal();
    }

    /**
     * Expands the children of a given marriage.
     *
     * @param {string} nodeId - The marriage id to expand its children.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    expandChildren(nodeId: string): [Node[], Edge[]] {
        this.childrenTreeBuilder.addChildrenOf(nodeId);

        return this.buildNodesInternal();
    }

    /**
     * Expands the parents of a given person.
     *
     * @param {string} personId - The person id to expand its parents.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    expandParents(personId: string): [Node[], Edge[]] {
        const parentsId = this.family.personParents.get(personId);
        if (!parentsId) {
            console.warn(`Person ${personId} should have parents`);

            return this.buildNodesInternal();
        }

        const [, marriage] = personIdToNodeId(personId, this.family);
        let side: MarriageNodeSide = NONE_SIDE;

        if (marriage) {
            if (marriage.parent1Id === personId) {
                side = LEFT_SIDE;
            }
            if (marriage.parent2Id === personId) {
                side = RIGHT_SIDE;
            }
        }

        this.parentsTreeBuilder.addChildren(
            { id: parentsId, type: MARRIAGE_NODE_TYPE },
            marriage ? marriage.id : personId,
            side,
        );

        return this.buildNodesInternal();
    }

    toSerializableObject(): SerializableLayout {
        return {
            name: REINGOLD_TILFORD,
            data: {
                parentsTreeBuilder: this.parentsTreeBuilder.familyTree(),
                childrenTreeBuilder: this.childrenTreeBuilder.familyTree(),
            },
        };
    }
}

export function fromSerializableObject(layout: SerializableLayout, family: Index): ReingoldTilford {
    // Trust me, I am Engineer!
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */

    if (layout.name !== REINGOLD_TILFORD) {
        throw new Error(`Invalid layout name: ${layout.name}. Expected: ${REINGOLD_TILFORD}`);
    }

    const parentsTreeBuilder = new TreeBuilder(
        family,
        getNodeParents,
        layout.data.parentsTreeBuilder as FamilyTree,
    );
    const childrenTreeBuilder = new TreeBuilder(
        family,
        getNodeChildren,
        layout.data.childrenTreeBuilder as FamilyTree,
    );

    return new ReingoldTilford(family, parentsTreeBuilder, childrenTreeBuilder);
}
