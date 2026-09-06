import { QUADRATIC, SerializableLayoutData } from '../';
import { Index } from '../../model';
import { BrandesKopfLayout, FamilyGraph } from '../fullGraph';
import { GraphBuilder, GraphNode } from '../fullGraph/graphBuilder';
import { positionQuadratic } from './quadratic';

/**
 * An experimental layout.
 *
 * It builds exactly the same graph as the {@link BrandesKopfLayout}: the same nodes, the same
 * layering, the same order within every layer, and the same edges. It differs in one thing only:
 * how each node's x coordinate is chosen. See the {@link positionQuadratic} function.
 *
 * Keeping everything but the x assignment shared is what makes the two layouts comparable: a
 * later change to how nodes and edges are emitted cannot land in one of them and not the other.
 */
export class QuadraticLayout extends BrandesKopfLayout {
    /**
     * Constructs a new instance of the quadratic layout.
     *
     * @param {Index} family - The family index containing all the information about persons and marriages.
     * @param {GraphBuilder} graph - An already built graph. When omitted, an empty one is created.
     */
    constructor(family: Index, graph?: GraphBuilder) {
        super(family, graph, positionQuadratic);
    }

    /**
     * Returns the layout state ready for serialization. Is it safe to stringify it to the JSON
     * and parse back again.
     * For the `QuadraticLayout`, the `data` field has `{ graph: FamilyGraph, nodes: Record<string, GraphNode> }` type.
     *
     * @returns {SerializableLayoutData} - A object ready to be serialized.
     */
    override toSerializableObject(): SerializableLayoutData {
        const nodes: Record<string, GraphNode> = Object.fromEntries(this.graph.getNodes());

        return {
            name: QUADRATIC,
            data: {
                graph: this.graph.buildFamilyGraph(),
                nodes,
            },
        };
    }
}

/**
 * Structurally identical to the `BrandesKopfLayoutData`: the two layouts share the same graph.
 */
export type QuadraticLayoutData = {
    graph: FamilyGraph;
    nodes: Record<string, GraphNode>;
};

/**
 * Then the user wants to save the layout into a file or somewhere else, it generates
 * the {@link SerializableLayoutData} object using the `toSerializableObject` method on the
 * {@link QuadraticLayout} class. Later, the user can use this method to construct and use
 * the {@link QuadraticLayout} object back again.
 *
 * @param {SerializableLayoutData} layout - Layout data.
 * @param {Index} family - The family index containing all the people and their relationships.
 * @returns {QuadraticLayout} - {@link QuadraticLayout} instance.
 */
export function fromSerializableObject(
    layout: SerializableLayoutData & { name: typeof QUADRATIC },
    family: Index,
): QuadraticLayout {
    return new QuadraticLayout(
        family,
        new GraphBuilder(family, layout.data.graph, layout.data.nodes),
    );
}
