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
export type MarriageNodeSide = 'none' | 'left_side' | 'right_side';

export type Person = {
    // Person MD file name without the extension.
    id: string;
    name: Name;
    birth?: Date;
    death?: Date;
    // Parents IDs.
    parents?: string[];
    // Children IDs.
    children?: string[];
    // Spouses IDs.
    spouses?: string[];
    // Avatar image to render in the person node.
    image?: string;
    file: TFile;

    // Rendering options.
    isParentNodesHidden: boolean;
    parentNodesFoldable: boolean;
    marriageNodeSide: MarriageNodeSide;
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

            if (!marriage) {
                marriages.push({
                    id: `${person.id}_${spouse_id}`,
                    parent1Id: person.id,
                    parent2Id: spouse_id,
                    childrenIds: [],
                });
            }
        }

        if (person.parents) {
            if (person.parents.length === 0 || person.parents.length > 2) {
                throw new Error(
                    `person ${person.id} has invalid number of parents: ${person.parents.length}`,
                );
            }

            if (!person.parents[0]) {
                throw new Error('at least one parent must present in the array');
            }

            let parentsMarriage = getMarriage(person.parents[0], marriages);

            if (!parentsMarriage) {
                parentsMarriage = {
                    id: `${person.parents[0]}_${person.parents[1] ?? 'Unknown'}`,
                    parent1Id: person.parents[0],
                    parent2Id: person.parents[1],
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
                marriages.push({
                    id: `${person.id}_unknown`,
                    parent1Id: person.id,
                    childrenIds: [],
                });
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
    // value - children ids
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
