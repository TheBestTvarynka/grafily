/**
 * Builds the markdown of a new person page and edits the metadata block of an existing one.
 *
 * Everything here works on strings only: no vault access, no Obsidian API. The metadata format
 * these functions write is the one {@link module:parsing} reads back, so a page created here is
 * immediately usable by the rest of the plugin.
 *
 * @module creation/page
 */

import { Gender, UNDEFINED_GENDER } from '../model';
import { stripLinkBrackets } from '../parsing';

/**
 * Stands in for a parental name the user did not provide, so that a page always has a three-part
 * file name and two persons with the same surname and name still get distinct ids.
 */
export const UNKNOWN_PARENTAL_NAME = '???';

/**
 * Characters that must not appear in a name part: Obsidian rejects them in file names, and
 * `#^[]|` additionally breaks the `[[...]]` links the metadata is made of. Whitespace is excluded
 * too, because the page title is split on spaces when it is parsed back.
 */
const FORBIDDEN_NAME_CHARS = /[*"\\/<>:|?#^[\]\s]/;

/**
 * The metadata fields that hold links to other persons.
 */
export type LinkField = 'Spouse' | 'Parents' | 'Children';

/**
 * Everything needed to render a new person page, apart from their relations.
 *
 * Dates are kept as the strings that go onto the page (`<year>[-<month>[-<day>]]`), because the
 * metadata format allows partial dates that a `Date` cannot express.
 */
export type PersonDraft = {
    name: string;
    surname: string;
    parentalName?: string;
    birth?: string;
    death?: string;
    gender: Gender;
};

/**
 * The links to put on a new person's page.
 */
export type PersonRelations = {
    spouse?: string;
    parents?: string[];
    children?: string[];
};

/**
 * What the user typed into the new person form, before any validation.
 */
export type DraftInput = {
    name: string;
    surname: string;
    parentalName: string;
    birth: string;
    death: string;
};

/**
 * An empty form.
 */
export function emptyDraftInput(): DraftInput {
    return { name: '', surname: '', parentalName: '', birth: '', death: '' };
}

/**
 * Returns the person id (the page file name without the extension) for a draft.
 */
export function personFileName(draft: PersonDraft): string {
    return `${draft.surname}_${draft.name}_${draft.parentalName ?? UNKNOWN_PARENTAL_NAME}`;
}

/**
 * The shortcut buttons code block, rendered at the end of the metadata block. `addMetadataLinks`
 * keeps later fields above it, so it stays the last thing before the `---` separator.
 */
const NAVIGATION_BLOCK = ['```grafily-navigation', '```'];

function formatLinkField(field: LinkField, ids: string[]): string {
    return `**${field}**: ${ids.map((id) => `[[${id}]]`).join(', ')}`;
}

/**
 * Renders a complete person page.
 *
 * Optional fields are left out rather than written empty, so the page reads like a hand-written
 * one. The parental name is omitted from the title when it is unknown: `parseName` accepts a
 * two-part title, and a `???` in the title would only be noise.
 *
 * The page also gets a {@link NAVIGATION_BLOCK}, so the new person can be used as a starting
 * point for a graph straight away.
 *
 * @param {PersonDraft} draft - The person to render.
 * @param {PersonRelations} relations - The links to put on the page.
 * @returns {string} The page content.
 */
export function renderPersonPage(draft: PersonDraft, relations: PersonRelations): string {
    const title = [draft.surname, draft.name, draft.parentalName].filter(Boolean).join(' ');
    const lines = [`# ${title}`, ''];

    if (draft.gender !== UNDEFINED_GENDER) {
        lines.push(`**Gender**: ${draft.gender}`);
    }
    if (draft.birth) {
        lines.push(`**Birth**: ${draft.birth}`);
    }
    if (draft.death) {
        lines.push(`**Death**: ${draft.death}`);
    }
    if (relations.spouse) {
        lines.push(formatLinkField('Spouse', [relations.spouse]));
    }
    if (relations.parents && relations.parents.length > 0) {
        lines.push(formatLinkField('Parents', relations.parents));
    }
    if (relations.children && relations.children.length > 0) {
        lines.push(formatLinkField('Children', relations.children));
    }

    lines.push('', ...NAVIGATION_BLOCK, '', '---', '');

    return lines.join('\n');
}

/**
 * Adds links to a metadata field of an existing person page.
 *
 * The links already on the page are kept: a relation can be recorded on either side, so the page
 * may well list some of them already. When the page has no such field yet, it is appended to the
 * end of the metadata block.
 *
 * @param {string} content - The current page content.
 * @param {LinkField} field - The field to add the links to.
 * @param {string[]} ids - The person ids to link.
 * @returns {string} The updated page content, or `content` itself when every link was there.
 */
export function addMetadataLinks(content: string, field: LinkField, ids: string[]): string {
    const lines = content.split('\n');
    const metaEnd = lines.findIndex((line) => line.trim() === '---');

    if (metaEnd === -1) {
        throw new Error("missing meta block separator ('---')");
    }

    const marker = `**${field}**`;
    const fieldLine = lines.findIndex((line, i) => i < metaEnd && line.trim().startsWith(marker));

    if (fieldLine !== -1) {
        // SAFE: `findIndex` returned this index.
        const existing = parseLinkField(lines[fieldLine]!);
        const added = ids.filter((id) => !existing.includes(id));

        if (added.length === 0) {
            return content;
        }

        lines[fieldLine] = formatLinkField(field, [...existing, ...added]);

        return lines.join('\n');
    }

    // The new field goes right after the last field already on the page, so the metadata stays in
    // one block. The block may hold more than metadata - a `grafily-navigation` code block, for
    // instance - and a field appended after that would read as page content.
    let insertAt = -1;
    for (let i = 0; i < metaEnd; i++) {
        if (lines[i]?.trim().startsWith('**')) {
            insertAt = i + 1;
        }
    }

    const newLines = [formatLinkField(field, ids)];
    if (insertAt === -1) {
        // No fields yet: the title is all there is, so start the block right after it, keeping
        // the blank line that separates the two.
        insertAt = 1;
        newLines.unshift('');
    }

    lines.splice(insertAt, 0, ...newLines);

    return lines.join('\n');
}

function parseLinkField(line: string): string[] {
    return (line.split(':')[1] ?? '')
        .split(',')
        .map(stripLinkBrackets)
        .filter((id) => id.length > 0);
}

/**
 * Normalizes a date the user typed.
 *
 * The metadata format allows partial dates, so `1990`, `1990-05` and `1990-05-17` are all
 * accepted; the month and day are padded to two digits to match how the rest of a vault is
 * usually written.
 *
 * @param {string} value - The date as typed.
 * @returns {string | null} The normalized date, or `null` when the value is not a date.
 */
export function normalizeDate(value: string): string | null {
    const match = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(value.trim());
    if (!match) {
        return null;
    }

    // SAFE: the year group is not optional, so the regex cannot match without it.
    const year = match[1]!;
    const month = match[2];
    const day = match[3];

    if (month !== undefined && (+month < 1 || +month > 12)) {
        return null;
    }
    if (day !== undefined && (+day < 1 || +day > 31)) {
        return null;
    }

    const parts = [year];
    if (month !== undefined) {
        parts.push(month.padStart(2, '0'));
    }
    if (day !== undefined) {
        parts.push(day.padStart(2, '0'));
    }

    return parts.join('-');
}

/**
 * Orders two normalized, possibly partial dates. Missing parts count as zero, so `1990` sorts
 * before `1990-05`, which is what a "died before they were born" check needs.
 */
function dateOrder(date: string): number {
    const [year, month, day] = date.split('-');

    return (+(year ?? 0) * 100 + +(month ?? 0)) * 100 + +(day ?? 0);
}

/**
 * The outcome of validating one filled-in form: either a draft ready to be written, or the first
 * problem to show the user.
 */
export type DraftResult = { draft: PersonDraft } | { error: string };

/**
 * Validates a filled-in form and turns it into a {@link PersonDraft}.
 *
 * @param {DraftInput} input - What the user typed.
 * @param {Gender} gender - The gender implied by the relation being added.
 * @returns {DraftResult} The draft, or the first problem found.
 */
export function buildDraft(input: DraftInput, gender: Gender): DraftResult {
    const name = input.name.trim();
    const surname = input.surname.trim();
    const parentalName = input.parentalName.trim();

    for (const [label, value] of [
        ['Name', name],
        ['Surname', surname],
    ] as const) {
        if (!value) {
            return { error: `${label} is required.` };
        }
    }

    for (const [label, value] of [
        ['Name', name],
        ['Surname', surname],
        ['Parental name', parentalName],
    ] as const) {
        if (value && FORBIDDEN_NAME_CHARS.test(value)) {
            return { error: `${label} must be a single word without * " \\ / < > : | ? # ^ [ ].` };
        }
    }

    const dates: { birth?: string; death?: string } = {};
    for (const [label, key, value] of [
        ['Birth date', 'birth', input.birth],
        ['Death date', 'death', input.death],
    ] as const) {
        if (!value.trim()) {
            continue;
        }

        const date = normalizeDate(value);
        if (!date) {
            return { error: `${label} must be in the <year>-<month>-<day> format.` };
        }

        dates[key] = date;
    }

    if (dates.birth && dates.death && dateOrder(dates.death) < dateOrder(dates.birth)) {
        return { error: 'Death date must not be earlier than the birth date.' };
    }

    return {
        draft: {
            name,
            surname,
            ...(parentalName ? { parentalName } : {}),
            ...dates,
            gender,
        },
    };
}
