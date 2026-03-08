export const NODE_WIDTH = 140;
export const NODE_HEIGHT = 70;
export const MARRIAGE_NODE_SIZE = 10;
export const MARRIAGE_GAP = 20;
export const NODES_GAP = 40;

// +------------+                             +------------+
// |  parent1   |--------------o--------------|  parent2   |
// +------------+                             +------------+
//
// | NODE_WIDTH | MARRIAGE_GAP | MARRIAGE_GAP | NODE_WIDTH |
// |                    MARRIAGE_WIDTH                     |
export const MARRIAGE_WIDTH = (NODE_WIDTH + MARRIAGE_GAP) * 2;

export const PERSON_NODE_TYPE = 'personNode';
export const PERSON_TYPE = PERSON_NODE_TYPE;
export const MARRIAGE_NODE_TYPE = 'marriageNode';
export const MARRIAGE_TYPE = MARRIAGE_NODE_TYPE;

export type NodeType = typeof PERSON_TYPE | typeof MARRIAGE_TYPE;

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
 * @returns The width of the node.
 */
export function nodeWidth(id: Id): number {
    if (id.type === PERSON_TYPE) {
        return NODE_WIDTH;
    } else {
        return MARRIAGE_WIDTH;
    }
}
