import { Edge, Node } from '@xyflow/react';

import {
    MARRIAGE_GAP,
    MARRIAGE_NODE_SIZE,
    MARRIAGE_NODE_TYPE,
    MARRIAGE_WIDTH,
    NODES_GAP,
    NODE_HEIGHT,
    NODE_WIDTH,
    PERSON_NODE_TYPE,
} from '../';
import { Index, LEFT_SIDE, RIGHT_SIDE } from '../../model';
import { positionX, positionY } from './brandesKopf';
import { GraphBuilder } from './graphBuilder';

export interface FamilyGraph {
    /** parents[nodeId] = array of parent node ids */
    parents: Map<string, string[]>;
    /** children[nodeId] = array of child node ids */
    children: Map<string, string[]>;
    /**
     * layering[level][order] = nodeId
     * e.g. layering[0] is the list of node ids in the first (top) layer,
     * sorted by their `order` value.
     */
    layering: string[][];
}

export class BrandesKopfLayout {
    family: Index;
    graph: GraphBuilder;

    constructor(family: Index) {
        this.family = family;
        this.graph = new GraphBuilder(family);
    }

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
                        data: { person: node.persons.person1 },
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
                        data: { person: node.persons.person2 },
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
                    data: { person: node.persons.person1! },
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

    buildNodes(perspectiveId: string): [Node[], Edge[]] {
        this.graph = new GraphBuilder(this.family);
        this.graph.buildInitialGraph(perspectiveId);

        return this.buildNodesInternal();
    }

    collapseChildren(nodeId: string): [Node[], Edge[]] {
        this.graph.removeChildrenOf(nodeId);

        return this.buildNodesInternal();
    }

    collapseParents(personId: string): [Node[], Edge[]] {
        const [nodeId] = this.graph.personIdToNodeId(personId);

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

    expandChildren(nodeId: string): [Node[], Edge[]] {
        this.graph.addChildrenOf(nodeId);

        return this.buildNodesInternal();
    }

    expandParents(personId: string): [Node[], Edge[]] {
        this.graph.addParentsOf(personId);

        return this.buildNodesInternal();
    }
}
