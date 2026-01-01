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

    const ivan_h = { id: 'ivan_h', name: 'Ivan Hr' };
    const olena = { id: 'olena', name: 'Olena' };

    const oleksii_t = { id: 'oleksii_t', name: 'Oleksii T' };
    const hanna = { id: 'hanna', name: 'Hanna' };

    const yu_dada = { id: 'yu_dada', name: 'Yu Dada' };
    const yu_mama = { id: 'yu_mama', name: 'Yu Mama' };

    const da_data = { id: 'da_data', name: 'Da Data' };
    const da_mama = { id: 'da_mama', name: 'Da Mama' };

    const ku_data = { id: 'ku_data', name: 'Ku Data' };
    const ku_mama = { id: 'ku_mama', name: 'Ku Mama' };

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
    const ivan_hr_olena: Marriage = {
        id: 'ivan_hr_olena',
        parent1_id: ivan_h.id,
        parent2_id: olena.id,
        children_ids: [oleksii.id],
    };
    const oleksii_t_hanna: Marriage = {
        id: 'oleksii_t_hanna',
        parent1_id: oleksii_t.id,
        parent2_id: hanna.id,
        children_ids: [maria.id],
    };
    const yu_dada_yu_mama: Marriage = {
        id: 'yu_dada_yu_mama',
        parent1_id: yu_dada.id,
        parent2_id: yu_mama.id,
        children_ids: [yuhym.id],
    };
    const da_data_da_mama: Marriage = {
        id: 'da_data_da_mama',
        parent1_id: da_data.id,
        parent2_id: da_mama.id,
        children_ids: [davyd.id],
    };
    const ku_data_ku_mama: Marriage = {
        id: 'ku_data_ku_mama',
        parent1_id: ku_data.id,
        parent2_id: ku_mama.id,
        children_ids: [kulyna.id],
    };

    return {
        persons: [yaroslav, halia, oleksii, nina, ivan, maria, yuhym, prosia, davyd, kulyna, ivan_h, olena, oleksii_t, hanna, yu_dada, yu_mama, da_data, da_mama, ku_data, ku_mama],
        marriages: [yaroslav_halia, oleksii_nina, ivan_maria, yuhym_prosia, davyd_kulyna, ivan_hr_olena, oleksii_t_hanna, yu_dada_yu_mama, da_data_da_mama, ku_data_ku_mama],
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
