/**
 * Checks every person page in the data directory and reports the ones Grafily cannot use.
 *
 * The checks mirror what the rest of the plugin expects from a person page: `extractPageMeta`
 * for the page syntax, and `familyFromPersons` for the relationships between persons.
 *
 * @module scan
 */

import { App, TFile } from 'obsidian';

import { Date as PersonDate, Person } from './model';
import { extractPageMeta } from './parsing';

/**
 * A single invalid page within a {@link ScanCategory}.
 *
 * @property {TFile} file - The invalid page.
 * @property {string[]} details - What exactly is wrong with the page, one line per problem.
 */
export type ScanIssue = {
    file: TFile;
    details: string[];
};

/**
 * A group of pages that are invalid for the same reason.
 */
export type ScanCategory = {
    title: string;
    description: string;
    issues: ScanIssue[];
};

/**
 * The result of scanning the data directory.
 *
 * *Note*: one page can be listed in several categories, so `invalid` counts every page once
 * rather than summing the categories.
 */
export type ScanReport = {
    dataDir: string;
    total: number;
    invalid: number;
    categories: ScanCategory[];
};

type ParsedPage = { file: TFile; person: Person } | { file: TFile; error: string };

/**
 * Formats a list of person links the way the user wrote them, so they can find them on the page.
 */
function formatLinks(ids: string[]): string {
    return ids.map((id) => (id ? `[[${id}]]` : '(empty link)')).join(', ');
}

/**
 * Returns `true` when the date has a part that is not a number or is out of range.
 * A missing part is fine: the metadata format allows partial dates like `1990` or `1990-05`.
 */
function isInvalidDate(date?: PersonDate): boolean {
    if (!date) {
        return false;
    }

    const isInRange = (value: number | undefined, min: number, max: number) =>
        value === undefined || (Number.isInteger(value) && value >= min && value <= max);

    return (
        !isInRange(date.year, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER) ||
        !isInRange(date.month, 1, 12) ||
        !isInRange(date.day, 1, 31)
    );
}

async function parsePage(app: App, file: TFile): Promise<ParsedPage> {
    try {
        const content = await app.vault.cachedRead(file);

        return { file, person: extractPageMeta(content, file.basename, file) };
    } catch (err) {
        return { file, error: err instanceof Error ? err.message : String(err) };
    }
}

/**
 * Scans every `.md` page in the data directory and sorts the invalid ones into categories.
 *
 * @param {App} app - The Obsidian app.
 * @param {string} dataDir - The directory with person pages, taken from the plugin settings.
 * @returns {Promise<ScanReport>} The scan report.
 */
export async function scanPersonPages(app: App, dataDir: string): Promise<ScanReport> {
    const files = app.vault
        .getFiles()
        .filter((file) => file.path.startsWith(dataDir) && file.extension === 'md');

    const pages = await Promise.all(files.map((file) => parsePage(app, file)));

    const syntax: ScanCategory = {
        title: 'Invalid syntax',
        description: 'The page does not follow the person metadata format.',
        issues: [],
    };
    const parents: ScanCategory = {
        title: 'Invalid number of parents',
        description: 'A person must have either no parents or exactly two.',
        issues: [],
    };
    const childrenWithoutSpouse: ScanCategory = {
        title: 'Children without a spouse',
        description:
            'The person has children, but no spouse is set on their page or on any other page.',
        issues: [],
    };
    const spouses: ScanCategory = {
        title: 'More than one spouse',
        description: 'Only one spouse per person is supported.',
        issues: [],
    };
    const brokenLinks: ScanCategory = {
        title: 'Broken links',
        description: `A parent, spouse, or child link does not lead to a valid person page in "${dataDir}".`,
        issues: [],
    };
    const dates: ScanCategory = {
        title: 'Invalid dates',
        description: 'Birth and death dates must be in the <year>-<month>-<day> format.',
        issues: [],
    };

    const persons: Person[] = [];
    const invalidPageIds = new Set<string>();

    for (const page of pages) {
        if ('error' in page) {
            syntax.issues.push({ file: page.file, details: [page.error] });
            invalidPageIds.add(page.file.basename);
        } else {
            persons.push(page.person);
        }
    }

    const personIds = new Set(persons.map((person) => person.id));

    // One spouse link is enough to form a marriage, so a person is married when either their own
    // page or their spouse's page has the link.
    const marriedIds = new Set<string>();
    for (const person of persons) {
        for (const spouseId of person.spouses ?? []) {
            if (spouseId) {
                marriedIds.add(person.id);
                marriedIds.add(spouseId);
            }
        }
    }

    for (const person of persons) {
        const { file } = person;

        if (person.parents && person.parents.length !== 2) {
            parents.issues.push({
                file,
                details: [
                    `${person.parents.length} parent(s) listed: ${formatLinks(person.parents)}`,
                ],
            });
        }

        if (person.children && person.children.length > 0 && !marriedIds.has(person.id)) {
            childrenWithoutSpouse.issues.push({
                file,
                details: [`Children: ${formatLinks(person.children)}`],
            });
        }

        if (person.spouses && person.spouses.length > 1) {
            spouses.issues.push({
                file,
                details: [`Spouses: ${formatLinks(person.spouses)}`],
            });
        }

        const linkProblems: string[] = [];
        const links: [string, string[] | undefined][] = [
            ['Parents', person.parents],
            ['Spouse', person.spouses],
            ['Children', person.children],
        ];
        for (const [field, ids] of links) {
            for (const id of ids ?? []) {
                if (!id) {
                    linkProblems.push(`${field}: empty link`);
                } else if (invalidPageIds.has(id)) {
                    linkProblems.push(`${field}: [[${id}]] is not a valid person page`);
                } else if (!personIds.has(id)) {
                    linkProblems.push(`${field}: [[${id}]] does not exist`);
                }
            }
        }
        if (linkProblems.length > 0) {
            brokenLinks.issues.push({ file, details: linkProblems });
        }

        const dateProblems: string[] = [];
        if (isInvalidDate(person.birth)) {
            dateProblems.push('Birth date is invalid');
        }
        if (isInvalidDate(person.death)) {
            dateProblems.push('Death date is invalid');
        }
        if (dateProblems.length > 0) {
            dates.issues.push({ file, details: dateProblems });
        }
    }

    const categories = [syntax, parents, childrenWithoutSpouse, spouses, brokenLinks, dates];
    const invalidPaths = new Set(
        categories.flatMap((category) => category.issues.map((issue) => issue.file.path)),
    );

    return {
        dataDir,
        total: files.length,
        invalid: invalidPaths.size,
        categories,
    };
}
