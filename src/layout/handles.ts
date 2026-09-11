import { type Node, Position } from '@xyflow/react';

// This module and `index.ts` import each other (`index.ts` -> `graph.ts` -> here), so the
// constants from `index.ts` are only safe to use inside functions, never at module level.
import { HANDLE_SIZE, MARRIAGE_NODE_SIZE, NODE_HEIGHT, NODE_WIDTH, PERSON_TOP_HANDLE_Y } from '.';
import { LEFT_SIDE, MarriageNodeSide, RIGHT_SIDE } from '../model';

/**
 * A handle declared on a node. `@xyflow/react` does not re-export the type by name.
 */
type NodeHandle = NonNullable<Node['handles']>[number];

/**
 * Where React Flow would measure a handle rendered at `position` on the edge of a `width` x
 * `height` node: the default stylesheet centers the handle on the edge, so the handle box is
 * shifted back by half its size.
 */
const handleOnEdge = (
    width: number,
    height: number,
    position: Position,
    type: NodeHandle['type'],
    id: string,
): NodeHandle => {
    const half = HANDLE_SIZE / 2;

    const x = {
        [Position.Left]: -half,
        [Position.Right]: width - half,
        [Position.Top]: width / 2 - half,
        [Position.Bottom]: width / 2 - half,
    }[position];

    const y = {
        [Position.Left]: height / 2 - half,
        [Position.Right]: height / 2 - half,
        [Position.Top]: -half,
        [Position.Bottom]: height - half,
    }[position];

    return { id, type, position, x, y, width: HANDLE_SIZE, height: HANDLE_SIZE };
};

/**
 * Handles of a person node, mirroring the `<Handle>` elements `PersonNode` renders. The declared
 * geometry lets React Flow draw the node and its edges before it has measured the DOM.
 *
 * @param hasParents - whether the person has parents at all (the `top` handle exists only then).
 * @param side - the side of the node that faces its marriage node, if any.
 */
export const personNodeHandles = (hasParents: boolean, side: MarriageNodeSide): NodeHandle[] => {
    const handles: NodeHandle[] = [];

    if (hasParents) {
        const top = handleOnEdge(NODE_WIDTH, NODE_HEIGHT, Position.Top, 'target', 'top');
        handles.push({ ...top, y: PERSON_TOP_HANDLE_Y - HANDLE_SIZE / 2 });
    }

    if (side === LEFT_SIDE) {
        handles.push(handleOnEdge(NODE_WIDTH, NODE_HEIGHT, Position.Left, 'target', 'left'));
    }

    if (side === RIGHT_SIDE) {
        handles.push(handleOnEdge(NODE_WIDTH, NODE_HEIGHT, Position.Right, 'target', 'right'));
    }

    return handles;
};

/**
 * Handles of a marriage node, mirroring the `<Handle>` elements `MarriageNode` renders.
 *
 * @param hasChildren - whether the marriage has children at all (the `bottom` handle exists only then).
 */
export const marriageNodeHandles = (hasChildren: boolean): NodeHandle[] => {
    const size = MARRIAGE_NODE_SIZE;
    const handles = [
        handleOnEdge(size, size, Position.Left, 'source', 'left'),
        handleOnEdge(size, size, Position.Right, 'source', 'right'),
    ];

    if (hasChildren) {
        handles.push(handleOnEdge(size, size, Position.Bottom, 'source', 'bottom'));
    }

    return handles;
};
