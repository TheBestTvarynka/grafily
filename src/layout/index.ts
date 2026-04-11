import { Edge, Node } from '@xyflow/react';

import { Index } from '../model';
import { BrandesKopfLayout } from './fullGraph';

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

export const BRANDES_KORF = 'brandesKopf';
export const REINGOLD_TILFORD = 'reingoldTilford';
export type LayoutName = typeof BRANDES_KORF | typeof REINGOLD_TILFORD;

export class GenericLayout {
    private layput: BrandesKopfLayout;

    constructor(layoutName: LayoutName, family: Index) {
        switch (layoutName) {
            case BRANDES_KORF:
                this.layput = new BrandesKopfLayout(family);
                break;
            default:
                throw new Error(`Unknown layout name: ${layoutName}`);
        }
    }

    buildNodes(perspectiveId: string): [Node[], Edge[]] {
        return this.layput.buildNodes(perspectiveId);
    }

    collapseChildren(nodeId: string): [Node[], Edge[]] {
        return this.layput.collapseChildren(nodeId);
    }

    collapseParents(personId: string): [Node[], Edge[]] {
        return this.layput.collapseParents(personId);
    }

    expandChildren(nodeId: string): [Node[], Edge[]] {
        return this.layput.expandChildren(nodeId);
    }

    expandParents(personId: string): [Node[], Edge[]] {
        return this.layput.expandParents(personId);
    }
}
