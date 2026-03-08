import { Edge, Node } from '@xyflow/react';

import {
    Id,
    MARRIAGE_GAP,
    MARRIAGE_NODE_SIZE,
    MARRIAGE_NODE_TYPE,
    MARRIAGE_TYPE,
    MARRIAGE_WIDTH,
    NODES_GAP,
    NODE_HEIGHT,
    NODE_WIDTH,
    NodeType,
    PERSON_NODE_TYPE,
    PERSON_TYPE,
} from './index';
import { Index, LEFT_SIDE, RIGHT_SIDE, Person, Marriage } from '../model';

interface FamilyGraph {
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

/**
 * Aligns nodes into vertical "blocks" by trying to align each node with the
 * median of its neighbours in the adjacent layer.
 *
 * `neighborFn` should return the predecessors (when sweeping top→bottom) or
 * successors (bottom→top) of a node.
 *
 * Returns `{ root, align }` maps:
 *  - root[v]  = the topmost node in v's block.
 *  - align[v] = the next node below v in the same block (or v itself for the
 *               bottom of the block).
 */
function verticalAlignment(
    layering: string[][],
    neighborFn: (v: string) => string[],
): { root: Record<string, string>; align: Record<string, string> } {
    const root: Record<string, string> = {};
    const align: Record<string, string> = {};
    const pos: Record<string, number> = {}; // position (order) within layer

    // Initialise: every node is its own block
    for (const layer of layering) {
        layer.forEach((v, order) => {
            root[v] = v;
            align[v] = v;
            pos[v] = order;
        });
    }

    for (const layer of layering) {
        let prevIdx = -1; // largest neighbour position processed so far

        for (const v of layer) {
            let ws = neighborFn(v);

            if (ws.length > 0) {
                // Sort neighbours by their position in the previous layer
                ws = ws.slice().sort((a, b) => {
                    const posA = pos[a];
                    const posB = pos[b];

                    if (posA === undefined || posB === undefined) {
                        throw new Error(`Node ${posA} or ${posB} is initialized`);
                    }

                    return posA - posB;
                });

                const mp = (ws.length - 1) / 2;
                // Iterate over the (up-to-two) median neighbours
                for (let i = Math.floor(mp), il = Math.ceil(mp); i <= il; ++i) {
                    const w = ws[i];
                    if (w === undefined) {
                        throw new Error(`Node ${w} in ws array is not initialized`);
                    }
                    if (pos[w] === undefined) {
                        throw new Error(`Node ${w} pos is not initialized`);
                    }
                    if (root[w] === undefined) {
                        throw new Error(`Node ${w} root is not initialized`);
                    }

                    if (align[v] === v && prevIdx < pos[w]) {
                        align[w] = v;
                        align[v] = root[v] = root[w];
                        prevIdx = pos[w];
                    }
                }
            }
        }
    }

    return { root, align };
}

/**
 * Assigns x coordinates by:
 *  1. Building a "block graph" where each block's root is a node and edges
 *     carry the minimum required separation between adjacent roots in a layer.
 *  2. Two sweeps over the block graph (left→right then right→left) to assign
 *     the tightest valid coordinates.
 *
 * `nodeWidth`   – width of each node (can be per-node or a fixed value).
 * `nodeSep`     – minimum horizontal gap between nodes.
 * `reverseSep`  – when true, coordinates are assigned right→left (used for
 *                 the two right-biased alignments).
 */
function horizontalCompaction(
    layering: string[][],
    root: Record<string, string>,
    align: Record<string, string>,
    nodeWidth: (v: string) => number,
    nodeSep: number,
    reverseSep: boolean,
): Record<string, number> {
    // --- build block graph ---------------------------------------------------
    // Nodes in the block graph are the block roots.
    // An edge root(u) → root(v) carries the minimum distance between them.

    // adjacency for block graph: predecessors and successors
    const blockSucc: Record<string, Set<string>> = {};
    const blockPred: Record<string, Set<string>> = {};
    const blockEdgeWeight: Record<string, Record<string, number>> = {};

    function ensureBlock(bid: string) {
        if (!blockSucc[bid]) blockSucc[bid] = new Set();
        if (!blockPred[bid]) blockPred[bid] = new Set();
        if (!blockEdgeWeight[bid]) blockEdgeWeight[bid] = {};
    }

    for (const layer of layering) {
        let prevV: string | undefined;
        for (const v of layer) {
            const vRoot = root[v];
            if (!vRoot) {
                throw new Error(`vRoot ${v} must be initialized`);
            }

            ensureBlock(vRoot);
            if (prevV !== undefined) {
                const uRoot = root[prevV];
                if (!uRoot) {
                    throw new Error(`Node ${prevV} root is not initialized`);
                }
                // Minimum separation between adjacent nodes in the same layer
                const sep = nodeWidth(prevV) / 2 + nodeSep + nodeWidth(v) / 2;

                const prev = (blockEdgeWeight[uRoot] as Record<string, number>)[vRoot] ?? 0;
                (blockEdgeWeight[uRoot] as Record<string, number>)[vRoot] = Math.max(sep, prev);
                (blockSucc[uRoot] as Set<string>).add(vRoot);
                (blockPred[vRoot] as Set<string>).add(uRoot);
            }
            prevV = v;
        }
    }

    // --- iterative topo traversal (DFS-based, avoids recursion limits) -------
    const xs: Record<string, number> = {};

    function iterate(
        setXsFn: (elem: string) => void,
        nextNodesFn: (elem: string) => Iterable<string>,
    ) {
        const allNodes = Object.keys(blockSucc).concat(
            Object.keys(blockPred).filter((k) => !blockSucc[k]),
        );
        const uniq = [...new Set(allNodes)];
        const stack = [...uniq];
        const visited: Record<string, boolean> = {};

        let elem: string | undefined;
        while ((elem = stack.pop()) !== undefined) {
            if (visited[elem]) {
                setXsFn(elem);
            } else {
                visited[elem] = true;
                stack.push(elem);
                for (const next of nextNodesFn(elem)) {
                    stack.push(next);
                }
            }
        }
    }

    // Pass 1: smallest (leftmost) coordinates
    function pass1(elem: string) {
        const preds = blockPred[elem] ?? new Set<string>();
        xs[elem] = [...preds].reduce((acc, pred) => {
            return Math.max(acc, (xs[pred] ?? 0) + (blockEdgeWeight[pred]?.[elem] ?? 0));
        }, 0);
    }

    // Pass 2: compact to the right (remove unused space)
    function pass2(elem: string) {
        const succs = blockSucc[elem] ?? new Set<string>();
        const min = [...succs].reduce((acc, succ) => {
            return Math.min(
                acc,
                (xs[succ] ?? Number.POSITIVE_INFINITY) - (blockEdgeWeight[elem]?.[succ] ?? 0),
            );
        }, Number.POSITIVE_INFINITY);

        if (min !== Number.POSITIVE_INFINITY) {
            xs[elem] = Math.max(xs[elem] ?? 0, min);
        }
    }

    iterate(pass1, (elem) => blockPred[elem] ?? []);
    iterate(pass2, (elem) => blockSucc[elem] ?? []);

    // Propagate block root x to all nodes in the block
    const result: Record<string, number> = {};
    for (const layer of layering) {
        for (const v of layer) {
            result[v] = xs[root[v] as string] ?? 0;
        }
    }

    if (reverseSep) {
        // Negate so right-biased alignments can be merged uniformly
        for (const k of Object.keys(result)) {
            result[k] = -(result[k] as number);
        }
    }

    return result;
}

/**
 * Runs all four Brandes-Köpf alignments (UL, UR, DL, DR), picks the one with
 * the smallest total width, aligns all four to it and returns the balanced
 * (averaged) x coordinate for every node.
 *
 * @param graph     Internal graph structure returned by `buildGraph`.
 * @param nodeWidth Per-node width lookup (or a constant function).
 * @param nodeSep   Minimum horizontal gap between node borders.
 */
export function positionX(
    graph: FamilyGraph,
    nodeWidth: (v: string) => number,
    nodeSep: number,
): Record<string, number> {
    const { layering, parents, children } = graph;

    const xss: Record<string, Record<string, number>> = {};

    const verticals: Array<'u' | 'd'> = ['u', 'd'];
    const horizontals: Array<'l' | 'r'> = ['l', 'r'];

    for (const vert of verticals) {
        // Top-down uses the original layering; bottom-up reverses it.
        let adjLayering = vert === 'u' ? layering : [...layering].reverse();

        for (const horiz of horizontals) {
            // Right-biased: reverse each individual layer
            if (horiz === 'r') {
                adjLayering = adjLayering.map((layer) => [...layer].reverse());
            }

            // Choose predecessor/successor depending on sweep direction
            const neighborFn =
                vert === 'u'
                    ? (v: string) => parents.get(v) ?? []
                    : (v: string) => children.get(v) ?? [];

            const { root, align } = verticalAlignment(adjLayering, neighborFn);

            let xs = horizontalCompaction(
                adjLayering,
                root,
                align,
                nodeWidth,
                nodeSep,
                horiz === 'r',
            );

            xss[vert + horiz] = xs;
        }
    }

    // Find the alignment with the smallest total width
    function findSmallestWidthAlignment(): Record<string, number> {
        let bestWidth = Number.POSITIVE_INFINITY;
        let best: Record<string, number> = xss['ul'] as Record<string, number>;

        for (const xs of Object.values(xss)) {
            const vals = Object.values(xs);
            const max = Math.max(...vals);
            const min = Math.min(...vals);
            const w = max - min;
            if (w < bestWidth) {
                bestWidth = w;
                best = xs;
            }
        }
        return best;
    }

    const alignTo = findSmallestWidthAlignment();
    const alignToVals = Object.values(alignTo);
    const alignToMin = Math.min(...alignToVals);
    const alignToMax = Math.max(...alignToVals);

    // Shift every alignment so that its min/max matches the target
    for (const vert of verticals) {
        for (const horiz of horizontals) {
            const key = vert + horiz;
            const xs = xss[key] as Record<string, number>;
            if (xs === alignTo) continue;

            const xsVals = Object.values(xs);
            let delta =
                horiz === 'l' ? alignToMin - Math.min(...xsVals) : alignToMax - Math.max(...xsVals);

            if (delta !== 0) {
                xss[key] = Object.fromEntries(Object.entries(xs).map(([v, x]) => [v, x + delta]));
            }
        }
    }

    // Balance: average the two middle values for each node
    const allNodes = layering.flat();
    const result: Record<string, number> = {};
    for (const v of allNodes) {
        const sorted = Object.values(xss)
            .map((xs) => xs[v])
            .sort((a, b) => (a as number) - (b as number));
        result[v] = ((sorted[1] as number) + (sorted[2] as number)) / 2;
    }

    return result;
}

/**
 * Assigns y coordinates: each layer gets a y position based on its index,
 * the node heights in that layer and the vertical separation between layers.
 *
 * @param graph      Internal graph structure.
 * @param nodeHeight Per-node height lookup.
 * @param rankSep    Minimum vertical gap between layer borders.
 */
export function positionY(
    graph: FamilyGraph,
    nodeHeight: (v: string) => number,
    rankSep: number,
): Record<string, number> {
    const result: Record<string, number> = {};
    let y = 0;

    for (const layer of graph.layering) {
        const layerHeight = layer.reduce((m, v) => Math.max(m, nodeHeight(v)), 0);
        for (const v of layer) {
            result[v] = y + layerHeight / 2; // centre of the node
        }
        y += layerHeight + rankSep;
    }

    return result;
}

export class BrandesKopfLayout {
    family: Index;
    graph: GraphBuilder;

    constructor(family: Index) {
        // super();
        this.family = family;
        this.graph = new GraphBuilder(family);
    }

    buildNodes(perspectiveId: string): [Node[], Edge[]] {
        this.graph = new GraphBuilder(this.family);
        this.graph.buildInitialGraph(perspectiveId);

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

        this.graph.getNodes().forEach((node, id) => {
            // (x; y) is the geometrical center of the node.
            const x = xCoords[id] ?? 0;
            const y = yCoords[id] ?? 0;

            if (node.type === MARRIAGE_NODE_TYPE) {
                nodes.push({
                    id,
                    data: {
                        id,
                        isChildrenCollapsible: false,
                        isChildrenCollapsed: false,
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

    collapseChildren(_nodeId: string): [Node[], Edge[]] {
        throw new Error('Not implemented');
    }

    collapseParents(_nodeId: string): [Node[], Edge[]] {
        throw new Error('Not implemented');
    }

    expandChildren(_nodeId: string): [Node[], Edge[]] {
        throw new Error('Not implemented');
    }

    expandParents(_nodeId: string): [Node[], Edge[]] {
        throw new Error('Not implemented');
    }
}

const MIDDLE_SIDE = 'middle_side';
type ChildSide = typeof LEFT_SIDE | typeof MIDDLE_SIDE | typeof RIGHT_SIDE;

interface CallerChild {
    side: ChildSide;
    childId: string;
}

interface NodePersons {
    person1?: Person;
    person2?: Person;
}

interface GraphNode {
    id: string;
    type: NodeType;
    persons: NodePersons;
}

class GraphBuilder {
    private nodes = new Map<string, GraphNode>();
    private parents = new Map<string, string[]>();
    private children = new Map<string, string[]>();
    private layers: Map<number, string[]> = new Map<number, string[]>();
    private family: Index;

    constructor(family: Index) {
        this.family = family;
    }

    getNodes(): Map<string, GraphNode> {
        return this.nodes;
    }

    getChildren(): Map<string, string[]> {
        return this.children;
    }

    personIdToNodeId(personId: string): [Id, Marriage | null] {
        const marriages = this.family.personMarriages.get(personId) ?? [];
        const marriage = marriages[0];

        if (marriage) {
            const id: Id = {
                type: MARRIAGE_TYPE,
                id: marriage.id,
            };

            return [id, marriage];
        } else {
            return [
                {
                    type: PERSON_TYPE,
                    id: personId,
                },
                null,
            ];
        }
    }

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

    buildFamilyGraph(): FamilyGraph {
        const layering: string[][] = [...this.layers.entries()]
            .sort(([a], [b]) => a - b)
            .map(([_, layer]) => layer);

        return {
            parents: this.parents,
            children: this.children,
            layering,
        };
    }

    buildInitialGraph(perspectiveId: string) {
        let [id, marriage] = this.personIdToNodeId(perspectiveId);

        if (marriage) {
            this.addParents(null, marriage, 0);
            this.addChildren(marriage, 1);
        } else {
            const parents = this.personParents(id.id);
            if (parents) {
                this.addParents({ side: MIDDLE_SIDE, childId: id.id }, parents, -1);
            } else {
                if (!this.layers.has(0)) {
                    this.layers.set(0, []);
                }
                // SAFE: if the layer does not exist, we will create it above.
                const layer = this.layers.get(0)!;
                layer.push(id.id);
                this.nodes.set(id.id, {
                    id: id.id,
                    type: PERSON_NODE_TYPE,
                    persons: {
                        person1: this.family.personById.get(id.id)!,
                    },
                });
            }
        }
    }

    addChildren(parentsMarriage: Marriage, childrenLayerNumber: number) {
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
            const [id, marriage] = this.personIdToNodeId(childId);

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

    addParents(caller: CallerChild | null, marriage: Marriage, layerNumber: number) {
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

                if (!this.parents.has(id)) {
                    this.parents.set(id, []);
                }
                // SAFE: if the parents of the person does not exist, we will initialize it above.
                const parents = this.parents.get(id)!;
                parents.push(p1Parents.id);
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

                if (!this.parents.has(id)) {
                    this.parents.set(id, []);
                }
                // SAFE: if the parents of the person does not exist, we will initialize it above.
                const parents = this.parents.get(id)!;
                parents.push(p2Parents.id);
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
                const [childNodeId, childMarriage] = this.personIdToNodeId(childId);
                childrenLayer.push(childNodeId.id);

                const persons: NodePersons =
                    childNodeId.type === MARRIAGE_TYPE
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
                    type:
                        childNodeId.type === MARRIAGE_TYPE ? MARRIAGE_NODE_TYPE : PERSON_NODE_TYPE,
                    persons,
                });

                children.push(childNodeId.id);
            }
        }
    }
}
