/**
 * This module finds the person to select when the user walks the graph with the keyboard.
 *
 * It only reads the graph: the selection moves between the nodes that are already on the graph,
 * so nothing has to be rebuilt or repositioned. Collapsed or hidden relatives are never reached.
 *
 * @module navigation
 */

import { MARRIAGE_NODE_TYPE, personIdToNodeId } from './';
import { GraphBuilder } from './builder';
import { Index } from '../model';

export const NAVIGATE_UP = 'navigate_up';
export const NAVIGATE_DOWN = 'navigate_down';
export const NAVIGATE_LEFT = 'navigate_left';
export const NAVIGATE_RIGHT = 'navigate_right';
/**
 * Where to move the selection from the current person:
 * - {@link NAVIGATE_UP}. To the left parent of the person's own parents.
 * - {@link NAVIGATE_DOWN}. To the leftmost child of the person.
 * - {@link NAVIGATE_LEFT} and {@link NAVIGATE_RIGHT}. To the next person in the person's layer.
 *   A marriage node counts as two persons, so the spouse is selected before the next node.
 */
export type NavigationAction =
    | typeof NAVIGATE_UP
    | typeof NAVIGATE_DOWN
    | typeof NAVIGATE_LEFT
    | typeof NAVIGATE_RIGHT;

/**
 * The person the selection moves to.
 *
 * @property {string} personId - The person to select.
 * @property {string} nodeId - The graph node the person belongs to: their marriage node or their own person node.
 */
export type NavigationTarget = {
    personId: string;
    nodeId: string;
};

/**
 * Finds the person to select after the given navigation action.
 *
 * @param {GraphBuilder} graph - The current graph.
 * @param {Index} family - The family index.
 * @param {string} personId - The currently selected person. Must be present on the graph.
 * @param {NavigationAction} action - Where to move the selection.
 * @returns {NavigationTarget | null} - The person to select, or null when there is no one in that direction.
 */
export function navigate(
    graph: GraphBuilder,
    family: Index,
    personId: string,
    action: NavigationAction,
): NavigationTarget | null {
    const [id] = personIdToNodeId(personId, family);
    if (!graph.contains(id.id)) {
        return null;
    }

    switch (action) {
        case NAVIGATE_UP:
            return navigateUp(graph, family, personId);
        case NAVIGATE_DOWN:
            return navigateDown(graph, family, id.id);
        case NAVIGATE_LEFT:
            return navigateSideways(graph, personId, id.id, -1);
        case NAVIGATE_RIGHT:
            return navigateSideways(graph, personId, id.id, 1);
        default: {
            const unsupported: never = action;

            throw new Error(`Unsupported navigation action: ${String(unsupported)}`);
        }
    }
}

/**
 * Returns the persons of the node in the order they are drawn: from left to right.
 */
function nodePersons(graph: GraphBuilder, nodeId: string): string[] {
    const node = graph.getNodes().get(nodeId);
    if (!node) {
        return [];
    }

    return [node.persons.person1, node.persons.person2].filter((id): id is string => !!id);
}

function navigateUp(graph: GraphBuilder, family: Index, personId: string): NavigationTarget | null {
    // Only the person's own parents: the node may also hang below the spouse's parents.
    const parentsId = family.personParents.get(personId);
    if (!parentsId || !graph.contains(parentsId)) {
        return null;
    }

    const parent = nodePersons(graph, parentsId)[0];
    if (!parent) {
        return null;
    }

    return { personId: parent, nodeId: parentsId };
}

function navigateDown(graph: GraphBuilder, family: Index, nodeId: string): NavigationTarget | null {
    const node = graph.getNodes().get(nodeId);
    // Only a marriage node has children.
    if (!node || node.type !== MARRIAGE_NODE_TYPE) {
        return null;
    }

    const childNodes = graph.getChildren().get(nodeId) ?? [];
    let target: NavigationTarget | null = null;
    let targetPosition = Infinity;

    for (const childNodeId of childNodes) {
        const childNode = graph.getNodes().get(childNodeId);
        if (!childNode) {
            continue;
        }

        // The child node may be the child's marriage node: select the child, not their spouse.
        const child = nodePersons(graph, childNodeId).find(
            (id) => family.personParents.get(id) === nodeId,
        );
        if (!child) {
            continue;
        }

        const position = (graph.getLayers().get(childNode.layerNumber) ?? []).indexOf(childNodeId);
        if (position !== -1 && position < targetPosition) {
            targetPosition = position;
            target = { personId: child, nodeId: childNodeId };
        }
    }

    return target;
}

function navigateSideways(
    graph: GraphBuilder,
    personId: string,
    nodeId: string,
    direction: -1 | 1,
): NavigationTarget | null {
    // The spouse within the same marriage node comes first.
    const persons = nodePersons(graph, nodeId);
    const personIndex = persons.indexOf(personId);
    if (personIndex === -1) {
        return null;
    }

    const spouse = persons[personIndex + direction];
    if (spouse) {
        return { personId: spouse, nodeId };
    }

    const node = graph.getNodes().get(nodeId);
    if (!node) {
        return null;
    }

    const layer = graph.getLayers().get(node.layerNumber) ?? [];
    const position = layer.indexOf(nodeId);
    if (position === -1) {
        return null;
    }

    const neighborId = layer[position + direction];
    if (!neighborId) {
        return null;
    }

    // Entering a marriage node from the right selects its right person, and vice versa.
    const neighborPersons = nodePersons(graph, neighborId);
    const neighbor =
        direction > 0 ? neighborPersons[0] : neighborPersons[neighborPersons.length - 1];
    if (!neighbor) {
        return null;
    }

    return { personId: neighbor, nodeId: neighborId };
}
