import { Edge, Node } from '@xyflow/react';
import { Vault } from 'obsidian';

import { Id, MARRIAGE_TYPE, NODES_GAP, NODE_HEIGHT, NODE_WIDTH, PERSON_TYPE } from './consts';
import { Index, LEFT_SIDE, Person } from '../model';

/**
 * Describes one node for the input array.  `parentIds` lists all nodes that
 * are direct parents of this node (i.e. there is a directed edge
 * parent → this node).
 */
interface NodeInput {
    id: string;
    parentIds: string[];
}

/**
 * Describes where a node lives in the layered layout.
 *
 * - `id`     – unique identifier of the node.
 * - `level`  – 0-based index of the layer (top = 0).
 * - `order`  – 0-based position of this node inside that layer (left = 0).
 */
interface NodeLayout {
    id: string;
    level: number;
    order: number;
}

interface GraphStructure {
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
 * Builds the internal graph structure from a flat input list plus an explicit
 * layout description.
 *
 * @param nodes   Flat array of {id, parentIds} tuples.
 * @param layouts Array of {id, level, order} tuples that decide where each
 *                node goes in the layered layout.  Every node id present in
 *                `nodes` must appear here exactly once.
 */
function buildGraph(nodes: NodeInput[], layouts: NodeLayout[]): GraphStructure {
    const parents: Map<string, string[]> = new Map();
    const children: Map<string, string[]> = new Map();

    for (const n of nodes) {
        parents.set(n.id, []);
        children.set(n.id, []);
    }

    // Fill parents / children from parentIds
    for (const n of nodes) {
        for (const parentId of n.parentIds) {
            const parentsOfNode = parents.get(n.id);
            if (parentsOfNode) {
                parentsOfNode.push(parentId);
            } else {
                throw new Error(`Node ${n.id} does not have initialized parents array`);
            }

            const c = children.get(parentId);
            if (c) {
                c.push(n.id);
            } else {
                throw new Error(`Parent ${parentId} does not have initialized children array`);
            }
        }
    }

    // Build layering from explicit layout
    const maxLevel = layouts.reduce((m, l) => Math.max(m, l.level), 0);
    const layering: string[][] = Array.from({ length: maxLevel + 1 }, () => []);

    for (const nodeLayout of layouts) {
        const level = layering[nodeLayout.level];
        if (level) {
            level.push(nodeLayout.id);
        } else {
            throw new Error(`Level ${nodeLayout.level} does not have initialized layer array`);
        }
    }

    const orderOf: Record<string, number> = {};
    for (const nodeLayout of layouts) {
        orderOf[nodeLayout.id] = nodeLayout.order;
    }

    for (const layer of layering) {
        layer.sort((a, b) => {
            let orderA = orderOf[a];
            let orderB = orderOf[b];

            if (orderA === undefined || orderB === undefined) {
                throw new Error(`Node ${orderA} or ${orderB} is initialized`);
            }

            return orderA - orderB;
        });
    }

    return { parents, children, layering };
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
    graph: GraphStructure,
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
    graph: GraphStructure,
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

/**
 * High-level helper: given raw data + explicit layout, produce positioned
 * @xyflow/react Nodes and Edges.
 *
 * @param data       Hardcoded node definitions (id + parentIds).
 * @param layouts    Hardcoded layout (level + order for every node id).
 * @param nodeWidth  Node width in pixels (constant or per-node function).
 * @param nodeHeight Node height in pixels (constant or per-node function).
 * @param nodeSep    Horizontal gap between nodes (default 50).
 * @param rankSep    Vertical gap between layers (default 80).
 */
export function buildTbt(
    data: NodeInput[],
    layouts: NodeLayout[],
    nodeWidth: number | ((id: string) => number) = NODE_WIDTH,
    nodeHeight: number | ((id: string) => number) = NODE_HEIGHT,
    nodeSep = NODES_GAP,
    rankSep = NODE_HEIGHT + NODES_GAP,
): [Node[], Edge[]] {
    const widthFn = typeof nodeWidth === 'number' ? (_: string) => nodeWidth : nodeWidth;
    const heightFn = typeof nodeHeight === 'number' ? (_: string) => nodeHeight : nodeHeight;

    const graph = buildGraph(data, layouts);

    const xCoords = positionX(graph, widthFn, nodeSep);
    const yCoords = positionY(graph, heightFn, rankSep);

    const nodes: Node[] = data.map((n) => ({
        id: n.id,
        position: {
            x: xCoords[n.id] ?? 0,
            y: yCoords[n.id] ?? 0,
        },
        data: { person: idToPerson(n.id) },
        type: 'personNode',
        style: {
            color: '#222',
        },
    }));

    const edges: Edge[] = [];
    for (const n of data) {
        for (const parentId of n.parentIds) {
            edges.push({
                id: `${parentId}-to-${n.id}`,
                source: parentId,
                target: n.id,
                sourceHandle: 'bottom',
                targetHandle: 'top',
            });
        }
    }

    return [nodes, edges];
}

const data: NodeInput[] = [
    { id: '1', parentIds: [] },
    { id: '2', parentIds: [] },
    { id: '3', parentIds: ['1'] },
    { id: '4', parentIds: ['2'] },
    { id: '5', parentIds: ['3', '4'] },
    { id: '6', parentIds: ['5'] },
    { id: '7', parentIds: ['6'] },
    { id: '8', parentIds: ['6'] },
    { id: '9', parentIds: ['5'] },
    { id: '10', parentIds: ['12'] },
    { id: '11', parentIds: ['12'] },
    { id: '12', parentIds: ['16'] },
    { id: '13', parentIds: ['14'] },
    { id: '14', parentIds: ['16'] },
    { id: '15', parentIds: ['16'] },
    { id: '16', parentIds: ['5'] },
    { id: '17', parentIds: ['5'] },
    { id: '18', parentIds: ['5', '30'] },
    { id: '19', parentIds: ['17'] },
    { id: '20', parentIds: ['17'] },
    { id: '21', parentIds: ['17'] },
    { id: '22', parentIds: ['33', '18'] },
    { id: '23', parentIds: ['18'] },
    { id: '24', parentIds: ['18'] },
    { id: '25', parentIds: ['30'] },
    { id: '26', parentIds: ['29'] },
    { id: '27', parentIds: ['29'] },
    { id: '28', parentIds: ['27'] },
    { id: '29', parentIds: ['30'] },
    { id: '30', parentIds: ['31', '32'] },
    { id: '31', parentIds: [] },
    { id: '32', parentIds: [] },
    { id: '33', parentIds: [] },
    { id: '34', parentIds: ['33'] },
    { id: '35', parentIds: ['2'] },
    { id: '36', parentIds: ['2'] },
];

const layouts: NodeLayout[] = [
    { id: '1', level: 0, order: 0 },
    { id: '2', level: 0, order: 1 },

    { id: '3', level: 1, order: 0 },
    { id: '4', level: 1, order: 1 },
    { id: '35', level: 1, order: 2 },
    { id: '36', level: 1, order: 3 },
    { id: '31', level: 1, order: 4 },
    { id: '32', level: 1, order: 5 },

    { id: '5', level: 2, order: 0 },
    { id: '30', level: 2, order: 1 },

    { id: '6', level: 3, order: 0 },
    { id: '9', level: 3, order: 1 },
    { id: '16', level: 3, order: 2 },
    { id: '17', level: 3, order: 3 },
    { id: '33', level: 3, order: 4 },
    { id: '18', level: 3, order: 5 },
    { id: '25', level: 3, order: 6 },
    { id: '29', level: 3, order: 7 },

    { id: '7', level: 4, order: 0 },
    { id: '8', level: 4, order: 1 },
    { id: '12', level: 4, order: 2 },
    { id: '14', level: 4, order: 3 },
    { id: '15', level: 4, order: 4 },
    { id: '19', level: 4, order: 5 },
    { id: '20', level: 4, order: 6 },
    { id: '21', level: 4, order: 7 },
    { id: '34', level: 4, order: 8 },
    { id: '22', level: 4, order: 9 },
    { id: '23', level: 4, order: 10 },
    { id: '24', level: 4, order: 11 },
    { id: '26', level: 4, order: 12 },
    { id: '27', level: 4, order: 13 },

    { id: '10', level: 5, order: 0 },
    { id: '11', level: 5, order: 1 },
    { id: '13', level: 5, order: 2 },
    { id: '28', level: 5, order: 3 },
];

export function buildNodes(_perspectiveId: string, _family: Index): [Node[], Edge[]] {
    return buildTbt(data, layouts);
}

function idToPerson(id: string): Person {
    return {
        id,
        name: {
            surname: '',
            name: id,
        },
        isParentNodesHidden: false,
        isParentNodesFoldable: false,
        marriageNodeSide: LEFT_SIDE,
        file: {
            stat: {
                ctime: 0,
                mtime: 0,
                size: 0,
            },
            basename: '',
            extension: '',
            path: '',
            name: '',
            parent: null,
            vault: null as unknown as Vault,
        },
    };
}

interface GraphNode {
    id: Id;
}

class GraphBuilder {
    private persons = new Map<Id, Person[]>();
    private parents = new Map<Id, Id[]>();
    private children = new Map<Id, Id[]>();
    private family: Index;

    constructor(family: Index) {
        this.family = family;

        this.persons = new Map<Id, Person[]>();
        this.parents = new Map<Id, Id[]>();
        this.children = new Map<Id, Id[]>();
    }

    build(perspectiveId: string) {
        const marriages = this.family.personMarriages.get(perspectiveId) ?? [];
        const marriage = marriages[0];

        // Initialization. We form a starting node.
        let id: Id;
        if (marriage) {
            id = {
                type: MARRIAGE_TYPE,
                id: marriage.id,
            };
            const marriagePersons = [];
            if (marriage.parent1Id) {
                marriagePersons.push(this.family.personById.get(marriage.parent1Id)!);
            }
            if (marriage.parent2Id) {
                marriagePersons.push(this.family.personById.get(marriage.parent2Id)!);
            }
            this.persons.set(id, marriagePersons);
        } else {
            id = {
                type: PERSON_TYPE,
                id: perspectiveId,
            };
            this.persons.set(id, [this.family.personById.get(perspectiveId)!]);
        }

        //
    }
}
