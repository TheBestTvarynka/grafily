import { Edge, Node } from '@xyflow/react';

import {
    BRANDES_KORF,
    MARRIAGE_GAP,
    MARRIAGE_NODE_SIZE,
    MARRIAGE_NODE_TYPE,
    MARRIAGE_WIDTH,
    NODES_GAP,
    NODE_HEIGHT,
    NODE_WIDTH,
    NodeCapabilities,
    PERSON_NODE_TYPE,
    RearrangeAction,
    SerializableLayoutData,
    personIdToNodeId,
} from '../';
import { Index, LEFT_SIDE, NONE_SIDE, RIGHT_SIDE } from '../../model';
import { positionX, positionY } from './brandesKopf';
import { GraphBuilder, GraphNode } from './graphBuilder';
import { MarriageNodeData, PersonNodeData } from 'view/node';

/**
 * Represents the family graph. No modifications are needed to this graph. It is ready for nodes positions calculations.
 * When the graph is modified by the user, a new instance of the graph must be created by the {@link GraphBuilder} class.
 *
 * @property {Map<string, string[]>} parents - A map where the key is a node id and the value is an array of parent node ids.
 * @property {Map<string, string[]>} children - A map where the key is a node id and the value is an array of child node ids.
 * @property {string[][]} layering - A 2D array where layering[level][order] = nodeId. For example, layering[0] is the list of node ids in the first (top) layer,
 * sorted by their `order` value. In DAG-related papers, the `order` value is often referred to as the "position" of the node within its layer or "rank".
 */
export interface FamilyGraph {
    /** parents[nodeId] = array of parent node ids */
    parents: Record<string, string[]>;
    /** children[nodeId] = array of child node ids */
    children: Record<string, string[]>;
    /**
     * layering[level][order] = nodeId
     * e.g. layering[0] is the list of node ids in the first (top) layer,
     * sorted by their `order` value.
     */
    layering: string[][];
    /** This field is not used during coordinates calculation. It is only needed for deserializing graph from the file. */
    firstLayer: number;
}

/**
 * Represents the family graph layout based on the Brandes-Kopf algorithm. This layout is designed to handle general directed acyclic graphs (DAGs) and is not limited to tree structures.
 */
export class BrandesKopfLayout {
    family: Index;
    graph: GraphBuilder;

    /**
     * Constructs a new instance of the Brandes-Kopf layout.
     *
     * @param {Index} family - The family index containing all the information about persons and marriages.
     */
    constructor(family: Index, graph?: GraphBuilder) {
        this.family = family;
        if (graph) {
            this.graph = graph;
        } else {
            this.graph = new GraphBuilder(family);
        }
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

        const xCoords = positionX(familyGraph, nodeWidth, NODES_GAP);
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
        this.graph.buildInitialGraph(perspectivePersonId);

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
     * For the `BrandesKopfLayout`, the `data` field has `{ graph: FamilyGraph, nodes: Record<string, GraphNode> }` type.
     *
     * @returns {SerializableLayout} - A object ready to be serialized.
     */
    toSerializableObject(): SerializableLayoutData {
        const nodes: Record<string, GraphNode> = Object.fromEntries(this.graph.getNodes());

        return {
            name: BRANDES_KORF,
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
    contains(personId: string): boolean {
        const [nodeId] = personIdToNodeId(personId, this.family);

        return this.graph.contains(nodeId.id);
    }

    toggleSiblingVisibility(personId: string, selectedParentNodeId: string): [Node[], Edge[]] {
        const [nodeId] = personIdToNodeId(personId, this.family);

        this.graph.toggleSiblingVisibility(nodeId, selectedParentNodeId);

        return this.buildNodesInternal();
    }
}

export type BrandesKopfLayoutData = {
    graph: FamilyGraph;
    nodes: Record<string, GraphNode>;
};

/**
 * Then the user wants to save the layout into a file or somewhere else, it generates
 * the {@link SerializableLayout} object using the `toSerializableObject` method on the
 * {@link BrandesKopfLayout} class. Later, the user can use this method to construct and use
 * the {@link BrandesKopfLayout} object back again.
 *
 * @param {SerializableLayout} layout - Layout data.
 * @param {Index} family - The family index containing all the people and their relationships.
 * @returns {BrandesKopfLayout} - {@link BrandesKopfLayout} instance.
 */
export function fromSerializableObject(
    layout: SerializableLayoutData & { name: typeof BRANDES_KORF },
    family: Index,
): BrandesKopfLayout {
    return new BrandesKopfLayout(
        family,
        new GraphBuilder(family, layout.data.graph, layout.data.nodes),
    );
}
