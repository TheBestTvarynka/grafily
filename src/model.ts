import { TFile } from 'obsidian';

export type Name = {
    surname: string;
    name: string;
    parentalName?: string;
};

export type Date = {
    day?: number;
    month?: number;
    year?: number;
};

export const LEFT_SIDE = 'left_side';
export const RIGHT_SIDE = 'right_side';
export const NONE_SIDE = 'none';
export type MarriageNodeSide = typeof NONE_SIDE | typeof LEFT_SIDE | typeof RIGHT_SIDE;

export const MALE = 'male';
export const FEMALE = 'female';
export const UNDEFINED_GENDER = 'UNDEFINED';
export type Gender = typeof MALE | typeof FEMALE | typeof UNDEFINED_GENDER;

export type Person = {
    // Person MD file name without the extension.
    id: string;
    name: Name;
    birth?: Date;
    death?: Date;
    gender: Gender;
    // Parents IDs.
    parents?: string[];
    // Children IDs.
    children?: string[];
    // Spouses IDs.
    // Currently, only one spouse per person is supported.
    spouses?: string[];
    // Avatar image to render in the person node.
    image?: string;
    file: TFile;
};

export type Marriage = {
    id: string;
    parent1Id?: string;
    parent2Id?: string;
    childrenIds: string[];
};

export type Family = {
    persons: Person[];
    marriages: Marriage[];
};

export function familyFromPersons(persons: Person[]): Family {
    const marriages: Marriage[] = [];

    const findMarriages = (person_id: string) =>
        marriages.filter(
            (marriage) => marriage.parent1Id === person_id || marriage.parent2Id === person_id,
        );
    const getMarriage = (person_id: string, marriages: Marriage[]) =>
        marriages.find(
            (marriage) => marriage.parent1Id === person_id || marriage.parent2Id === person_id,
        );

    for (const person of persons) {
        const personMarriages = findMarriages(person.id);

        if (person.spouses) {
            if (person.spouses.length > 1) {
                throw new Error(
                    `many spouses are not supported yet: person (${person.id}) has ${person.spouses.length} spouses`,
                );
            }

            if (!person.spouses[0]) {
                throw new Error(`expected ${person.id} to have at least one spouse`);
            }

            const spouse_id = person.spouses[0];
            const marriage = getMarriage(spouse_id, personMarriages);

            // We must ensure the order of the parents in the marriage is consistent.
            const [person1, person2] =
                person.id.localeCompare(spouse_id) > 0
                    ? [spouse_id, person.id]
                    : [person.id, spouse_id];

            if (!marriage) {
                marriages.push({
                    id: `${person1}_${person2}`,
                    parent1Id: person.id,
                    parent2Id: spouse_id,
                    childrenIds: [],
                });
            }
        }

        if (person.parents) {
            if (person.parents.length !== 2) {
                throw new Error(
                    `person ${person.id} has invalid number of parents: ${person.parents.length}`,
                );
            }

            // SAFE: we already checked that person.parents.length === 2.
            const parent1 = person.parents[0]!;
            // SAFE: we already checked that person.parents.length === 2.
            const parent2 = person.parents[1]!;

            let parentsMarriage = getMarriage(person.parents[0]!, marriages);

            if (!parentsMarriage) {
                // We must ensure the order of the parents in the marriage is consistent.
                const [person1, person2] =
                    parent1.localeCompare(parent2) > 0 ? [parent2, parent1] : [parent1, parent2];

                parentsMarriage = {
                    id: `${person1}_${person2}`,
                    parent1Id: parent1,
                    parent2Id: parent2,
                    childrenIds: [person.id],
                };
                marriages.push(parentsMarriage);
            }

            if (person.parents[1]) {
                if (parentsMarriage.parent1Id === person.parents[0]) {
                    parentsMarriage.parent2Id = person.parents[1];
                }

                if (parentsMarriage.parent2Id === person.parents[0]) {
                    parentsMarriage.parent1Id = person.parents[1];
                }
            }

            // Avoid repetitions.
            if (parentsMarriage.childrenIds.indexOf(person.id) === -1) {
                parentsMarriage.childrenIds.push(person.id);
            }
        }

        if (person.children && person.children.length > 0) {
            const personMarriage = findMarriages(person.id)[0];

            if (!personMarriage) {
                throw new Error(
                    `person ${person.id} has children but no marriage (no spouse specified)`,
                );
            }

            const marriage = findMarriages(person.id)[0];
            if (!marriage) {
                throw new Error('person must have marriage at this point');
            }

            for (const child_id of person.children) {
                // Avoid repetitions.
                if (marriage.childrenIds.indexOf(child_id) === -1) {
                    marriage.childrenIds.push(child_id);
                }
            }
        }
    }

    return {
        persons,
        marriages,
    };
}

export type Index = {
    personById: Map<string, Person>;
    marriageById: Map<string, Marriage>;
    // key - person id
    // value - marriages involving this person.
    // *Note*: currently, one person can marry only once.
    personMarriages: Map<string, Marriage[]>;
    // key - parent id
    // value - children ids (always person ids).
    personChildren: Map<string, string[]>;
    // key - child id
    // value - parents marriage id
    personParents: Map<string, string>;
};

export function emptyIndex(): Index {
    return {
        personById: new Map(),
        marriageById: new Map(),
        personMarriages: new Map(),
        personChildren: new Map(),
        personParents: new Map(),
    };
}

export function buildIndex(family: Family): Index {
    const personById = new Map(family.persons.map((p) => [p.id, p]));
    const marriageById = new Map(family.marriages.map((m) => [m.id, m]));

    const personMarriages = new Map<string, Marriage[]>();
    const personChildren = new Map<string, string[]>();
    const personParents = new Map<string, string>();

    for (const marriage of family.marriages) {
        for (const parent_id of [marriage.parent1Id, marriage.parent2Id]) {
            if (!parent_id) {
                continue;
            }

            // Note: one person can marry many times: it is currently unsupported, but planned to support in the future.
            const parent_marriages = personMarriages.get(parent_id) ?? [];
            personMarriages.set(parent_id, [...parent_marriages, marriage]);
        }

        for (const childId of marriage.childrenIds) {
            personParents.set(childId, marriage.id);

            for (const parentId of [marriage.parent1Id, marriage.parent2Id]) {
                if (!parentId) {
                    continue;
                }

                const children = personChildren.get(parentId) ?? [];
                personChildren.set(parentId, [...children, childId]);
            }
        }
    }

    return {
        personById,
        marriageById,
        personMarriages,
        personChildren,
        personParents,
    };
}
