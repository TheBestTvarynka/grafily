/**
 * This module builds and modifies the family graph before calculating node positions.
 * When use makes any kind of graph change, for example marriage children collapsing,
 * this module will remove all marriage children nodes from the graph.
 * Or, when the user wants to add new nodes to the graph, this module will add only
 * legal nodes (no edges crossing) to the graph and will put them on the right layers.
 *
 * @module graphBuilder
 */

import { FamilyGraph } from './';
import { Id, NodeType, MARRIAGE_NODE_TYPE, PERSON_NODE_TYPE, personIdToNodeId } from '../';
import { Index, LEFT_SIDE, RIGHT_SIDE, Person, Marriage } from '../../model';

const MIDDLE_SIDE = 'middle_side';

/**
 * During the initial graph building (initial parents expanding), we need to determine
 * where to place the caller child among its siblings. This type represents the side
 * where the caller child should be placed.
 */
type ChildSide = typeof LEFT_SIDE | typeof MIDDLE_SIDE | typeof RIGHT_SIDE;

interface CallerChild {
    side: ChildSide;
    childId: string;
}

interface NodePersons {
    person1?: Person;
    person2?: Person;
}

/**
 * Just an additional information about graph node. It is used for easier graph building and modifying.
 *
 * @property {string} id - node id.
 * @property {NodeType} type - node type.
 * @property {NodePersons} persons - persons associated with the node. For the person node, only `person1` is filled. For the marriage node, both `person1` and `person2` are filled.
 * @property {number} layerNumber - the layer number where the node is located.
 */
export interface GraphNode {
    id: string;
    type: NodeType;
    persons: NodePersons;
    layerNumber: number;
}

/**
 * Node coordinated in the layering matrix.
 *
 * @property {number} layer - the layer index.
 * @property {number} position - the position within the layer.
 */
interface NodeCoordinates {
    layer: number;
    position: number;
}

type Path = number[];

const INF: number = 1_000_000;

const LEFT_PARENT = 'left_parent';
const RIGHT_PARENT = 'right_parent';
const NO_PARENT = 'no_parent';

/**
 * When expanding node parents (parent nodes), we need to determine where to place new nodes:
 * on the left or on the right side of the existing parent node. This type represents the side
 * where the new parent node should be placed. If no parents exist, the new parent node will
 * be placed just above.
 */
type ParentSide = typeof LEFT_PARENT | typeof RIGHT_PARENT | typeof NO_PARENT;

/**
 * A special class for all graph manipulations. It is used to build the initial graph and modify it when the user makes any changes.
 * This implementation does not calculate any nodes positions. Its only purpose is to modify the graph structure and layering.
 */
export class GraphBuilder {
    private nodes = new Map<string, GraphNode>();
    // string - node id.
    // string[] - list of parent node ids.
    private parents = new Map<string, string[]>();
    // string - node id.
    // string[] - list of child node ids.
    private children = new Map<string, string[]>();
    // number - layer index.
    // string[] - list of node ids in the layer.
    private layers: Map<number, string[]> = new Map<number, string[]>();
    private family: Index;

    // WORKAROUND: I could not create a shorted and simpler solution than this. It's not that bad but not aesthetic either.
    // The `nodeToSkip` is used during nodes expanding to point which node we should not expand.
    private nodeToSkip: string | null = null;

    /**
     * Constructs a new instance of the {@link GraphBuilder}.
     *
     * @param {Index} family - The family index containing all the people and their relationships.
     */
    constructor(family: Index, graph?: FamilyGraph, nodes?: Record<string, GraphNode>) {
        if (graph) {
            if (!nodes) {
                throw new Error(
                    'GraphBuilder.constructor: nodes map is not present but family graph is present. they both must present at the same time or be missing',
                );
            }

            this.nodes = new Map(Object.entries(nodes));
            this.parents = new Map(Object.entries(graph.parents));
            this.children = new Map(Object.entries(graph.children));

            const layers = new Map<number, string[]>();
            const firstLayer = graph.firstLayer;
            for (const [index, nodes] of graph.layering.entries()) {
                layers.set(index + firstLayer, nodes);
            }
            this.layers = layers;
        }

        this.family = family;
    }

    /**
     * Builds the family graph.
     *
     * @returns {FamilyGraph} - The family graph built by the builder, containing all nodes, their parents and children, and layering information.
     */
    buildFamilyGraph(): FamilyGraph {
        const firstLayer = Math.min(...this.layers.keys());

        const layering: string[][] = [...this.layers.entries()]
            .sort(([a], [b]) => a - b)
            .map(([_, layer]) => layer);

        return {
            parents: Object.fromEntries(this.parents),
            children: Object.fromEntries(this.children),
            layering,
            firstLayer,
        };
    }

    /**
     * Returns all nodes in the graph.
     *
     * @returns {Map<string, GraphNode>} - All nodes in the graph.
     */
    getNodes(): Map<string, GraphNode> {
        return this.nodes;
    }

    /**
     * Returns a map with every node children ids.
     *
     * @returns {Map<string, string[]>} - All child nodes in the graph.
     */
    getChildren(): Map<string, string[]> {
        return this.children;
    }

    /**
     * Returns a map with every node parents ids.
     *
     * @returns {Map<string, string[]>} - All parent nodes in the graph.
     */
    getParents(): Map<string, string[]> {
        return this.parents;
    }

    /**
     * Returns the parents marriage of the person with the given ID. If the person has no parents, returns null.
     *
     * @param {string} personId - The ID of the person to convert.
     * @returns {Marriage | null} - The parents marriage of the person, or null if the person has no parents.
     */
    personParents(personId: string): Marriage | null {
        const marriageId = this.family.personParents.get(personId);
        if (!marriageId) {
            return null;
        }

        const marriage = this.family.marriageById.get(marriageId);
        if (!marriage) {
            throw new Error(`Marriage ${marriageId} should exist`);
        }

        return marriage;
    }

    /**
     * Builds the initial graph for the given person's perspective. The initial graph contain all parents and children of the given person.
     * Also, siblings of all ancestors and descendants are included in the graph.
     *
     * @param {string} perspectiveId - The ID of the person from whose perspective to build the graph.
     */
    buildInitialGraph(perspectiveId: string) {
        let [id, marriage] = personIdToNodeId(perspectiveId, this.family);

        const layerNumber = 0;

        if (marriage) {
            this.addParents(null, marriage, layerNumber);
            this.addChildren(marriage, layerNumber + 1);
        } else {
            const parents = this.personParents(id.id);
            if (parents) {
                this.addParents({ side: MIDDLE_SIDE, childId: id.id }, parents, -1);
            } else {
                if (!this.layers.has(layerNumber)) {
                    this.layers.set(layerNumber, []);
                }
                // SAFE: if the layer does not exist, we will create it above.
                const layer = this.layers.get(layerNumber)!;
                layer.push(id.id);
                this.nodes.set(id.id, {
                    id: id.id,
                    type: PERSON_NODE_TYPE,
                    persons: {
                        person1: this.family.personById.get(id.id)!,
                    },
                    layerNumber,
                });
            }
        }
    }

    private addChildren(parentsMarriage: Marriage, childrenLayerNumber: number) {
        if (!parentsMarriage.childrenIds.length) {
            return;
        }

        if (!this.layers.get(childrenLayerNumber)) {
            this.layers.set(childrenLayerNumber, []);
        }
        const layer = this.layers.get(childrenLayerNumber)!;

        if (!this.children.has(parentsMarriage.id)) {
            this.children.set(parentsMarriage.id, []);
        }
        const children = this.children.get(parentsMarriage.id)!;

        for (const childId of parentsMarriage.childrenIds) {
            const [id, marriage] = personIdToNodeId(childId, this.family);

            const persons: NodePersons = {};
            if (marriage) {
                if (marriage.parent1Id) {
                    persons.person1 = this.family.personById.get(marriage.parent1Id)!;
                }
                if (marriage.parent2Id) {
                    persons.person2 = this.family.personById.get(marriage.parent2Id)!;
                }
            } else {
                persons.person1 = this.family.personById.get(id.id)!;
            }
            this.nodes.set(id.id, {
                id: id.id,
                type: id.type,
                persons,
                layerNumber: childrenLayerNumber,
            });

            if (!this.parents.has(id.id)) {
                this.parents.set(id.id, []);
            }
            const parents = this.parents.get(id.id)!;

            parents.push(parentsMarriage.id);
            children.push(id.id);
            layer.push(id.id);

            if (marriage) {
                this.addChildren(marriage, childrenLayerNumber + 1);
            }
        }
    }

    private addParents(caller: CallerChild | null, marriage: Marriage, layerNumber: number) {
        const id = marriage.id;

        let p1ParentsExist = false;
        let p2ParentsExist = false;
        if (marriage.parent1Id) {
            let p1Parents = this.personParents(marriage.parent1Id);

            if (p1Parents) {
                p1ParentsExist = true;
                let side: ChildSide;
                if (marriage.parent2Id && this.personParents(marriage.parent2Id)) {
                    side = RIGHT_SIDE;
                } else {
                    side = MIDDLE_SIDE;
                }

                this.addParents({ side, childId: marriage.parent1Id }, p1Parents, layerNumber - 1);
            }
        }

        if (marriage.parent2Id) {
            let p2Parents = this.personParents(marriage.parent2Id);

            if (p2Parents) {
                if (p1ParentsExist) {
                    const layer = this.layers.get(layerNumber)!;
                    layer.pop();
                }

                p2ParentsExist = true;
                let side: ChildSide;
                if (marriage.parent1Id && this.personParents(marriage.parent1Id)) {
                    side = LEFT_SIDE;
                } else {
                    side = MIDDLE_SIDE;
                }

                this.addParents({ side, childId: marriage.parent2Id }, p2Parents, layerNumber - 1);
            }
        }

        if (!this.layers.has(layerNumber)) {
            this.layers.set(layerNumber, []);
        }
        // SAFE: if the layer does not exist, we will create it above.
        const layer = this.layers.get(layerNumber)!;
        if (!p1ParentsExist && !p2ParentsExist) {
            layer.push(id);
            this.nodes.set(id, {
                id,
                type: MARRIAGE_NODE_TYPE,
                persons: {
                    person1: marriage.parent1Id
                        ? this.family.personById.get(marriage.parent1Id)!
                        : undefined,
                    person2: marriage.parent2Id
                        ? this.family.personById.get(marriage.parent2Id)!
                        : undefined,
                },
                layerNumber,
            });
        }

        if (caller) {
            if (!this.layers.has(layerNumber + 1)) {
                this.layers.set(layerNumber + 1, []);
            }
            // SAFE: if the layer does not exist, we will create it above.
            const childrenLayer = this.layers.get(layerNumber + 1)!;

            if (!this.children.get(id)) {
                this.children.set(id, []);
            }
            // SAFE: if the children of the marriage does not exist, we will initialize it above.
            const children = this.children.get(id)!;

            const childrenIds = marriage.childrenIds.filter(
                (childId) => childId !== caller.childId,
            );
            if (caller.side === LEFT_SIDE) {
                childrenIds.splice(0, 0, caller.childId);
            } else if (caller.side === RIGHT_SIDE) {
                childrenIds.push(caller.childId);
            } else {
                childrenIds.splice(Math.ceil(childrenIds.length / 2), 0, caller.childId);
            }

            for (const childId of childrenIds) {
                const [childNodeId, childMarriage] = personIdToNodeId(childId, this.family);
                childrenLayer.push(childNodeId.id);

                const persons: NodePersons =
                    childNodeId.type === MARRIAGE_NODE_TYPE
                        ? {
                              person1: childMarriage!.parent1Id
                                  ? this.family.personById.get(childMarriage!.parent1Id)!
                                  : undefined,
                              person2: childMarriage!.parent2Id
                                  ? this.family.personById.get(childMarriage!.parent2Id)!
                                  : undefined,
                          }
                        : { person1: this.family.personById.get(childNodeId.id)! };
                this.nodes.set(childNodeId.id, {
                    id: childNodeId.id,
                    type: childNodeId.type,
                    persons,
                    layerNumber: layerNumber + 1,
                });

                children.push(childNodeId.id);

                if (!this.parents.get(childNodeId.id)) {
                    this.parents.set(childNodeId.id, []);
                }
                const childParents = this.parents.get(childNodeId.id)!;
                childParents.push(id);
            }
        }
    }

    /**
     * Returns the coordinates of the node with the given id in the layering matrix.
     *
     * @param {string} nodeId - The node id.
     * @returns {NodeCoordinates} - The coordinates of the node in the layering matrix.
     */
    private getNodeCoordinates(nodeId: string): NodeCoordinates {
        for (const [index, layer] of this.layers.entries()) {
            const nodeIndex = layer.indexOf(nodeId);
            if (nodeIndex !== -1) {
                return { layer: index, position: nodeIndex };
            }
        }

        throw new Error(`Node ${nodeId} should be in layers`);
    }

    // `left` - left neighbor node coordinates.
    // `right` - right neighbor node coordinates.
    private findMaxDepth(
        lastLeftNeighbor: string,
        lastRightNeighbor: string,
        path: Path,
        getBranches: (nodeId: string) => string[],
    ): number {
        const leftNeighbor = getBranches(lastLeftNeighbor).last();
        if (!leftNeighbor) {
            throw new Error(`Left neighbor ${leftNeighbor} should have at least one parent`);
        }

        const rightNeighbor = getBranches(lastRightNeighbor).first();
        if (!rightNeighbor) {
            throw new Error(`Right neighbor ${rightNeighbor} should have at least one parent`);
        }

        const leftCoordinates = this.getNodeCoordinates(leftNeighbor);

        const layer = leftCoordinates.layer;
        const currentLayer = this.layers.get(layer);
        if (!currentLayer) {
            throw new Error(`Layer ${layer} should exist`);
        }

        let leftPosition = leftCoordinates.position;
        let left: NodeCoordinates | null = null;
        let leftId: string | null = null;

        while (leftPosition >= 0) {
            const leftNeighborId = currentLayer[leftPosition];
            if (!leftNeighborId) {
                throw new Error(`Node at layer ${layer} and position ${leftPosition} should exist`);
            }

            const leftParents = getBranches(leftNeighborId);

            if (leftParents.length > 0) {
                left = { position: leftPosition, layer };
                leftId = leftNeighborId;
                break;
            } else {
                leftPosition -= 1;
            }
        }

        if (!left || !leftId) {
            // Passed `lastLeftNeighbor` and `lastRightNeighbor` are not in the path yet.
            path.push(leftCoordinates.position + 1);

            path.push(0);

            return INF;
        }

        const rightCoordinates = this.getNodeCoordinates(rightNeighbor);

        let rightPosition = rightCoordinates.position;
        let right: NodeCoordinates | null = null;
        let rightId: string | null = null;

        while (rightPosition < currentLayer.length) {
            const rightNeighborId = currentLayer[rightPosition];
            if (!rightNeighborId) {
                throw new Error(
                    `Node at layer ${layer} and position ${rightPosition} should exist`,
                );
            }

            const rightParents = getBranches(rightNeighborId);

            if (rightParents.length > 0) {
                right = { position: rightPosition, layer };
                rightId = rightNeighborId;
                break;
            } else {
                rightPosition += 1;
            }
        }

        if (!right || !rightId) {
            // Passed `lastLeftNeighbor` and `lastRightNeighbor` are not in the path yet.
            path.push(leftCoordinates.position + 1);

            path.push(INF);

            return INF;
        }

        const leftIndex = left.position;
        const rightIndex = right.position;

        if (leftIndex === rightIndex) {
            return 0;
        } else if (rightIndex - leftIndex === 1) {
            path.push(leftIndex + 1);

            return this.findMaxDepth(leftId, rightId, path, getBranches) + 1;
        } else {
            let maxDepth = 0;
            let maxPath: Path = [];

            for (
                let leftCandidateIndex = leftIndex;
                leftCandidateIndex < rightIndex;
                leftCandidateIndex++
            ) {
                const leftCandidate = currentLayer[leftCandidateIndex];
                if (!leftCandidate) {
                    throw new Error(
                        `Node at layer ${layer} and position ${leftCandidateIndex} should exist`,
                    );
                }

                const rightCandidate = currentLayer[leftCandidateIndex + 1];
                if (!rightCandidate) {
                    throw new Error(
                        `Node at layer ${layer} and position ${
                            leftCandidateIndex + 1
                        } should exist`,
                    );
                }

                const candidatePath: Path = [leftCandidateIndex];

                const depth = this.findMaxDepth(
                    leftCandidate,
                    rightCandidate,
                    candidatePath,
                    getBranches,
                );

                if (depth > maxDepth) {
                    maxDepth = depth;
                    maxPath = candidatePath;

                    if (depth === INF) {
                        break;
                    }
                }
            }

            path.push(...maxPath);

            return maxDepth + 1;
        }
    }

    private getChildrenNodesIds(id: Id): [Id[], ParentSide] {
        if (id.type === PERSON_NODE_TYPE) {
            // Current node is a person node. It has no children.
            return [[], NO_PARENT];
        } else {
            const marriage = this.family.marriageById.get(id.id);
            if (!marriage) {
                throw new Error(`Marriage ${id.id} should exist`);
            }

            const childrenIds: Id[] = marriage.childrenIds.map((childId) => {
                const childMarriages = this.family.personMarriages.get(childId) ?? [];

                if (childMarriages.length > 0) {
                    const marriageId = childMarriages[0]!;

                    return {
                        type: MARRIAGE_NODE_TYPE,
                        id: marriageId.id,
                    };
                } else {
                    return {
                        type: PERSON_NODE_TYPE,
                        id: childId,
                    };
                }
            });

            return [childrenIds, NO_PARENT];
        }
    }

    private getParentNodesIds(id: Id): [Id[], ParentSide] {
        if (id.type === PERSON_NODE_TYPE) {
            // Current node is a person node. Only one parent node is possible: parents of this person.

            const marriageId = this.family.personParents.get(id.id);
            if (!marriageId) {
                return [[], NO_PARENT];
            }

            const marriage = this.family.marriageById.get(marriageId);
            if (!marriage) {
                throw new Error(`Marriage ${id.id} should exist`);
            }

            return [
                [
                    {
                        type: MARRIAGE_NODE_TYPE,
                        id: marriage.id,
                    },
                ],
                NO_PARENT,
            ];
        } else {
            const existingParents = this.parents.get(id.id) ?? [];

            const marriage = this.family.marriageById.get(id.id);
            if (!marriage) {
                throw new Error(`Marriage ${id.id} should exist`);
            }

            const parentsIds: Id[] = [];
            let parentSide: ParentSide = NO_PARENT;

            if (marriage.parent1Id) {
                const parentsMarriage = this.family.personParents.get(marriage.parent1Id);
                if (parentsMarriage && parentsMarriage !== this.nodeToSkip) {
                    const marriage = this.family.marriageById.get(parentsMarriage);
                    if (!marriage) {
                        throw new Error(`Marriage ${parentsMarriage} should exist`);
                    }

                    if (!existingParents.includes(marriage.id)) {
                        parentsIds.push({
                            type: MARRIAGE_NODE_TYPE,
                            id: marriage.id,
                        });
                    } else {
                        parentSide = LEFT_PARENT;
                    }
                }
            }

            if (marriage.parent2Id) {
                const parentsMarriage = this.family.personParents.get(marriage.parent2Id);
                if (parentsMarriage && parentsMarriage !== this.nodeToSkip) {
                    const marriage = this.family.marriageById.get(parentsMarriage);
                    if (!marriage) {
                        throw new Error(`Marriage ${parentsMarriage} should exist`);
                    }

                    if (!existingParents.includes(marriage.id)) {
                        parentsIds.push({
                            type: MARRIAGE_NODE_TYPE,
                            id: marriage.id,
                        });
                    } else {
                        parentSide = RIGHT_PARENT;
                    }
                }
            }

            return [parentsIds, parentSide];
        }
    }

    private addNodesByPath(
        path: Path,
        nodeId: Id,
        getBranches: (nodeId: string) => string[],
        setBranches: (nodeId: string, branches: string[]) => void,
        setRedirectedBranches: (nodeId: string, branches: string[]) => void,
        findChildNodes: (id: Id) => [Id[], ParentSide],
        getNextLayer: (layer: number) => number,
    ) {
        const addNodes = (nextLayerPosition: number, layer: number, currentNodes: Id[]): Id[] => {
            const nextLayer = this.layers.get(layer)!;

            const newCurrentNodes: Id[] = [];

            for (const currentNode of currentNodes) {
                const [parentNodes, parentSide] = findChildNodes(currentNode);

                nextLayer.splice(nextLayerPosition, 0, ...parentNodes.map((node) => node.id));
                nextLayerPosition += parentNodes.length;

                const parents = getBranches(currentNode.id);
                if (parentSide === LEFT_PARENT) {
                    setBranches(currentNode.id, [
                        ...parents,
                        ...parentNodes.map((node) => node.id),
                    ]);
                } else if (parentSide === RIGHT_PARENT) {
                    setBranches(currentNode.id, [
                        ...parentNodes.map((node) => node.id),
                        ...parents,
                    ]);
                } else {
                    setBranches(
                        currentNode.id,
                        parentNodes.map((node) => node.id),
                    );
                }

                for (const parentNode of parentNodes) {
                    let node: GraphNode;

                    if (parentNode.type === PERSON_NODE_TYPE) {
                        node = {
                            id: parentNode.id,
                            type: PERSON_NODE_TYPE,
                            persons: {
                                person1: this.family.personById.get(parentNode.id)!,
                            },
                            layerNumber: getNextLayer(currentLayer),
                        };
                    } else {
                        const marriage = this.family.marriageById.get(parentNode.id);
                        if (!marriage) {
                            throw new Error(`Marriage ${parentNode.id} should exist`);
                        }

                        let person1: Person | undefined;
                        if (marriage.parent1Id) {
                            person1 = this.family.personById.get(marriage.parent1Id)!;
                        }

                        let person2: Person | undefined;
                        if (marriage.parent2Id) {
                            person2 = this.family.personById.get(marriage.parent2Id)!;
                        }

                        node = {
                            id: parentNode.id,
                            type: MARRIAGE_NODE_TYPE,
                            persons: {
                                person1,
                                person2,
                            },
                            layerNumber: getNextLayer(currentLayer),
                        };
                    }

                    this.nodes.set(parentNode.id, node);

                    setRedirectedBranches(parentNode.id, [currentNode.id]);
                }

                newCurrentNodes.push(...parentNodes);
            }

            return newCurrentNodes;
        };

        const { layer } = this.getNodeCoordinates(nodeId.id);

        let currentNodes: Id[] = [nodeId];
        let currentLayer = layer;

        for (let position of path) {
            const nextLayerNumber = getNextLayer(currentLayer);
            const nextLayer = this.layers.get(nextLayerNumber);
            if (!nextLayer) {
                this.layers.set(nextLayerNumber, []);
            }

            if (position === 0) {
                path.push(0);
            } else if (position >= INF) {
                // SAFE: Initialized above.
                const nextLayer = this.layers.get(nextLayerNumber)!;

                position = nextLayer.length;

                const granLayer = this.layers.get(getNextLayer(nextLayerNumber));
                if (!granLayer) {
                    path.push(0);
                } else {
                    path.push(INF);
                }
            }

            currentNodes = addNodes(position, nextLayerNumber, currentNodes);

            currentLayer = nextLayerNumber;

            if (currentNodes.length === 0) {
                break;
            }
        }
    }

    /**
     * Adds parents of the person with the given ID to the graph. If the person has no parents, does nothing.
     *
     * @param {string} personId - The ID of the person whose parents we want to add to the graph.
     */
    addParentsOf(personId: string) {
        const [nodeId, marriage] = personIdToNodeId(personId, this.family);

        let left: string | null = null;
        let right: string | null = null;
        this.nodeToSkip = null;

        const { layer, position } = this.getNodeCoordinates(nodeId.id);
        const currentLayer = this.layers.get(layer);
        if (!currentLayer) {
            throw new Error(`Layer ${layer} should exist`);
        }

        const nodeParents = this.parents.get(nodeId.id);
        if (nodeParents && nodeParents.length > 0) {
            // The `nodeId` node already has at least one parent. We must calculate left and right boundaries including the existing parents nodes.
            if (nodeId.type === PERSON_NODE_TYPE) {
                // The PERSON_NODE_TYPE node can have only one parent node. So, if it already has a parent, then we have nothing to do.
                console.warn(
                    `Something weird happens here: trying to expand parents of a person node ${nodeId.id}, but it already has parents.`,
                );
                return;
            } else {
                // One of the marriage parents (parents of wife or parents of husband) are already expanded.
                if (marriage?.parent1Id === personId) {
                    // Parents of `marriage.parent2Id` are already expanded. So, the right boundary is the position of the current node, and the left boundary is the position of the left neighbor of the current node (if exists).
                    right = nodeId.id;

                    let leftPosition = position - 1;

                    while (leftPosition >= 0) {
                        const leftCandidate = currentLayer[leftPosition];
                        if (!leftCandidate) {
                            throw new Error(
                                `Node at layer ${layer} and position ${leftPosition} should exist`,
                            );
                        }

                        const leftCandidateParents = this.parents.get(leftCandidate) ?? [];

                        if (leftCandidateParents.length > 0) {
                            left = leftCandidate;
                            break;
                        } else {
                            leftPosition -= 1;
                        }
                    }
                } else if (marriage?.parent2Id === personId) {
                    // Parents of `marriage.parent1Id` are already expanded. So, the left boundary is the position of the current node, and the right boundary is the position of the right neighbor of the current node (if exists).
                    left = nodeId.id;

                    let rightPosition = position + 1;

                    while (rightPosition < currentLayer.length) {
                        const rightCandidate = currentLayer[rightPosition];
                        if (!rightCandidate) {
                            throw new Error(
                                `Node at layer ${layer} and position ${rightPosition} should exist`,
                            );
                        }

                        const rightCandidateParents = this.parents.get(rightCandidate) ?? [];

                        if (rightCandidateParents.length > 0) {
                            right = rightCandidate;
                            break;
                        } else {
                            rightPosition += 1;
                        }
                    }
                } else {
                    throw new Error(
                        'This should not happen: the person should be either parent1 or parent2 of the marriage node',
                    );
                }
            }
        } else {
            if (nodeId.type === MARRIAGE_NODE_TYPE) {
                // When we expand parents of a person from the marriage, we need to expand only one of the parents.
                // Here we determine what node to skip during expansion.
                let nodeToSkipId: string | undefined = undefined;

                if (marriage?.parent1Id === personId) {
                    nodeToSkipId = marriage.parent2Id
                        ? this.family.personParents.get(marriage.parent2Id)
                        : undefined;
                } else if (marriage?.parent2Id === personId) {
                    nodeToSkipId = marriage.parent1Id
                        ? this.family.personParents.get(marriage.parent1Id)
                        : undefined;
                } else {
                    console.warn(
                        `Warn: corrupted data: the ${personId} should be either parent1 or parent2 of the marriage node(${marriage?.id})`,
                    );
                }

                if (nodeToSkipId) {
                    this.nodeToSkip = nodeToSkipId;
                }
            }

            let leftPosition = position - 1;

            while (leftPosition >= 0) {
                const leftCandidate = currentLayer[leftPosition];
                if (!leftCandidate) {
                    throw new Error(
                        `Node at layer ${layer} and position ${leftPosition} should exist`,
                    );
                }

                const leftCandidateParents = this.parents.get(leftCandidate) ?? [];

                if (leftCandidateParents.length > 0) {
                    left = leftCandidate;
                    break;
                } else {
                    leftPosition -= 1;
                }
            }

            let rightPosition = position + 1;

            while (rightPosition < currentLayer.length) {
                const rightCandidate = currentLayer[rightPosition];
                if (!rightCandidate) {
                    throw new Error(
                        `Node at layer ${layer} and position ${rightPosition} should exist`,
                    );
                }

                const rightCandidateParents = this.parents.get(rightCandidate) ?? [];

                if (rightCandidateParents.length > 0) {
                    right = rightCandidate;
                    break;
                } else {
                    rightPosition += 1;
                }
            }
        }

        const path: Path = [];

        const getBranches = (nodeId: string) => this.parents.get(nodeId) ?? [];
        const setBranches = (nodeId: string, branches: string[]) =>
            this.parents.set(nodeId, branches);
        const setRedirectedBranches = (nodeId: string, branches: string[]) =>
            this.children.set(nodeId, branches);
        const findChildNodes = (id: Id) => this.getParentNodesIds(id);
        const nextLayer = (layer: number) => layer - 1;

        if (!left) {
            // If the person node does not have left neighbor, then this node is the leftmost node in the level.
            // So, parent nodes can be placed at the start of the above layers.
            path.push(0);
        } else if (!right) {
            // If the person node does not have right neighbor, then this node is the rightmost node in the level.
            // So, parent nodes can be placed at the end of the above layers.
            path.push(INF);
        } else {
            this.findMaxDepth(left, right, path, getBranches);
        }

        this.addNodesByPath(
            path,
            nodeId,
            getBranches,
            setBranches,
            setRedirectedBranches,
            findChildNodes,
            nextLayer,
        );
    }

    /**
     * Adds children of the marriage with the given ID to the graph.
     *
     * @param {string} id - The ID of the marriage whose children we want to add to the graph.
     */
    addChildrenOf(id: string) {
        // It should be impossible to call this method on the PERSON_NODE_TYPE.
        // Only marriage nodes should have children nodes and UI button for expanding/collapsing them.
        const nodeId: Id = {
            type: MARRIAGE_NODE_TYPE,
            id,
        };

        let left: string | null = null;
        let right: string | null = null;
        this.nodeToSkip = null;

        const { layer, position } = this.getNodeCoordinates(nodeId.id);
        const currentLayer = this.layers.get(layer);
        if (!currentLayer) {
            throw new Error(`Layer ${layer} should exist`);
        }

        let leftPosition = position - 1;

        while (leftPosition >= 0) {
            const leftCandidate = currentLayer[leftPosition];
            if (!leftCandidate) {
                throw new Error(`Node at layer ${layer} and position ${leftPosition} should exist`);
            }

            const leftCandidateParents = this.children.get(leftCandidate) ?? [];

            if (leftCandidateParents.length > 0) {
                left = leftCandidate;
                break;
            } else {
                leftPosition -= 1;
            }
        }

        let rightPosition = position + 1;

        while (rightPosition < currentLayer.length) {
            const rightCandidate = currentLayer[rightPosition];
            if (!rightCandidate) {
                throw new Error(
                    `Node at layer ${layer} and position ${rightPosition} should exist`,
                );
            }

            const rightCandidateParents = this.children.get(rightCandidate) ?? [];

            if (rightCandidateParents.length > 0) {
                right = rightCandidate;
                break;
            } else {
                rightPosition += 1;
            }
        }

        const path: Path = [];

        const getBranches = (nodeId: string) => this.children.get(nodeId) ?? [];
        const setBranches = (nodeId: string, branches: string[]) => {
            if (branches.length === 0) {
                return;
            }

            this.children.set(nodeId, branches);
        };
        const setRedirectedBranches = (nodeId: string, branches: string[]) => {
            if (branches.length === 0) {
                return;
            }

            this.parents.set(nodeId, branches);
        };
        const findChildNodes = (id: Id) => this.getChildrenNodesIds(id);
        const nextLayer = (layer: number) => layer + 1;

        if (!left) {
            // If the person node does not have left neighbor, then this node is the leftmost node in the level.
            // So, children nodes can be placed at the start of the below layers.
            path.push(0);
        } else if (!right) {
            // If the person node does not have right neighbor, then this node is the rightmost node in the level.
            // So, children nodes can be placed at the end of the below layers.
            path.push(INF);
        } else {
            this.findMaxDepth(left, right, path, getBranches);
        }

        this.addNodesByPath(
            path,
            nodeId,
            getBranches,
            setBranches,
            setRedirectedBranches,
            findChildNodes,
            nextLayer,
        );
    }

    /**
     * Removes children of the node (marriage) with the given ID from the graph.
     *
     * @param {string} nodeId - The ID of the marriage whose children we want to remove from the graph.
     * @param {string} except - The ID of the child node to exclude from removal.
     */
    removeChildrenOf(nodeId: string, except: string = '') {
        const children = this.children.get(nodeId);
        if (!children) {
            return;
        }

        for (const childId of children) {
            if (childId === except) {
                continue;
            }

            const childNode = this.nodes.get(childId);
            if (!childNode) {
                throw new Error(`Child node ${childId} should exist`);
            }
            // Remove children of children recursively.
            this.removeChildrenOf(childId);

            const parents = this.parents.get(childId);
            if (parents) {
                this.removeParentsOf(childId, nodeId);
            }

            // Remove child from the layering matrix.
            const childLayer = this.layers.get(childNode.layerNumber);
            if (!childLayer) {
                throw new Error(`Layer ${childNode.layerNumber} should exist`);
            }
            const index = childLayer.indexOf(childId);
            if (index === -1) {
                throw new Error(`Child ${childId} should be in layer ${childNode.layerNumber}`);
            }
            childLayer.splice(index, 1);

            this.nodes.delete(childId);
        }

        const exceptChildIndex = children.indexOf(except);
        if (exceptChildIndex !== -1) {
            this.children.set(
                nodeId,
                children.filter((childrenId) => childrenId === except),
            );
        } else {
            this.children.delete(nodeId);
        }
    }

    /**
     * Removes parents of the person with the given ID from the graph.
     *
     * @param {string} nodeId - The ID of the node whose parents we want to remove from the graph.
     * @param {string} except - The ID of the person to exclude from removal.
     */
    removeParentsOf(nodeId: string, except: string = '') {
        const parents = this.parents.get(nodeId);

        if (!parents) {
            return;
        }

        for (const parentId of parents) {
            if (parentId === except) {
                continue;
            }

            const parentNode = this.nodes.get(parentId);
            if (!parentNode) {
                throw new Error(`removeParentsOf: Parent node ${parentId} should exist`);
            }
            this.removeParentsOf(parentId);

            const parentChildren = this.children.get(parentId);
            if (parentChildren) {
                this.removeChildrenOf(parentId, nodeId);
            }

            // Remove parent from the layering matrix.
            const parentLayer = this.layers.get(parentNode.layerNumber);
            if (!parentLayer) {
                throw new Error(`Layer ${parentNode.layerNumber} should exist`);
            }
            const index = parentLayer.indexOf(parentId);
            if (index === -1) {
                throw new Error(`Parent ${parentId} should be in layer ${parentNode.layerNumber}`);
            }
            parentLayer.splice(index, 1);

            this.nodes.delete(parentId);
        }

        const exceptParentIndex = parents.indexOf(except);
        if (exceptParentIndex !== -1) {
            this.parents.set(
                nodeId,
                parents.filter((parentId) => parentId === except),
            );
        } else {
            this.parents.delete(nodeId);
        }
    }
}
