/**
 * Adds a relative of a person already in the graph: creates their page and records the new
 * relation on every page it touches.
 *
 * A relation is symmetric, but a page can only state it from one side, and the plugin accepts
 * either side. This module writes both anyway, so the pages stay readable on their own: a new
 * sibling gets a `**Parents**` link *and* is listed under their parents' `**Children**`.
 *
 * @module creation/relatives
 */

import { App, TFile, normalizePath } from 'obsidian';

import { FEMALE, Gender, Index, MALE, UNDEFINED_GENDER, formatPersonName } from '../model';
import { LinkField, PersonDraft, addMetadataLinks, personFileName, renderPersonPage } from './page';

export const ADD_BROTHER = 'brother';
export const ADD_SISTER = 'sister';
export const ADD_SPOUSE = 'spouse';
export const ADD_PARENTS = 'parents';

/**
 * The relations the helper can add. A person with exactly one parent is not supported, so parents
 * are always added as a pair.
 */
export type RelationKind =
    | typeof ADD_BROTHER
    | typeof ADD_SISTER
    | typeof ADD_SPOUSE
    | typeof ADD_PARENTS;

/**
 * Menu and modal titles, as a `Record` so a new relation kind becomes a compile error here.
 */
export const RELATION_TITLE: Record<RelationKind, string> = {
    [ADD_BROTHER]: 'Add brother',
    [ADD_SISTER]: 'Add sister',
    [ADD_SPOUSE]: 'Add spouse',
    [ADD_PARENTS]: 'Add parents',
};

/**
 * A filled-in form, ready to be written to the vault.
 */
export type RelativeRequest =
    | {
          kind: typeof ADD_BROTHER | typeof ADD_SISTER | typeof ADD_SPOUSE;
          draft: PersonDraft;
      }
    | { kind: typeof ADD_PARENTS; father: PersonDraft; mother: PersonDraft };

/**
 * Returns the person's parents, or `null` when they have none.
 *
 * Both parents must be known: a half-recorded marriage cannot be the shared parents of a sibling.
 */
export function parentsOf(personId: string, index: Index): [string, string] | null {
    const marriageId = index.personParents.get(personId);
    if (!marriageId) {
        return null;
    }

    const marriage = index.marriageById.get(marriageId);
    if (!marriage?.parent1Id || !marriage.parent2Id) {
        return null;
    }

    return [marriage.parent1Id, marriage.parent2Id];
}

/**
 * Returns the person's spouse, or `null` when they are not married.
 */
export function spouseOf(personId: string, index: Index): string | null {
    for (const marriage of index.personMarriages.get(personId) ?? []) {
        const spouseId = marriage.parent1Id === personId ? marriage.parent2Id : marriage.parent1Id;

        if (spouseId) {
            return spouseId;
        }
    }

    return null;
}

/**
 * The gender a new relative gets. It follows from the relation, so the form does not ask for it:
 * a brother is male, a sister is female, and a spouse is the other gender than the person they
 * marry - unknown when the person's own gender is unknown.
 */
export function genderFor(kind: RelationKind, personGender: Gender): Gender {
    switch (kind) {
        case ADD_BROTHER:
            return MALE;
        case ADD_SISTER:
            return FEMALE;
        case ADD_PARENTS:
            // Handled per parent by the caller; a pair has no single gender.
            return UNDEFINED_GENDER;
        case ADD_SPOUSE:
            if (personGender === MALE) {
                return FEMALE;
            }
            if (personGender === FEMALE) {
                return MALE;
            }

            return UNDEFINED_GENDER;
    }
}

/**
 * Checks whether the relation can be added to the person at all.
 *
 * This is about the family, not about the form: the person page may simply not have what the
 * relation needs, and no amount of typing would fix it.
 *
 * @param {RelationKind} kind - The relation to add.
 * @param {string} personId - The person to add it to.
 * @param {Index} index - The current family index.
 * @returns {string | null} The message to show the user, or `null` when the relation is allowed.
 */
export function validateRelation(
    kind: RelationKind,
    personId: string,
    index: Index,
): string | null {
    const person = index.personById.get(personId);
    if (!person) {
        return `Grafily cannot find the page of the selected person ("${personId}").`;
    }

    const name = formatPersonName(person);

    switch (kind) {
        case ADD_BROTHER:
        case ADD_SISTER:
            if (!parentsOf(personId, index)) {
                return `Cannot add a sibling: ${name} has no parents. Add both parents first - a sibling is a person who shares them.`;
            }

            return null;
        case ADD_SPOUSE: {
            const spouseId = spouseOf(personId, index);
            if (spouseId) {
                const spouse = index.personById.get(spouseId);
                const spouseName = spouse ? formatPersonName(spouse) : spouseId;

                return `Cannot add a spouse: ${name} is already married to ${spouseName}. Only one spouse per person is supported.`;
            }

            return null;
        }
        case ADD_PARENTS:
            if (parentsOf(personId, index)) {
                return `Cannot add parents: ${name} already has both of them.`;
            }

            return null;
    }
}

function pagePath(dataDir: string, personId: string): string {
    return normalizePath(dataDir ? `${dataDir}/${personId}.md` : `${personId}.md`);
}

/**
 * Picks a free person id for the draft.
 *
 * The natural id is `<surname>_<name>_<parental name>`. When a page with that name is already in
 * the vault - or was just reserved by the same operation - a number is appended, because two
 * relatives may genuinely share all three name parts.
 */
function reserveFileName(
    app: App,
    dataDir: string,
    draft: PersonDraft,
    reserved: Set<string>,
): string {
    const base = personFileName(draft);

    let candidate = base;
    let attempt = 0;
    while (
        reserved.has(candidate) ||
        app.vault.getAbstractFileByPath(pagePath(dataDir, candidate))
    ) {
        attempt++;
        candidate = `${base}${attempt}`;
    }

    reserved.add(candidate);

    return candidate;
}

async function createPage(
    app: App,
    dataDir: string,
    personId: string,
    content: string,
): Promise<TFile> {
    if (dataDir && !app.vault.getFolderByPath(normalizePath(dataDir))) {
        await app.vault.createFolder(normalizePath(dataDir));
    }

    return app.vault.create(pagePath(dataDir, personId), content);
}

/**
 * Records links on an existing person page, leaving the rest of the page untouched.
 */
async function linkFromPage(
    app: App,
    index: Index,
    personId: string,
    field: LinkField,
    ids: string[],
): Promise<void> {
    const person = index.personById.get(personId);
    if (!person) {
        throw new Error(`cannot update the page of "${personId}": the page is not indexed`);
    }

    await app.vault.process(person.file, (content) => {
        try {
            return addMetadataLinks(content, field, ids);
        } catch (err) {
            throw new Error(
                `cannot update "${person.file.path}": ${err instanceof Error ? err.message : String(err)}`,
            );
        }
    });
}

/**
 * Creates the new person page (or pages) and records the relation on every page involved.
 *
 * The caller is expected to have run {@link validateRelation} already; it is run again here, so
 * that a stale form cannot write a family the plugin would refuse to load.
 *
 * @param {App} app - The Obsidian app.
 * @param {string} dataDir - The directory with person pages, from the plugin settings.
 * @param {Index} index - The current family index.
 * @param {string} personId - The person the relative is added to.
 * @param {RelativeRequest} request - The filled-in form.
 * @returns {Promise<TFile[]>} The created pages, in the order they should be opened.
 */
export async function createRelative(
    app: App,
    dataDir: string,
    index: Index,
    personId: string,
    request: RelativeRequest,
): Promise<TFile[]> {
    const error = validateRelation(request.kind, personId, index);
    if (error) {
        throw new Error(error);
    }

    const reserved = new Set<string>();

    switch (request.kind) {
        case ADD_BROTHER:
        case ADD_SISTER: {
            const parents = parentsOf(personId, index);
            if (!parents) {
                throw new Error('the selected person has no parents');
            }

            const siblingId = reserveFileName(app, dataDir, request.draft, reserved);
            const file = await createPage(
                app,
                dataDir,
                siblingId,
                renderPersonPage(request.draft, { parents }),
            );

            for (const parentId of parents) {
                // The whole children list is written when the parent page has no `**Children**`
                // field yet, so the new field does not read as "this is their only child".
                const children = [...(index.personChildren.get(parentId) ?? []), siblingId];

                await linkFromPage(app, index, parentId, 'Children', children);
            }

            return [file];
        }
        case ADD_SPOUSE: {
            const spouseId = reserveFileName(app, dataDir, request.draft, reserved);
            const file = await createPage(
                app,
                dataDir,
                spouseId,
                renderPersonPage(request.draft, { spouse: personId }),
            );

            await linkFromPage(app, index, personId, 'Spouse', [spouseId]);

            return [file];
        }
        case ADD_PARENTS: {
            // Both ids are reserved before either page is written, because the two pages link to
            // each other as spouses.
            const fatherId = reserveFileName(app, dataDir, request.father, reserved);
            const motherId = reserveFileName(app, dataDir, request.mother, reserved);

            const fatherFile = await createPage(
                app,
                dataDir,
                fatherId,
                renderPersonPage(request.father, { spouse: motherId, children: [personId] }),
            );
            const motherFile = await createPage(
                app,
                dataDir,
                motherId,
                renderPersonPage(request.mother, { spouse: fatherId, children: [personId] }),
            );

            await linkFromPage(app, index, personId, 'Parents', [fatherId, motherId]);

            return [fatherFile, motherFile];
        }
    }
}
