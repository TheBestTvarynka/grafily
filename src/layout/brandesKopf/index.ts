import { BRANDES_KORF, SerializableLayoutData } from '../';
import { GraphLayout } from '../graph';
import { GraphBuilder } from '../graphBuilder';
import { positionX } from './brandesKopf';
import { Index } from '../../model';

/**
 * Creates a {@link GraphLayout} that assigns x coordinates with the Brandes-Kopf algorithm.
 *
 * @param {Index} family - The family index containing all the information about persons and marriages.
 * @param {GraphBuilder} graph - An already built graph. When omitted, an empty one is created.
 * @returns {GraphLayout} - The layout instance ready to be used.
 */
export function brandesKopfLayout(family: Index, graph?: GraphBuilder): GraphLayout {
    return new GraphLayout(family, BRANDES_KORF, positionX, graph);
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
    layout: SerializableLayoutData & { name: typeof BRANDES_KORF },
    family: Index,
): GraphLayout {
    return brandesKopfLayout(
        family,
        new GraphBuilder(family, layout.data.graph, layout.data.nodes),
    );
}
