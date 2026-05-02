import { Edge, Node } from '@xyflow/react';

import { Index, Marriage } from '../model';
import { BrandesKopfLayout } from './fullGraph';
import { ReingoldTilford } from './tree';

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

/**
 * The layout algorithm based on the Brandes-Kopf algorithm. This layout is designed to handle general directed acyclic graphs (DAGs) and is not limited to tree structures.
 */
export const BRANDES_KORF = 'brandesKopf';

/**
 * The layout algorithm based on the Reingold-Tilford algorithm. This layout is designed to handle tree structures and does not work with graphs.
 */
export const REINGOLD_TILFORD = 'reingoldTilford';

/**
 * The available layout algorithms for the family graph. Currently supports {@link BRANDES_KORF} and {@link REINGOLD_TILFORD}.
 */
export type LayoutName = typeof BRANDES_KORF | typeof REINGOLD_TILFORD;

/**
 * Represents a generic layout for the family graph. This class serves as a wrapper around specific layout implementations, allowing for flexibility in choosing different layout algorithms in the future.
 */
export class GenericLayout {
    private layout: BrandesKopfLayout | ReingoldTilford;

    /**
     * Constructs a new instance of the GenericLayout class with the specified layout implementation.
     *
     * @param {LayoutName} layoutName - The layout algorithm to use for building the graph. Currently supports {@link BRANDES_KORF} and {@link REINGOLD_TILFORD}.
     * @param {Index} family - The family index containing all the information about persons and marriages.
     */
    constructor(layoutName: LayoutName, family: Index) {
        switch (layoutName) {
            case BRANDES_KORF:
                this.layout = new BrandesKopfLayout(family);
                break;
            case REINGOLD_TILFORD:
                this.layout = new ReingoldTilford(family);
                break;
        }
    }

    /**
     * Initializes the initial graph, calculates nodes coordinates, and creates graph nodes and edges.
     *
     * @param {string} perspectivePersonId - The person id to build the graph from the perspective of. This person will be in the "center" of the graph.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    buildNodes(perspectiveId: string): [Node[], Edge[]] {
        return this.layout.buildNodes(perspectiveId);
    }

    /**
     * Collapses the children of a given marriage.
     *
     * @param {string} nodeId - The id of the node to collapse its children. This node if must be a marriage id.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    collapseChildren(nodeId: string): [Node[], Edge[]] {
        return this.layout.collapseChildren(nodeId);
    }

    /**
     * Collapses the parents of a given person.
     *
     * @param {string} personId - The person id to collapse its parents.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    collapseParents(personId: string): [Node[], Edge[]] {
        return this.layout.collapseParents(personId);
    }

    /**
     * Expands the children of a given marriage.
     *
     * @param {string} nodeId - The marriage id to expand its children.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    expandChildren(nodeId: string): [Node[], Edge[]] {
        return this.layout.expandChildren(nodeId);
    }

    /**
     * Expands the parents of a given person.
     *
     * @param {string} personId - The person id to expand its parents.
     * @returns {[Node[], Edge[]]} Returns a resulting graph nodes and edges ready to be rendered.
     */
    expandParents(personId: string): [Node[], Edge[]] {
        return this.layout.expandParents(personId);
    }
}
