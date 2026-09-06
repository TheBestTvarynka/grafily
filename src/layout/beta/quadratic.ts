import { solveQP } from 'quadprog';

import { FamilyGraph } from '../fullGraph';
import { DenseMatrix } from './matrix';

// Positions nodes by solving a quadratic program instead of by following a
// procedure. The in-layer order is already given and the graph is planar, so
// the only unknown is each node's x, and the aesthetics can be stated directly:
//
//     minimize  sum over edges (c_parent - c_child)^2 + eps * sum (c_i)^2
//     such that c_right - c_left >= separation(...)  for neighbours in a layer
//
// At the optimum of the first term every node sits at the average of its
// neighbours in the adjacent layers. That single rule covers all the cases a
// procedural algorithm would special-case: a parent lands centred over its
// children, a child with two parents lands centred between them, and children
// with a single parent are pulled towards it, so they pack at the minimum gap
// and the slack ends up only where the structure actually demands it. A wide
// subtree pushes its ancestors apart through the same chain of terms.
//
// The variable c_i is a node's horizontal CENTRE, not its left border, because
// nodes differ in width and it is the centres that these aesthetics talk about:
// a wide parent belongs over the middle of its children, not left-aligned with
// them.
//
// Cost: `Dmat` is a dense (n + 1)^2 matrix and `solveQP` is an active-set solver, so the solve
// is roughly cubic in the number of nodes. That is comfortable for the tens or hundreds of
// nodes a collapse/expand-driven graph shows, and it is not meant for thousands.

// The edge term on its own is translation invariant, which leaves the Hessian
// singular, and quadprog needs a strictly positive definite one. This term
// pulls the drawing towards x = 0 just enough to single out one optimum from
// the family of horizontally shifted ones. At this weight it shrinks a node's
// position by a factor of deg / (deg + eps), well under a pixel in practice.
const REGULARIZATION = 1e-4;

// One constraint per neighbouring pair inside a layer, each carrying the gap
// its two widths require. Besides keeping nodes from overlapping, these pin the
// given in-layer order, which is what keeps the drawing free of crossings.
interface Separation {
    left: number;
    right: number;
    gap: number;
}

interface Variables {
    /** `ids[i]` is the node whose centre is quadprog variable `i + 1`. */
    ids: string[];
    indexById: Map<string, number>;
    separations: Separation[];
}

/**
 * Flattens the layering into a variable vector and collects the separation constraints in the
 * same sweep.
 *
 * Carrying the previous node instead of indexing back into the layer keeps every value here
 * non-optional. `Array.push` conveniently returns the new length, which is exactly the 1-based
 * variable number quadprog wants.
 */
function collectVariables(
    graph: FamilyGraph,
    nodeWidth: (v: string) => number,
    nodeSep: number,
): Variables {
    const ids: string[] = [];
    const indexById = new Map<string, number>();
    const separations: Separation[] = [];

    for (const layer of graph.layering) {
        let previous: { variable: number; width: number } | null = null;

        for (const id of layer) {
            const variable = ids.push(id);
            const width = nodeWidth(id);

            indexById.set(id, variable);

            if (previous) {
                separations.push({
                    left: previous.variable,
                    right: variable,
                    // How far apart the centres of two neighbours must be so that their borders
                    // never come closer than `nodeSep`. Still a constant per pair, so the
                    // constraints stay plain difference constraints and only the right-hand side
                    // of the program varies with width.
                    gap: (previous.width + width) / 2 + nodeSep,
                });
            }

            previous = { variable, width };
        }
    }

    return { ids, indexById, separations };
}

/**
 * Builds `Dmat = 2 * (L + eps * I)`, where `L` is the Laplacian of the edge set: `x^T L x` is
 * exactly the sum of squared edge lengths, and `solveQP` minimizes `1/2 x^T D x` when `dvec` is
 * zero.
 */
function buildHessian(graph: FamilyGraph, indexById: Map<string, number>, n: number): DenseMatrix {
    const dmat = new DenseMatrix(n, n);

    for (let i = 1; i <= n; i++) {
        dmat.set(i, i, 2 * REGULARIZATION);
    }

    for (const [parentId, childIds] of Object.entries(graph.children)) {
        // `GraphBuilder.removeParentsOf` deletes a node from `nodes` and from the layering but
        // leaves its `children` entry in place, so `children` can name nodes that are not drawn.
        // Brandes-Kopf never notices, because it only ever walks the layering; here such an id
        // would turn into an undefined matrix index.
        const parent = indexById.get(parentId);
        if (parent === undefined) {
            continue;
        }

        for (const childId of childIds) {
            const child = indexById.get(childId);
            if (child === undefined) {
                continue;
            }

            dmat.add(parent, parent, 2);
            dmat.add(child, child, 2);
            dmat.add(parent, child, -2);
            dmat.add(child, parent, -2);
        }
    }

    return dmat;
}

/**
 * Builds `Amat`, which is indexed `[variable][constraint]` and encodes `A^T x >= b`, i.e.
 * `c_right - c_left >= gap` for every separation.
 */
function buildConstraints(separations: Separation[], n: number): DenseMatrix {
    const amat = new DenseMatrix(n, separations.length);

    separations.forEach(({ left, right }, index) => {
        amat.set(left, index + 1, -1);
        amat.set(right, index + 1, 1);
    });

    return amat;
}

/**
 * Calculates the x coordinate - the geometrical centre - of every node in the graph by solving a
 * quadratic program. Has the same signature as the Brandes-Kopf `positionX`, so the two are
 * interchangeable.
 *
 * @param {FamilyGraph} graph - The graph to position. Its layering, and the order within each
 * layer, are taken as given and are preserved.
 * @param {(v: string) => number} nodeWidth - Returns the width of the node with the given id.
 * @param {number} nodeSep - The minimum gap between the borders of two neighbours in a layer.
 * @returns {Record<string, number>} - The x coordinate of every node, keyed by node id.
 */
export function positionQuadratic(
    graph: FamilyGraph,
    nodeWidth: (v: string) => number,
    nodeSep: number,
): Record<string, number> {
    const { ids, indexById, separations } = collectVariables(graph, nodeWidth, nodeSep);
    const n = ids.length;
    const centres: Record<string, number> = {};

    // A graph with at most one node per layer has no constraints at all, and
    // quadprog rejects an empty constraint matrix. The objective is minimized
    // by stacking everything on a single column, which is the right drawing.
    if (n === 0 || separations.length === 0) {
        for (const id of ids) {
            centres[id] = 0;
        }

        return centres;
    }

    const result = solveQP(
        buildHessian(graph, indexById, n).raw(),
        new Array<number>(n + 1).fill(0),
        buildConstraints(separations, n).raw(),
        // bvec is 1-based like everything else quadprog takes, so index 0 is a
        // placeholder and constraint j's required gap lives at index j.
        [0, ...separations.map(({ gap }) => gap)],
    );

    const solution = result.solution;
    if (result.message !== '' || !solution) {
        throw new Error(`Failed to solve the layout: ${result.message || 'no solution returned'}.`);
    }

    ids.forEach((id, index) => {
        // The solution is 1-based, like everything else quadprog returns. The length was checked
        // by `solveQP` itself, so the fallback is never taken.
        centres[id] = solution[index + 1] ?? 0;
    });

    return centres;
}
