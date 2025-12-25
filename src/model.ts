export type Person = {
    id: string,
    name: string,
};

export type Marriage = {
    id: string,
    parent1_id: string,
    parent2_id: string,
    children_ids: string[],
};

export type Family = {
    persons: Person[],
    marriages: Marriage[],
}

export function defaultFamily(): Family {
    const pavlo: Person = { id: '1', name: 'Pavlo' };
    const katia: Person = { id: '2', name: 'Katia' };

    const serhii: Person = { id: '3', name: 'Serhii' };
    const halina: Person = { id: '4', name: 'Halina' };

    const yaroslav: Person = { id: '5', name: 'Yaroslav' };
    const halia: Person = { id: '6', name: 'Halia' };

    const nastia: Person = { id: '7', name: 'Nastia' };
    const mykhailo: Person = { id: '8', name: 'Mykhailo' };
    const vita: Person = { id: '9', name: 'Vita' };

    const marriage_1: Marriage = { id: '1', parent1_id: pavlo.id, parent2_id: katia.id, children_ids: [] };
    const marriage_2: Marriage = { id: '2', parent1_id: yaroslav.id, parent2_id: halia.id, children_ids: [pavlo.id, nastia.id, mykhailo.id] };
    const marriage_3: Marriage = { id: '3', parent1_id: serhii.id, parent2_id: halina.id, children_ids: [vita.id, katia.id] };

    return {
        persons: [pavlo, katia, serhii, halina, yaroslav, halia, nastia, mykhailo, vita],
        marriages: [marriage_1, marriage_2, marriage_3],
    };
};

import { Node } from '@xyflow/react';

export function buildNodes(family: Index): Node[] {
    const nodes: Node[] = [];

    for (const person of family.personById.values()) {
        nodes.push({
            id: person.id,
            data: { label: person.name },
            position: { x: 100, y: 100 },
            type: 'personNode',
            style: {
                color: '#222',
            }
        });
    }

    for (const marriage of family.personMarriages.values()) {
        for (const m of marriage) {
            nodes.push({
                id: m.id,
                data: { label: '' },
                position: { x: 100, y: 100 },
                type: 'marriageNode',
                style: {
                    width: 10,
                    height: 10,
                    borderRadius: 4,
                    background: '#555',
                    fontSize: 8,
                    textAlign: 'center',
                },
            });
        }
    }

    return nodes;
}

export type Index = {
    personById: Map<string, Person>;
    // key - person id
    // value - marriages involving this person
    personMarriages: Map<string, Marriage[]>;
    // key - parent id
    // value - children ids
    personChildren: Map<string, string[]>;
    // key - child id
    // value - parent ids
    personParents: Map<string, string[]>;
};

export function buildIndex(family: Family): Index {
    const personById = new Map(family.persons.map(p => [p.id, p]));

    const personMarriages = new Map<string, Marriage[]>();
    const personChildren = new Map<string, string[]>();
    const personParents = new Map<string, string[]>();

    for (const marriage of family.marriages) {
        for (const parent_id of [marriage.parent1_id, marriage.parent2_id]) {
            // Note: one person can marry many times.
            const parent_marriages = personMarriages.get(parent_id) ?? [];
            personMarriages.set(parent_id, [...parent_marriages, marriage]);
        }

        for (const childId of marriage.children_ids) {
            personParents.set(childId, [marriage.parent1_id, marriage.parent2_id]);

            for (const parentId of [marriage.parent1_id, marriage.parent2_id]) {
                const children = (personChildren.get(parentId) ?? []);
                personChildren.set(
                    parentId,
                    [...children, childId]
                );
            }
        }
    }

    return { personById, personMarriages, personChildren, personParents };
}

// export function computeGenerations(
//     rootId: string,
//     index: Index
// ): Map<string, number> {
//     const gen = new Map<string, number>();
//     const queue: Array<{ id: string; g: number }> = [{ id: rootId, g: 0 }];
//     gen.set(rootId, 0);

//     while (queue.length) {
//         const { id, g } = queue.shift()!;

//         // parents
//         for (const pid of index.parentsByChild.get(id) ?? []) {
//             if (!gen.has(pid)) {
//                 gen.set(pid, g - 1);
//                 queue.push({ id: pid, g: g - 1 });
//             }
//         }

//         // children
//         for (const cid of index.childrenByParent.get(id) ?? []) {
//             if (!gen.has(cid)) {
//                 gen.set(cid, g + 1);
//                 queue.push({ id: cid, g: g + 1 });
//             }
//         }
//     }

//     return gen;
// }

// export function buildNodes(
//     gens: Map<string, number>,
//     index: Index
// ): Node[] {
//     const byGen = new Map<number, string[]>();

//     for (const [id, g] of gens) {
//         byGen.set(g, [...(byGen.get(g) ?? []), id]);
//     }

//     const nodes: Node[] = [];
//     const yGap = 120;
//     const xGap = 180;

//     for (const [g, ids] of byGen) {
//         ids.forEach((id, i) => {
//             nodes.push({
//                 id,
//                 data: { label: index.personById.get(id)!.name },
//                 position: { x: i * xGap, y: (g + 5) * yGap },
//                 type: 'default',
//             });
//         });
//     }

//     return nodes;
// }

// export function buildEdges(index: Index): Edge[] {
//   const edges: Edge[] = [];

//   for (const [parentId, children] of index.childrenByParent) {
//     for (const childId of children) {
//       edges.push({
//         id: `${parentId}-${childId}`,
//         source: parentId,
//         target: childId,
//       });
//     }
//   }

//   return edges;
// }

