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
    const yaroslav = { id: 'yaroslav', name: 'Yaroslav' };
    const halia = { id: 'halia', name: 'Halia' };

    const oleksii = { id: 'oleksii', name: 'Oleksii' };
    const nina = { id: 'nina', name: 'Nina' };

    const ivan = { id: 'ivan', name: 'Ivan' };
    const maria = { id: 'maria', name: 'Maria' };

    const yuhym = { id: 'yuhym', name: 'Yuhym' };
    const prosia = { id: 'prosia', name: 'Prosia' };

    const davyd = { id: 'davyd', name: 'Davyd' };
    const kulyna = { id: 'kulyna', name: 'Kulyna' };

    const yaroslav_halia: Marriage = {
        id: 'yaroslav_halia',
        parent1_id: yaroslav.id,
        parent2_id: halia.id,
        children_ids: [],
    };
    const oleksii_nina: Marriage = {
        id: 'oleksii_nina',
        parent1_id: oleksii.id,
        parent2_id: nina.id,
        children_ids: [yaroslav.id],
    };
    const ivan_maria: Marriage = {
        id: 'ivan_maria',
        parent1_id: ivan.id,
        parent2_id: maria.id,
        children_ids: [halia.id],
    };
    const yuhym_prosia: Marriage = {
        id: 'yuhym_prosia',
        parent1_id: yuhym.id,
        parent2_id: prosia.id,
        children_ids: [nina.id],
    };
    const davyd_kulyna: Marriage = {
        id: 'davyd_kulyna',
        parent1_id: davyd.id,
        parent2_id: kulyna.id,
        children_ids: [ivan.id],
    };

    return {
        persons: [yaroslav, halia, oleksii, nina, ivan, maria, yuhym, prosia, davyd, kulyna],
        marriages: [yaroslav_halia, oleksii_nina, ivan_maria, yuhym_prosia, davyd_kulyna],
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
