/**
 * The side panel button that adds a relative of the selected person.
 *
 * It is the glue between the graph and {@link module:creation/relatives}: a dropdown picks the
 * relation, a modal collects the names, and the created pages are opened for the user to fill in
 * the story behind them.
 *
 * @module view/AddRelativeButton
 */

import { MouseEvent } from 'react';
import { App, Menu, Notice, TFile, getIcon } from 'obsidian';

import { Index } from '../model';
import { useApp, useGraph } from '../hooks';
import {
    ADD_BROTHER,
    ADD_CHILD,
    ADD_PARENTS,
    ADD_SISTER,
    ADD_SPOUSE,
    RELATION_TITLE,
    RelationKind,
    RelativeRequest,
    createRelative,
    validateRelation,
} from '../creation/relatives';
import { AddRelativeModal } from './AddRelativeModal';

const MENU_ITEMS: { kind: RelationKind; icon: string }[] = [
    { kind: ADD_BROTHER, icon: 'user' },
    { kind: ADD_SISTER, icon: 'user' },
    { kind: ADD_SPOUSE, icon: 'heart' },
    { kind: ADD_PARENTS, icon: 'users' },
    { kind: ADD_CHILD, icon: 'baby' },
];

export type AddRelativeButtonProps = {
    personId: string;
    dataDir: string;
    // Rescans the vault, so that the next relation is validated against the pages just written.
    onCreated: () => Promise<void>;
};

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/**
 * Opens the created pages: the first one in a new tab, and a second one - a pair of parents - next
 * to it, so both can be filled in side by side.
 */
async function openPages(app: App, files: TFile[]): Promise<void> {
    const [first, second] = files;
    if (!first) {
        return;
    }

    const leaf = app.workspace.getLeaf(true);
    await leaf.openFile(first);

    if (second) {
        await app.workspace.createLeafBySplit(leaf, 'vertical').openFile(second);
    }
}

async function addRelative(
    app: App,
    dataDir: string,
    index: Index,
    personId: string,
    request: RelativeRequest,
    onCreated: () => Promise<void>,
): Promise<void> {
    const files = await createRelative(app, dataDir, index, personId, request);

    await onCreated();
    await openPages(app, files);

    const created = files.map((file) => file.basename).join('" and "');
    new Notice(`Created "${created}".`);
}

export function AddRelativeButton({ personId, dataDir, onCreated }: AddRelativeButtonProps) {
    const app = useApp();
    const graph = useGraph();

    const startRelation = (kind: RelationKind) => {
        if (!app || !graph) {
            return;
        }

        const { index } = graph;

        const person = index.personById.get(personId);
        if (!person) {
            new Notice(`Grafily cannot find the page of the selected person ("${personId}").`);

            return;
        }

        // Validated before the form is shown, so the user is not asked to type names that cannot
        // be used. `createRelative` checks again against the index it actually writes with.
        const error = validateRelation(kind, personId, index);
        if (error) {
            new Notice(error);

            return;
        }

        new AddRelativeModal(app, kind, person, (request) => {
            addRelative(app, dataDir, index, personId, request, onCreated).catch((err) => {
                console.error('Failed to add a relative:', err);
                new Notice(`Failed to add the person: ${errorMessage(err)}`);
            });
        }).open();
    };

    const openMenu = (event: MouseEvent<HTMLButtonElement>) => {
        const menu = new Menu();

        for (const { kind, icon } of MENU_ITEMS) {
            menu.addItem((item) =>
                item
                    .setTitle(RELATION_TITLE[kind])
                    .setIcon(icon)
                    .onClick(() => startRelation(kind)),
            );
        }

        menu.showAtMouseEvent(event.nativeEvent);
    };

    return (
        <button
            className="grafily-add-person-button"
            onClick={openMenu}
            title="Add a relative"
            dangerouslySetInnerHTML={{
                __html: getIcon('user-plus')?.outerHTML || '',
            }}
        />
    );
}
