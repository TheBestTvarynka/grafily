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
    NodeCapabilities,
    personIdToNodeId,
    RearrangeAction,
    REINGOLD_TILFORD,
    SerializableLayout,
    SWAP_MARRIAGE_SPOUSES,
} from '../index';
import { getChildY, getParentY, PreNode, ReingoldTilfordLayout } from './reingoldTilford';
import { FamilyTree, getNodeChildren, getNodeParents, TreeBuilder } from './treeBuilder';
import { MarriageNodeData, PersonNodeData } from 'view/node';

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
                        const nodeData: PersonNodeData = node.data as PersonNodeData;
                        nodeData.isParentsCollapsible = true;

                        const parentsId = this.family.personParents.get(node.id);
                        if (parentsId) {
                            const [id] = personIdToNodeId(node.id, this.family);
                            let isParentsCollapsed = false;

                            const nodeParents =
                                this.parentsTreeBuilder.getChildren().get(id.id) ?? [];
                            if (nodeParents.find((id) => id.id.id === parentsId)) {
                                isParentsCollapsed = false;
                            } else {
                                isParentsCollapsed = true;
                            }

                            nodeData.isParentsCollapsed = isParentsCollapsed;
                        }
                    } else {
                        const marriage = this.family.marriageById.get(node.id);
                        if (!marriage) {
                            console.warn(
                                `${node.id} node id is not person a person id and not a marriage id. that's weird.`,
                            );
                            return true;
                        }

                        const nodeData: MarriageNodeData = node.data as MarriageNodeData;
                        nodeData.isChildrenCollapsible = true;
                        nodeData.isChildrenCollapsed =
                            (this.childrenTreeBuilder.getChildren().get(node.id) ?? []).length ===
                            0;
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

    /**
     * This method is used to changes nodes positions within the layout. This method never deletes or
     * add nodes. Only changes they arrangement: position among siblings or person's position relative
     * to the spouse within the node.
     * to the spouse within the node. See also the {@link RearrangeAction} type documentation.
     * - The {@link MOVE_PERSON_LEFT} and {@link MOVE_PERSON_RIGHT} actions have limitations: they can
     *   be applied only to children nodes starting from the root node (e.g. children of the root node,
     *   children of the children of the root node, etc).
     * - The {@link SWAP_MARRIAGE_SPOUSES} action can be applied to any node in the tree.
     *
     * @param {string} personId - A person id which user has selected.
     * @param {RearrangeAction} action - An action to be performed.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    rearrange(personId: string, action: RearrangeAction): [Node[], Edge[]] {
        const [id] = personIdToNodeId(personId, this.family);

        if (action === SWAP_MARRIAGE_SPOUSES) {
            this.parentsTreeBuilder.rearrange(id, action, true);
            this.childrenTreeBuilder.rearrange(id, action, false);
        } else {
            this.childrenTreeBuilder.rearrange(id, action);
        }

        return this.buildNodesInternal();
    }

    capabilities(personId: string): NodeCapabilities {
        const [id] = personIdToNodeId(personId, this.family);

        const c1 = this.parentsTreeBuilder.capabilities(id);
        const c2 = this.childrenTreeBuilder.capabilities(id);

        return {
            // MOVE_PERSON_LEFT and MOVE_PERSON_RIGHT actions is available only for the children tree.
            movableLeft: c2.movableLeft,
            movableRight: c2.movableRight,
            spousesSwappable: c1.spousesSwappable || c2.spousesSwappable,
        };
    }

    /**
     * Returns the layout state ready for serialization. Is it safe to stringify it to the JSON
     * and parse back again.
     * For the `ReingoldTilford`, the `data` field has `{ parentsTreeBuilder: FamilyTree, childrenTreeBuilder: FamilyTree }` type.
     *
     * @returns {SerializableLayout} - A object ready to be serialized.
     */
    toSerializableObject(): SerializableLayout {
        return {
            name: REINGOLD_TILFORD,
            data: {
                parentsTreeBuilder: this.parentsTreeBuilder.familyTree(),
                childrenTreeBuilder: this.childrenTreeBuilder.familyTree(),
            },
        };
    }

    /**
     * Checks if the given person id is present in the current layout.
     *
     * @param {string} personId - A person id which user has selected.
     * @returns Returns true when the given person id is present in the current layout. Otherwise, returns false.
     */
    contains(personId: string): boolean {
        const [id] = personIdToNodeId(personId, this.family);

        return this.childrenTreeBuilder.contains(id.id);
    }

    toggleSiblingVisibility(personId: string, selectedParentNodeId: string): [Node[], Edge[]] {
        const [id] = personIdToNodeId(personId, this.family);
        this.childrenTreeBuilder.toggleSiblingVisibility(id.id, selectedParentNodeId);

        return this.buildNodesInternal();
    }
}

/**
 * Then the user wants to save the layout into a file or somewhere else, it generates
 * the {@link SerializableLayout} object using the `toSerializableObject` method on the
 * {@link ReingoldTilford} class. Later, the user can use this method to construct and use
 * the {@link ReingoldTilford} object back again.
 *
 * @param {SerializableLayout} layout - Layout data.
 * @param {Index} family - The family index containing all the people and their relationships.
 * @returns {ReingoldTilford} - {@link ReingoldTilford} instance.
 */
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
