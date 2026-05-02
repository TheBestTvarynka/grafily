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
    PERSON_NODE_TYPE,
    SerializableLayout,
    personIdToNodeId,
} from '../';
import { Index, LEFT_SIDE, RIGHT_SIDE } from '../../model';
import { positionX, positionY } from './brandesKopf';
import { GraphBuilder } from './graphBuilder';

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
                nodes.push({
                    id,
                    data: {
                        id,
                        isChildrenCollapsible: true,
                        isChildrenCollapsed: isChildrenCollapsed(id),
                    },
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
                    node.persons.person1.marriageNodeSide = RIGHT_SIDE;
                    node.persons.person1.isParentsCollapsible = true;
                    node.persons.person1.isParentsCollapsed = isParentsCollapsed(
                        node.persons.person1.id,
                    );

                    nodes.push({
                        id: node.persons.person1.id,
                        data: {
                            id: node.persons.person1.id,
                            side: node.persons.person1.marriageNodeSide,
                        },
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
                        id: id + '-to-' + node.persons.person1.id,
                        target: node.persons.person1.id,
                        source: id,
                        sourceHandle: 'left',
                        targetHandle: 'right',
                    });
                }

                if (node.persons.person2) {
                    node.persons.person2.marriageNodeSide = LEFT_SIDE;
                    node.persons.person2.isParentsCollapsible = true;
                    node.persons.person2.isParentsCollapsed = isParentsCollapsed(
                        node.persons.person2.id,
                    );

                    nodes.push({
                        id: node.persons.person2.id,
                        data: {
                            id: node.persons.person2.id,
                            side: node.persons.person2.marriageNodeSide,
                        },
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
                        id: id + '-to-' + node.persons.person2.id,
                        target: node.persons.person2.id,
                        source: id,
                        sourceHandle: 'right',
                        targetHandle: 'left',
                    });
                }
            }
            if (node.type === PERSON_NODE_TYPE) {
                node.persons.person1!.isParentsCollapsible = true;
                node.persons.person1!.isParentsCollapsed = false;

                nodes.push({
                    id,
                    data: {
                        id: node.persons.person1!.id,
                        side: node.persons.person1!.marriageNodeSide,
                    },
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
        const person = this.family.personById.get(personId);
        if (person) {
            person.isParentsCollapsed = true;
        } else {
            console.warn(`Person ${personId} not found in the family index`);
        }

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

    toSerializableObject(): SerializableLayout {
        return {
            name: BRANDES_KORF,
            data: {
                graph: this.graph.buildFamilyGraph(),
                nodes: this.graph.getNodes(),
            },
        };
    }
}

export function fromSerializableObject(
    layout: SerializableLayout,
    family: Index,
): BrandesKopfLayout {
    if (layout.name !== BRANDES_KORF) {
        throw new Error(`Invalid layout name: ${layout.name}. Expected: ${BRANDES_KORF}`);
    }

    return new BrandesKopfLayout(
        family,
        new GraphBuilder(family, layout.data.graph as FamilyGraph, layout.data.nodes),
    );
}
