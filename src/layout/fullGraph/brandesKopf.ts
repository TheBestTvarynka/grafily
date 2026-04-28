/**
 * This module implements the Brandes-Köpf algorithm for calculating graph node positions (x and y coordinates).
 * This implementation is highly inspired by the dagre project: {@link https://github.com/dagrejs/dagre/blob/2595d05a0fbb7721f35bfcaab5fbf40f5b3858ca/lib/position/bk.js}.
 * Basically, that's the same algorithm, but rewritten in TypeScript and adapted to the current use case.
 *
 * Useful links:
 * - {@link https://github.com/dagrejs/dagre} - The Dagre project on GitHub.
 * - {@link https://scispace.com/pdf/fast-and-simple-horizontal-coordinate-assignment-2aawem94ts.pdf} - Fast and Simple Horizontal Coordinate Assignment.
 *
 * @module brandesKopf
 */

import { FamilyGraph } from './index';

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

    // Initialize: every node is its own block.
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
                        throw new Error(`Node position '${posA}' or '${posB}' is not initialized`);
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
