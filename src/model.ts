export type Person = {
    id: string,
    name: string,
};

export type Marriage = {
    id: string,
    parent1_id?: string,
    parent2_id?: string,
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

export type Index = {
    personById: Map<string, Person>;
    marriageById: Map<string, Marriage>,
    // key - person id
    // value - marriages involving this person
    personMarriages: Map<string, Marriage[]>;
    // key - parent id
    // value - children ids
    personChildren: Map<string, string[]>;
    // key - child id
    // value - parents marriage
    personParents: Map<string, string>;
};

export function buildIndex(family: Family): Index {
    const personById = new Map(family.persons.map(p => [p.id, p]));
    const marriageById = new Map(family.marriages.map(m => [m.id, m]));

    const personMarriages = new Map<string, Marriage[]>();
    const personChildren = new Map<string, string[]>();
    const personParents = new Map<string, string>();

    for (const marriage of family.marriages) {
        for (const parent_id of [marriage.parent1_id, marriage.parent2_id]) {
            if (!parent_id) {
                continue;
            }

            // Note: one person can marry many times: it is currently unsupported, but planned to support in the future.
            const parent_marriages = personMarriages.get(parent_id) ?? [];
            personMarriages.set(parent_id, [...parent_marriages, marriage]);
        }

        for (const childId of marriage.children_ids) {
            personParents.set(childId, marriage.id);

            for (const parentId of [marriage.parent1_id, marriage.parent2_id]) {
                if (!parentId) {
                    continue;
                }

                const children = (personChildren.get(parentId) ?? []);
                personChildren.set(
                    parentId,
                    [...children, childId]
                );
            }
        }
    }

    return { personById, marriageById, personMarriages, personChildren, personParents };
}
