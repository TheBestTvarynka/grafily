import { Index, Marriage } from '../model';
import { GraphBuilder } from './builder';
import { GraphLayout, GraphLayoutData, positionerFor } from './graph';

/**
 * Node width.
 */
export const NODE_WIDTH = 140;

/**
 * Node height.
 */
export const NODE_HEIGHT = 70;

/**
 * Marriage node size.
 */
export const MARRIAGE_NODE_SIZE = 10;

/**
 * Gap between marriage and person nodes.
 */
export const MARRIAGE_GAP = 20;

/**
 * Gap between nodes.
 */
export const NODES_GAP = 40;

/**
 * Marriage width.
 *
 * +------------+                             +------------+
 * |  parent1   |--------------o--------------|  parent2   |
 * +------------+                             +------------+
 *
 * | NODE_WIDTH | MARRIAGE_GAP | MARRIAGE_GAP | NODE_WIDTH |
 * |                    MARRIAGE_WIDTH                     |
 */
export const MARRIAGE_WIDTH = (NODE_WIDTH + MARRIAGE_GAP) * 2;

/**
 * Represents the person node. This person does not have a spouse.
 */
export const PERSON_NODE_TYPE = 'personNode';

/**
 * Represents the marriage node.
 */
export const MARRIAGE_NODE_TYPE = 'marriageNode';

/**
 * Represents the type of a node in the family graph. This can be either a {@link PERSON_NODE_TYPE} or a {@link MARRIAGE_NODE_TYPE}.
 */
export type NodeType = typeof PERSON_NODE_TYPE | typeof MARRIAGE_NODE_TYPE;

/**
 * Represents a preliminary tree node id.
 *
 * @property {PreNodeType} type - The type of the node (person or marriage).
 * @property {string} id - If `type` is a person type, this is the person id. If `type` is a marriage type, this is marriage id.
 */
export type Id = {
    type: NodeType;
    id: string;
};

export interface NodePersons {
    person1?: string;
    person2?: string;
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
 * Represents the family graph. No modifications are needed to this graph. It is ready for nodes positions calculations.
 * When the graph is modified by the user, a new instance of the graph must be created by the `GraphBuilder` class.
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
 * Returns the width of the node based on its type.
 *
 * @param {Id} id The Node id to get the width for.
 * @returns {number} The width of the node.
 */
export function nodeWidth(id: Id): number {
    if (id.type === PERSON_NODE_TYPE) {
        return NODE_WIDTH;
    } else {
        return MARRIAGE_WIDTH;
    }
}

/**
 * Converts a person ID to a node ID.
 *
 * @param {string} personId - The ID of the person to convert.
 * @returns {[Id, Marriage | null]} - The node ID and associated marriage, if any.
 */
export function personIdToNodeId(personId: string, family: Index): [Id, Marriage | null] {
    const marriages = family.personMarriages.get(personId) ?? [];
    const marriage = marriages[0];

    if (marriage) {
        const id: Id = {
            type: MARRIAGE_NODE_TYPE,
            id: marriage.id,
        };

        return [id, marriage];
    } else {
        return [
            {
                type: PERSON_NODE_TYPE,
                id: personId,
            },
            null,
        ];
    }
}

export const MOVE_PERSON_LEFT = 'move_left';
export const MOVE_PERSON_RIGHT = 'move_right';
export const SWAP_MARRIAGE_SPOUSES = 'move_spouses';
/**
 * Currently, we support only three actions for changing node position:
 * - {@link MOVE_PERSON_LEFT} and {@link MOVE_PERSON_RIGHT}. This action moves the selected node to the left or right
 *   among its siblings. These actions may have additional requirements depending on the layout type.
 * - {@link SWAP_MARRIAGE_SPOUSES}. This action swaps spouses within the marriage.
 *   This action may have additional requirements depending on the layout type.
 */
export type RearrangeAction =
    | typeof MOVE_PERSON_LEFT
    | typeof MOVE_PERSON_RIGHT
    | typeof SWAP_MARRIAGE_SPOUSES;

/**
 * A family tree: the pedigree of the selected person and all of their descendants. It contains
 * no siblings of the selected person and no siblings of any ancestor, so no aunts, uncles, or
 * cousins.
 */
export const TREE = 'tree';

/**
 * A family graph: every ancestor and descendant of the selected person, plus the siblings of all
 * of them. Handles a family of any complexity.
 */
export const GRAPH = 'graph';

/**
 * What the layout puts into the graph. Both kinds are drawn by the same code and support the
 * same interactions; they differ only in which nodes the initial graph contains.
 *
 * *Note*: this value is written into the plugin data file for every saved graph, so changing it
 * needs a migration.
 */
export type LayoutKind = typeof TREE | typeof GRAPH;

/**
 * Assigns x coordinates with the Brandes-Kopf algorithm. Fast and predictable, but not every
 * node ends up centered relative to its ancestors or descendants.
 */
export const BRANDES_KORF = 'brandesKopf';

/**
 * Assigns x coordinates by solving a quadratic program. Centers every node at the average of its
 * neighbours in the adjacent layers, at the cost of a solve that grows with the graph.
 */
export const QUADRATIC = 'quadratic';

/**
 * How the layout decides where nodes go horizontally. Orthogonal to the {@link LayoutKind}: any
 * algorithm can position any kind.
 *
 * *Note*: this value is written into the plugin data file for every saved graph, so changing it
 * needs a migration.
 */
export type PositioningAlgorithm = typeof BRANDES_KORF | typeof QUADRATIC;

/**
 * The two choices a user makes when building a graph.
 */
export type LayoutOptions = {
    kind: LayoutKind;
    algorithm: PositioningAlgorithm;
};

/**
 * The algorithm used when the user has not picked one - opening the view from the file menu or
 * from a `grafily-navigation` code block.
 */
export const DEFAULT_ALGORITHM: PositioningAlgorithm = QUADRATIC;

export type NodeCapabilities = {
    movableLeft: boolean;
    movableRight: boolean;
    spousesSwappable: boolean;
};

export type PersonVisibility = {
    /**
     * true if the person is currently visible on the graph. Otherwise, false.
     */
    isVisible: boolean;
    /**
     * true if the person is can be shown/hidden on the graph.
     * Otherwise, false.
     */
    disabled: boolean;
};

/**
 * The layout state ready for serialization. Both layout kinds and both positioning algorithms
 * produce the very same {@link GraphLayoutData}, because they all build one `GraphBuilder` graph
 * and differ only in what goes into it and where the nodes end up horizontally.
 */
export type SerializableLayoutData = {
    kind: LayoutKind;
    algorithm: PositioningAlgorithm;
    data: GraphLayoutData;
};

/**
 * Creates a layout for the given options.
 *
 * @param {LayoutOptions} options - The layout kind and the positioning algorithm to use.
 * @param {Index} family - The family index containing all the information about persons and marriages.
 * @param {GraphBuilder} graph - An already built graph. When omitted, an empty one is created.
 * @returns {GraphLayout} - The layout instance ready to be used.
 */
export function createLayout(
    options: LayoutOptions,
    family: Index,
    graph?: GraphBuilder,
): GraphLayout {
    return new GraphLayout(
        family,
        options.kind,
        options.algorithm,
        positionerFor(options.algorithm),
        graph,
    );
}

/**
 * When the user wants to save the layout into a file or somewhere else, it generates the
 * {@link SerializableLayoutData} object using the `toSerializableObject` method on the
 * {@link GraphLayout} class. Later, the user can use this method to construct and use the layout
 * object back again.
 *
 * @param {SerializableLayoutData} layoutData - Layout data.
 * @param {Index} family - The family index containing all the people and their relationships.
 * @returns {GraphLayout} - The {@link GraphLayout} instance ready to be used.
 */
export function fromSerializableObject(
    layoutData: SerializableLayoutData,
    family: Index,
): GraphLayout {
    return createLayout(
        { kind: layoutData.kind, algorithm: layoutData.algorithm },
        family,
        new GraphBuilder(family, layoutData.data.graph, layoutData.data.nodes),
    );
}
