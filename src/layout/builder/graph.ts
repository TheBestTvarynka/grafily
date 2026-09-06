/**
 * This module creates the initial family graph: every ancestor and descendant of the perspective
 * person, together with the siblings of all of them. See the `tree` module of this directory for
 * the narrower pedigree.
 *
 * @module builder/graph
 */

import { MARRIAGE_NODE_TYPE, NodePersons, PERSON_NODE_TYPE, personIdToNodeId } from '../';
import { LEFT_SIDE, Marriage, RIGHT_SIDE } from '../../model';
import { GraphBuilder } from './';

const MIDDLE_SIDE = 'middle_side';

/**
 * During the initial graph building (initial parents expanding), we need to determine
 * where to place the caller child among its siblings. This type represents the side
 * where the caller child should be placed.
 */
type ChildSide = typeof LEFT_SIDE | typeof MIDDLE_SIDE | typeof RIGHT_SIDE;

interface CallerChild {
    side: ChildSide;
    childId: string;
}

/**
 * Returns the parents marriage of the person with the given ID. If the person has no parents, returns null.
 *
 * @param {string} personId - The ID of the person to convert.
 * @returns {Marriage | null} - The parents marriage of the person, or null if the person has no parents.
 */
export function personParents(builder: GraphBuilder, personId: string): Marriage | null {
    const marriageId = builder.family.personParents.get(personId);
    if (!marriageId) {
        return null;
    }

    const marriage = builder.family.marriageById.get(marriageId);
    if (!marriage) {
        throw new Error(`Marriage ${marriageId} should exist`);
    }

    return marriage;
}

/**
 * Builds the initial graph for the given person's perspective. The initial graph contain all parents and children of the given person.
 * Also, siblings of all ancestors and descendants are included in the graph.
 *
 * @param {string} perspectiveId - The ID of the person from whose perspective to build the graph.
 */
export function buildInitialGraph(builder: GraphBuilder, perspectiveId: string) {
    let [id, marriage] = personIdToNodeId(perspectiveId, builder.family);

    const layerNumber = 0;

    if (marriage) {
        addParents(builder, null, marriage, layerNumber);
        addChildren(builder, marriage, layerNumber + 1);
    } else {
        const parents = personParents(builder, id.id);
        if (parents) {
            addParents(builder, { side: MIDDLE_SIDE, childId: id.id }, parents, -1);
        } else {
            if (!builder.layers.has(layerNumber)) {
                builder.layers.set(layerNumber, []);
            }
            // SAFE: if the layer does not exist, we will create it above.
            const layer = builder.layers.get(layerNumber)!;
            layer.push(id.id);
            builder.nodes.set(id.id, {
                id: id.id,
                type: PERSON_NODE_TYPE,
                persons: {
                    person1: id.id,
                },
                layerNumber,
            });
        }
    }
}

export function addChildren(
    builder: GraphBuilder,
    parentsMarriage: Marriage,
    childrenLayerNumber: number,
) {
    if (!parentsMarriage.childrenIds.length) {
        return;
    }

    if (!builder.layers.get(childrenLayerNumber)) {
        builder.layers.set(childrenLayerNumber, []);
    }
    // SAFE: if the layer does not exist, we create it above.
    const layer = builder.layers.get(childrenLayerNumber)!;

    if (!builder.children.has(parentsMarriage.id)) {
        builder.children.set(parentsMarriage.id, []);
    }
    // SAFE: if the children of the marriage does not exist, we initialize it above.
    const children = builder.children.get(parentsMarriage.id)!;

    for (const childId of parentsMarriage.childrenIds) {
        const [id, marriage] = personIdToNodeId(childId, builder.family);

        const persons: NodePersons = {};
        if (marriage) {
            if (marriage.parent1Id) {
                persons.person1 = marriage.parent1Id;
            }
            if (marriage.parent2Id) {
                persons.person2 = marriage.parent2Id;
            }
        } else {
            persons.person1 = id.id;
        }

        builder.nodes.set(id.id, {
            id: id.id,
            type: id.type,
            persons,
            layerNumber: childrenLayerNumber,
        });

        if (!builder.parents.has(id.id)) {
            builder.parents.set(id.id, []);
        }
        const parents = builder.parents.get(id.id)!;

        parents.push(parentsMarriage.id);
        children.push(id.id);
        layer.push(id.id);

        if (marriage) {
            addChildren(builder, marriage, childrenLayerNumber + 1);
        }
    }
}

function addParents(
    builder: GraphBuilder,
    caller: CallerChild | null,
    marriage: Marriage,
    layerNumber: number,
) {
    const id = marriage.id;

    let p1ParentsExist = false;
    let p2ParentsExist = false;
    if (marriage.parent1Id) {
        let p1Parents = personParents(builder, marriage.parent1Id);

        if (p1Parents) {
            p1ParentsExist = true;
            let side: ChildSide;
            if (marriage.parent2Id && personParents(builder, marriage.parent2Id)) {
                side = RIGHT_SIDE;
            } else {
                side = MIDDLE_SIDE;
            }

            addParents(builder, { side, childId: marriage.parent1Id }, p1Parents, layerNumber - 1);
        }
    }

    if (marriage.parent2Id) {
        let p2Parents = personParents(builder, marriage.parent2Id);

        if (p2Parents) {
            if (p1ParentsExist) {
                const layer = builder.layers.get(layerNumber)!;
                layer.pop();
            }

            p2ParentsExist = true;
            let side: ChildSide;
            if (marriage.parent1Id && personParents(builder, marriage.parent1Id)) {
                side = LEFT_SIDE;
            } else {
                side = MIDDLE_SIDE;
            }

            addParents(builder, { side, childId: marriage.parent2Id }, p2Parents, layerNumber - 1);
        }
    }

    if (!builder.layers.has(layerNumber)) {
        builder.layers.set(layerNumber, []);
    }
    // SAFE: if the layer does not exist, we will create it above.
    const layer = builder.layers.get(layerNumber)!;

    if (!p1ParentsExist && !p2ParentsExist) {
        layer.push(id);
        builder.nodes.set(id, {
            id,
            type: MARRIAGE_NODE_TYPE,
            persons: {
                person1: marriage.parent1Id,
                person2: marriage.parent2Id,
            },
            layerNumber,
        });
    }

    if (caller) {
        if (!builder.layers.has(layerNumber + 1)) {
            builder.layers.set(layerNumber + 1, []);
        }
        // SAFE: if the layer does not exist, we will create it above.
        const childrenLayer = builder.layers.get(layerNumber + 1)!;

        if (!builder.children.get(id)) {
            builder.children.set(id, []);
        }
        // SAFE: if the children of the marriage does not exist, we will initialize it above.
        const children = builder.children.get(id)!;

        const childrenIds = marriage.childrenIds.filter((childId) => childId !== caller.childId);
        if (caller.side === LEFT_SIDE) {
            childrenIds.splice(0, 0, caller.childId);
        } else if (caller.side === RIGHT_SIDE) {
            childrenIds.push(caller.childId);
        } else {
            childrenIds.splice(Math.ceil(childrenIds.length / 2), 0, caller.childId);
        }

        for (const childId of childrenIds) {
            const [childNodeId, childMarriage] = personIdToNodeId(childId, builder.family);
            childrenLayer.push(childNodeId.id);

            const persons: NodePersons =
                childNodeId.type === MARRIAGE_NODE_TYPE
                    ? {
                          person1: childMarriage!.parent1Id,
                          person2: childMarriage!.parent2Id,
                      }
                    : { person1: childNodeId.id };
            builder.nodes.set(childNodeId.id, {
                id: childNodeId.id,
                type: childNodeId.type,
                persons,
                layerNumber: layerNumber + 1,
            });

            children.push(childNodeId.id);

            if (!builder.parents.get(childNodeId.id)) {
                builder.parents.set(childNodeId.id, []);
            }
            const childParents = builder.parents.get(childNodeId.id)!;
            childParents.push(id);
        }
    }
}
