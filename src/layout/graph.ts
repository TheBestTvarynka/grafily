/**
 * This module renders a built family graph into the nodes and edges the view draws.
 *
 * Everything here is independent of the positioning algorithm except the x coordinates, which
 * are delegated to an injected {@link PositionX} function. That is the only thing a graph-based
 * layout has to bring of its own: the graph building, the node and edge emission, and every
 * user action are shared. See the `brandesKopf` and `beta` modules for the two positioners.
 *
 * @module graph
 */

import { Edge, Node } from '@xyflow/react';

import {
    BRANDES_KORF,
    FamilyGraph,
    GraphNode,
    LayoutKind,
    QUADRATIC,
    MARRIAGE_GAP,
    MARRIAGE_NODE_SIZE,
    MARRIAGE_NODE_TYPE,
    MARRIAGE_WIDTH,
    NODES_GAP,
    NODE_HEIGHT,
    NODE_WIDTH,
    NodeCapabilities,
    PERSON_NODE_TYPE,
    PersonVisibility,
    PositioningAlgorithm,
    RearrangeAction,
    SerializableLayoutData,
    TREE,
    personIdToNodeId,
} from './';
import { positionX as positionBrandesKopf, positionY } from './positioning/brandesKopf';
import { positionQuadratic } from './positioning/quadratic/quadratic';
import { GraphBuilder } from './builder';
import { Index, LEFT_SIDE, NONE_SIDE, RIGHT_SIDE } from '../model';
import { MarriageNodeData, PersonNodeData } from 'view/node';

/**
 * Assigns an x coordinate - the geometrical center of the node - to every node of the graph.
 * See the `positioning` module for the implementations.
 */
export type PositionX = (
    graph: FamilyGraph,
    nodeWidth: (v: string) => number,
    nodeSep: number,
) => Record<string, number>;

/**
 * Returns the function that implements the given positioning algorithm.
 *
 * @param {PositioningAlgorithm} algorithm - The algorithm to look up.
 * @returns {PositionX} - The x coordinates assignment implementing it.
 */
export function positionerFor(algorithm: PositioningAlgorithm): PositionX {
    switch (algorithm) {
        case BRANDES_KORF:
            return positionBrandesKopf;
        case QUADRATIC:
            return positionQuadratic;
        default: {
            // Turns a forgotten algorithm into a compile error rather than an undefined
            // positioner at run time.
            const unsupported: never = algorithm;

            throw new Error(`Unsupported positioning algorithm: ${String(unsupported)}`);
        }
    }
}

/**
 * The state a graph-based layout serializes. Both graph layouts share it, because they build the
 * same graph and differ only in where the nodes end up horizontally.
 */
export type GraphLayoutData = {
    graph: FamilyGraph;
    nodes: Record<string, GraphNode>;
};

/**
 * A family graph layout. Handles general directed acyclic graphs (DAGs) and is not limited to
 * tree structures.
 *
 * This class is not tied to a single algorithm: it is composed with the {@link PositionX}
 * function it should use, so a new graph-based layout is a new positioner plus a name, and
 * nothing else.
 */
export class GraphLayout {
    family: Index;
    graph: GraphBuilder;
    private readonly kind: LayoutKind;
    // These two must always agree, so they are only ever set together - by the constructor or by
    // `setAlgorithm`. Read the current algorithm through the `algorithm` getter.
    private currentAlgorithm: PositioningAlgorithm;
    private positionX: PositionX;

    /**
     * Constructs a new instance of the graph layout.
     *
     * @param {Index} family - The family index containing all the information about persons and marriages.
     * @param {LayoutKind} kind - What to put into the initial graph: a family tree or a full graph.
     * @param {PositioningAlgorithm} algorithm - The name of the algorithm `positionX` implements, written into the serialized state.
     * @param {PositionX} positionX - The x coordinates assignment to use.
     * @param {GraphBuilder} graph - An already built graph. When omitted, an empty one is created.
     */
    constructor(
        family: Index,
        kind: LayoutKind,
        algorithm: PositioningAlgorithm,
        positionX: PositionX,
        graph?: GraphBuilder,
    ) {
        this.family = family;
        this.kind = kind;
        this.currentAlgorithm = algorithm;
        this.positionX = positionX;

        if (graph) {
            this.graph = graph;
        } else {
            this.graph = new GraphBuilder(family);
        }
    }

    /**
     * The positioning algorithm currently in use.
     */
    get algorithm(): PositioningAlgorithm {
        return this.currentAlgorithm;
    }

    /**
     * Switches the positioning algorithm and recalculates every node position.
     *
     * The graph itself is untouched: this only changes where the existing nodes are drawn, so
     * everything the user has collapsed, expanded or rearranged survives the switch.
     *
     * @param {PositioningAlgorithm} algorithm - The algorithm to switch to.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    setAlgorithm(algorithm: PositioningAlgorithm): [Node[], Edge[]] {
        this.currentAlgorithm = algorithm;
        this.positionX = positionerFor(algorithm);

        return this.buildNodesInternal();
    }

    /**
     * Calculates positions for all nodes in the graph and creates graph nodes and edges.
     *
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    private buildNodesInternal(): [Node[], Edge[]] {
        const familyGraph = this.graph.buildFamilyGraph();

        const nodeWidth = (id: string): number => {
            if (this.family.marriageById.get(id)) {
                return MARRIAGE_WIDTH;
            }

            if (this.family.personById.get(id)) {
                return NODE_WIDTH;
            }

            throw new Error(`Node/Marriage ${id} not found`);
        };

        const xCoords = this.positionX(familyGraph, nodeWidth, NODES_GAP);
        const yCoords = positionY(familyGraph, (_id) => NODE_HEIGHT, NODES_GAP);

        const nodes: Node[] = [];
        const edges: Edge[] = [];

        // Returns `true` if the parents of the person are collapsed.
        // Returns `false` if the person has no parents or if the parents are expanded.
        const isParentsCollapsed = (personId: string): boolean => {
            const personParentsMarriageId = this.family.personParents.get(personId);

            if (!personParentsMarriageId) {
                return false;
            }

            // The person's parents are expanded if and only if the marriage node corresponding to the person's parents is present in the graph.
            return !this.graph.getNodes().has(personParentsMarriageId);
        };

        const isChildrenCollapsed = (marriageId: string): boolean => {
            return (this.graph.getChildren().get(marriageId) ?? []).length === 0;
        };

        this.graph.getNodes().forEach((node, id) => {
            // (x; y) is the geometrical center of the node.
            const x = xCoords[id] ?? 0;
            const y = yCoords[id] ?? 0;

            if (node.type === MARRIAGE_NODE_TYPE) {
                const nodeData: MarriageNodeData = {
                    id,
                    isChildrenCollapsible: true,
                    isChildrenCollapsed: isChildrenCollapsed(id),
                };

                nodes.push({
                    id,
                    data: nodeData,
                    type: MARRIAGE_NODE_TYPE,
                    position: {
                        x: x - MARRIAGE_NODE_SIZE / 2,
                        y: y - MARRIAGE_NODE_SIZE / 2,
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

                if (node.persons.person1) {
                    const nodeData: PersonNodeData = {
                        id: node.persons.person1,
                        side: RIGHT_SIDE,
                        isParentsCollapsible: true,
                        isParentsCollapsed: isParentsCollapsed(node.persons.person1),
                    };

                    nodes.push({
                        id: node.persons.person1,
                        data: nodeData,
                        position: {
                            x: x - MARRIAGE_WIDTH / 2,
                            y: y - NODE_HEIGHT / 2,
                        },
                        type: PERSON_NODE_TYPE,
                        style: {
                            color: '#222',
                        },
                    });

                    edges.push({
                        id: id + '-to-' + node.persons.person1,
                        target: node.persons.person1,
                        source: id,
                        sourceHandle: 'left',
                        targetHandle: 'right',
                        type: 'smoothstep',
                    });
                }

                if (node.persons.person2) {
                    const nodeData: PersonNodeData = {
                        id: node.persons.person2,
                        side: LEFT_SIDE,
                        isParentsCollapsible: true,
                        isParentsCollapsed: isParentsCollapsed(node.persons.person2),
                    };

                    nodes.push({
                        id: node.persons.person2,
                        data: nodeData,
                        position: {
                            x: x + MARRIAGE_GAP,
                            y: y - NODE_HEIGHT / 2,
                        },
                        type: PERSON_NODE_TYPE,
                        style: {
                            color: '#222',
                        },
                    });

                    edges.push({
                        id: id + '-to-' + node.persons.person2,
                        target: node.persons.person2,
                        source: id,
                        sourceHandle: 'right',
                        targetHandle: 'left',
                        type: 'smoothstep',
                    });
                }
            }
            if (node.type === PERSON_NODE_TYPE) {
                const nodeData: PersonNodeData = {
                    id: node.persons.person1!,
                    side: NONE_SIDE,
                    isParentsCollapsible: true,
                    isParentsCollapsed: false,
                };

                nodes.push({
                    id,
                    data: nodeData,
                    position: {
                        x: x - NODE_WIDTH / 2,
                        y: y - NODE_HEIGHT / 2,
                    },
                    type: PERSON_NODE_TYPE,
                    style: {
                        color: '#222',
                    },
                });
            }
        });

        for (const [parentsMarriageId] of this.graph.getChildren().entries()) {
            const marriage = this.family.marriageById.get(parentsMarriageId)!;
            for (const childId of marriage.childrenIds) {
                edges.push({
                    id: `${parentsMarriageId}-to-${childId}`,
                    source: parentsMarriageId,
                    target: childId,
                    sourceHandle: 'bottom',
                    targetHandle: 'top',
                    type: 'smoothstep',
                });
            }
        }

        return [nodes, edges];
    }

    /**
     * Initializes the initial graph, calculates nodes coordinates, and creates graph nodes and edges.
     *
     * @param {string} perspectivePersonId - The person id to build the graph from the perspective of. This person will be in the "center" of the graph.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    buildNodes(perspectivePersonId: string): [Node[], Edge[]] {
        this.graph = new GraphBuilder(this.family);

        if (this.kind === TREE) {
            this.graph.buildInitialTree(perspectivePersonId);
        } else {
            this.graph.buildInitialGraph(perspectivePersonId);
        }

        return this.buildNodesInternal();
    }

    /**
     * Collapses the children of a given marriage.
     *
     * @param {string} nodeId - The id of the node to collapse its children. This node if must be a marriage id.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    collapseChildren(nodeId: string): [Node[], Edge[]] {
        this.graph.removeChildrenOf(nodeId);

        return this.buildNodesInternal();
    }

    /**
     * Collapses the parents of a given person.
     *
     * @param {string} personId - The person id to collapse its parents.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    collapseParents(personId: string): [Node[], Edge[]] {
        const [nodeId] = personIdToNodeId(personId, this.family);

        const personParentsId = this.family.personParents.get(personId);
        let except = '';
        if (personParentsId) {
            const parents = this.graph.getParents().get(nodeId.id) ?? [];

            except = parents.find((parentsId) => parentsId !== personParentsId) ?? '';
        }

        this.graph.removeParentsOf(nodeId.id, except);

        return this.buildNodesInternal();
    }

    /**
     * Expands the children of a given marriage.
     *
     * @param {string} nodeId - The marriage id to expand its children.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    expandChildren(nodeId: string): [Node[], Edge[]] {
        this.graph.addChildrenOf(nodeId);

        return this.buildNodesInternal();
    }

    /**
     * Expands the parents of a given person.
     *
     * @param {string} personId - The person id to expand its parents.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    expandParents(personId: string): [Node[], Edge[]] {
        this.graph.addParentsOf(personId);

        return this.buildNodesInternal();
    }

    /**
     * This method is used to changes nodes positions within the layout. This method never deletes or
     * add nodes. Only changes they arrangement: position among siblings or person's position relative
     * to the spouse within the node. See also the {@link RearrangeAction} type documentation.
     * The {@link MOVE_PERSON_LEFT} and {@link MOVE_PERSON_RIGHT} actions have limitations:
     * - The selected node and the neighbor node in the move direction must not have children nodes
     *   (children nodes must be collapsed).4
     * - The selected node and the neighbor node in the move direction must have only one parent
     *   connection: the common parent node. Spouses parents must be collapsed.
     * The {@link SWAP_MARRIAGE_SPOUSES} action has limitations:
     * - Maximum one parent node of the selected node can be present.
     *
     * @param {string} personId - A person id which user has selected.
     * @param {RearrangeAction} action - An action to be performed.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    rearrange(personId: string, action: RearrangeAction): [Node[], Edge[]] {
        const [id] = personIdToNodeId(personId, this.family);

        this.graph.rearrange(id, action);

        return this.buildNodesInternal();
    }

    capabilities(personId: string): NodeCapabilities {
        const [id] = personIdToNodeId(personId, this.family);

        return this.graph.capabilities(id);
    }

    /**
     * Returns the layout state ready for serialization. Is it safe to stringify it to the JSON
     * and parse back again.
     * For the graph layouts, the `data` field has the {@link GraphLayoutData} type.
     *
     * @returns {SerializableLayoutData} - A object ready to be serialized.
     */
    toSerializableObject(): SerializableLayoutData {
        const nodes: Record<string, GraphNode> = Object.fromEntries(this.graph.getNodes());

        return {
            kind: this.kind,
            algorithm: this.algorithm,
            data: {
                graph: this.graph.buildFamilyGraph(),
                nodes,
            },
        };
    }

    /**
     * Checks if the given person id is present in the current layout.
     *
     * @param {string} personId - A person id which user has selected.
     * @returns Returns true when the given person id is present in the current layout. Otherwise, returns false.
     */
    contains(personId: string): PersonVisibility {
        const [nodeId] = personIdToNodeId(personId, this.family);

        return { isVisible: this.graph.contains(nodeId.id), disabled: false };
    }

    toggleSiblingVisibility(personIds: string[], selectedParentNodeId: string): [Node[], Edge[]] {
        for (const personId of personIds) {
            const [nodeId] = personIdToNodeId(personId, this.family);

            this.graph.toggleSiblingVisibility(nodeId, selectedParentNodeId);
        }

        return this.buildNodesInternal();
    }
}
