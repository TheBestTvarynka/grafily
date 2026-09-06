/**
 * This module creates the initial family tree: the pedigree of the perspective person plus all
 * of their descendants. It is the narrower sibling of the `graph` module of this directory -
 * same graph structure, fewer nodes in it.
 *
 * @module builder/tree
 */

import { MARRIAGE_NODE_TYPE, PERSON_NODE_TYPE, personIdToNodeId } from '../';
import { Marriage } from '../../model';
import { GraphBuilder } from './';
import { addChildren, personParents } from './graph';

/**
 * Appends the node to its layer, creating the layer when it is missing.
 *
 * Layer numbers are signed: the perspective person sits at layer 0 and every ancestor layer is
 * negative. `GraphBuilder.buildFamilyGraph` normalizes that to a dense array plus a `firstLayer`
 * offset when the graph is handed to a positioning algorithm.
 */
function pushToLayer(builder: GraphBuilder, layerNumber: number, nodeId: string) {
    const layer = builder.layers.get(layerNumber);

    if (layer) {
        layer.push(nodeId);
    } else {
        builder.layers.set(layerNumber, [nodeId]);
    }
}

/**
 * Records the parent/child relationship between an ancestor marriage and the node below it.
 */
function link(builder: GraphBuilder, parentId: string, childId: string) {
    builder.children.set(parentId, [...(builder.children.get(parentId) ?? []), childId]);
    builder.parents.set(childId, [...(builder.parents.get(childId) ?? []), parentId]);
}

/**
 * Adds the ancestors of the given persons to the graph, recursively.
 *
 * Unlike the initial graph building, an ancestor marriage here contributes exactly one child -
 * the node already on the path - so there are no siblings to place among. That is what makes
 * this walk so much simpler than `addParents`: no sides to pick, no placement search. Because
 * every marriage is appended to its layer before its own ancestors are visited, each subtree
 * occupies one contiguous left-to-right span of every layer it reaches, which is the same
 * property that keeps `addChildren` free of edge crossings.
 *
 * @param {GraphBuilder} builder - The builder to add the nodes to.
 * @param {string} childNodeId - The node whose ancestors we are adding. It is already in the graph.
 * @param {(string | undefined)[]} persons - The persons of that node whose parents to follow.
 * @param {number} layerNumber - The layer to place the parent marriages on.
 */
function addAncestors(
    builder: GraphBuilder,
    childNodeId: string,
    persons: (string | undefined)[],
    layerNumber: number,
) {
    for (const person of persons) {
        if (!person) {
            continue;
        }

        const marriage = personParents(builder, person);
        if (!marriage) {
            continue;
        }

        // A person reachable by two ancestral paths - a cousin marriage, say - is one node, not
        // two. Link it again so both descendants keep their edge, but do not walk it twice.
        const visited = builder.nodes.has(marriage.id);

        if (!visited) {
            builder.nodes.set(marriage.id, {
                id: marriage.id,
                type: MARRIAGE_NODE_TYPE,
                persons: {
                    person1: marriage.parent1Id,
                    person2: marriage.parent2Id,
                },
                layerNumber,
            });
            pushToLayer(builder, layerNumber, marriage.id);
        }

        link(builder, marriage.id, childNodeId);

        if (!visited) {
            // Both spouses of an ancestor marriage are blood ancestors of the perspective person,
            // so both of their lines continue upward.
            addAncestors(
                builder,
                marriage.id,
                [marriage.parent1Id, marriage.parent2Id],
                layerNumber - 1,
            );
        }
    }
}

/**
 * Builds the initial family tree for the given person: their whole pedigree and all of their
 * descendants.
 *
 * The tree contains strictly less than the initial graph does:
 * - Upward, only the perspective person's own ancestors. At the perspective marriage only their
 *   parents are followed, so the spouse's line stops there - the spouse is an in-law, not an
 *   ancestor. Above that both spouses of every marriage are followed, because both of them are
 *   blood ancestors: two parents, four grandparents, eight great-grandparents, and so on.
 * - Downward, every child of every marriage on the descendant path, exactly as the graph does.
 * - Nothing else: no siblings of the perspective person, and no siblings of any ancestor, which
 *   means no aunts, uncles or cousins.
 *
 * @param {GraphBuilder} builder - The builder to add the nodes to.
 * @param {string} perspectiveId - The ID of the person from whose perspective to build the tree.
 */
export function buildInitialTree(builder: GraphBuilder, perspectiveId: string) {
    const [id, marriage] = personIdToNodeId(perspectiveId, builder.family);

    const persons: Marriage | null = marriage;

    if (persons) {
        builder.nodes.set(id.id, {
            id: id.id,
            type: MARRIAGE_NODE_TYPE,
            persons: {
                person1: persons.parent1Id,
                person2: persons.parent2Id,
            },
            layerNumber: 0,
        });
    } else {
        builder.nodes.set(id.id, {
            id: id.id,
            type: PERSON_NODE_TYPE,
            persons: {
                person1: id.id,
            },
            layerNumber: 0,
        });
    }

    pushToLayer(builder, 0, id.id);

    // Only the perspective person's line, never the spouse's.
    addAncestors(builder, id.id, [perspectiveId], -1);

    if (marriage) {
        addChildren(builder, marriage, 1);
    }
}
