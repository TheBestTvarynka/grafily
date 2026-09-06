import { QUADRATIC, SerializableLayoutData } from '../';
import { GraphLayout } from '../graph';
import { GraphBuilder } from '../graphBuilder';
import { positionQuadratic } from './quadratic';
import { Index } from '../../model';

/**
 * Creates an experimental {@link GraphLayout} that assigns x coordinates by solving a quadratic
 * program.
 *
 * It builds exactly the same graph as the Brandes-Kopf layout: the same nodes, the same layering,
 * the same order within every layer, and the same edges. It differs in one thing only: how each
 * node's x coordinate is chosen. See the {@link positionQuadratic} function.
 *
 * @param {Index} family - The family index containing all the information about persons and marriages.
 * @param {GraphBuilder} graph - An already built graph. When omitted, an empty one is created.
 * @returns {GraphLayout} - The layout instance ready to be used.
 */
export function quadraticLayout(family: Index, graph?: GraphBuilder): GraphLayout {
    return new GraphLayout(family, QUADRATIC, positionQuadratic, graph);
}

/**
 * Then the user wants to save the layout into a file or somewhere else, it generates
 * the {@link SerializableLayoutData} object using the `toSerializableObject` method on the
 * {@link GraphLayout} class. Later, the user can use this method to construct and use
 * the layout object back again.
 *
 * @param {SerializableLayoutData} layout - Layout data.
 * @param {Index} family - The family index containing all the people and their relationships.
 * @returns {GraphLayout} - The layout instance ready to be used.
 */
export function fromSerializableObject(
    layout: SerializableLayoutData & { name: typeof QUADRATIC },
    family: Index,
): GraphLayout {
    return quadraticLayout(family, new GraphBuilder(family, layout.data.graph, layout.data.nodes));
}
