/**
 * The form the new person helper asks the user to fill in.
 *
 * It collects only what cannot be derived: the name parts and the dates. Every link follows from
 * the relation being added, so asking for them would just be another chance to make a mistake, and
 * so does the gender - except for a child, where the relation says nothing about it and the form
 * has to ask.
 *
 * @module view/AddRelativeModal
 */

import { App, Modal, Setting } from 'obsidian';

import { FEMALE, Gender, MALE, Person, UNDEFINED_GENDER, formatPersonName } from '../model';
import { DraftInput, PersonDraft, buildDraft, emptyDraftInput } from '../creation/page';
import {
    ADD_BROTHER,
    ADD_CHILD,
    ADD_PARENTS,
    ADD_SISTER,
    ADD_SPOUSE,
    RELATION_TITLE,
    RelationKind,
    RelativeRequest,
    genderFor,
} from '../creation/relatives';

/**
 * What the form says it is going to do, so the user can tell at a glance which person the new
 * relative is attached to.
 */
function relationHint(kind: RelationKind, person: Person): string {
    const name = formatPersonName(person);

    switch (kind) {
        case ADD_BROTHER:
            return `A new brother of ${name}, sharing both of their parents.`;
        case ADD_SISTER:
            return `A new sister of ${name}, sharing both of their parents.`;
        case ADD_SPOUSE:
            return `A new spouse of ${name}.`;
        case ADD_PARENTS:
            return `Both parents of ${name}. A person with only one parent is not supported, so both are required.`;
        case ADD_CHILD:
            return `A new child of ${name} and their spouse.`;
    }
}

/**
 * The gender options a child's form offers. Unknown is the default: it is what the page would say
 * if it were written by hand and left out, and it is better than a guess that looks deliberate.
 */
const GENDER_OPTIONS: Record<Gender, string> = {
    [UNDEFINED_GENDER]: 'Unknown',
    [MALE]: 'Male',
    [FEMALE]: 'Female',
};

export class AddRelativeModal extends Modal {
    private kind: RelationKind;
    private person: Person;
    private onSubmit: (request: RelativeRequest) => void;
    // One entry for a sibling, a spouse or a child, two for a pair of parents (father first).
    private inputs: DraftInput[];
    // Only ever read for a child; every other relation derives the gender.
    private childGender: Gender = UNDEFINED_GENDER;
    private errorEl: HTMLElement | null = null;

    constructor(
        app: App,
        kind: RelationKind,
        person: Person,
        onSubmit: (request: RelativeRequest) => void,
    ) {
        super(app);
        this.kind = kind;
        this.person = person;
        this.onSubmit = onSubmit;

        this.inputs =
            kind === ADD_PARENTS ? [emptyDraftInput(), emptyDraftInput()] : [emptyDraftInput()];

        // Siblings share a surname, so prefilling it saves a retype and a typo. A spouse or a
        // parent usually does not, which is why they start empty.
        if ((kind === ADD_BROTHER || kind === ADD_SISTER) && this.inputs[0]) {
            this.inputs[0].surname = person.name.surname;
        }
    }

    onOpen() {
        const { contentEl } = this;

        this.setTitle(RELATION_TITLE[this.kind]);
        contentEl.createEl('p', {
            cls: 'grafily-add-person-hint',
            text: relationHint(this.kind, this.person),
        });

        if (this.kind === ADD_PARENTS) {
            // Two parents, two columns: the forms are identical, so standing them next to each
            // other makes the pair obvious and keeps the modal short enough to take in at once.
            // The columns wrap back into a single one when the modal is too narrow for both.
            this.modalEl.addClass('grafily-add-person-modal');

            const columns = contentEl.createDiv({ cls: 'grafily-add-person-columns' });

            this.renderPersonFields(
                columns.createDiv({ cls: 'grafily-add-person-column' }),
                0,
                'Father',
            );
            this.renderPersonFields(
                columns.createDiv({ cls: 'grafily-add-person-column' }),
                1,
                'Mother',
            );
        } else {
            this.renderPersonFields(contentEl, 0);
        }

        this.errorEl = contentEl.createEl('p', { cls: 'grafily-add-person-error' });
        this.errorEl.hide();

        new Setting(contentEl)
            .addButton((btn) => btn.setButtonText('Cancel').onClick(() => this.close()))
            .addButton((btn) =>
                btn
                    .setButtonText('Add')
                    .setCta()
                    .onClick(() => this.submit()),
            );

        this.scope.register([], 'Enter', () => {
            this.submit();

            return false;
        });
    }

    onClose() {
        this.contentEl.empty();
    }

    private renderPersonFields(container: HTMLElement, position: number, heading?: string) {
        const input = this.inputs[position];
        if (!input) {
            return;
        }

        if (heading) {
            new Setting(container).setName(heading).setHeading();
        }

        const fields: [string, keyof DraftInput, string][] = [
            ['Name', 'name', 'Required'],
            ['Surname', 'surname', 'Required'],
            ['Parental name', 'parentalName', 'Optional'],
            ['Birth date', 'birth', 'YYYY-MM-DD, optional'],
            ['Death date', 'death', 'YYYY-MM-DD, optional'],
        ];

        for (const [label, key, placeholder] of fields) {
            new Setting(container).setName(label).addText((text) =>
                text
                    .setPlaceholder(placeholder)
                    .setValue(input[key])
                    .onChange((value) => {
                        input[key] = value;
                    }),
            );

            // Grouped with the name parts rather than with the dates: like them, it says who the
            // person is, and it decides how their node is drawn.
            if (key === 'parentalName' && this.kind === ADD_CHILD) {
                new Setting(container).setName('Gender').addDropdown((dropdown) => {
                    for (const [value, display] of Object.entries(GENDER_OPTIONS)) {
                        dropdown.addOption(value, display);
                    }

                    dropdown.setValue(this.childGender).onChange((value) => {
                        this.childGender = value as Gender;
                    });
                });
            }
        }
    }

    /**
     * The gender of the person at `position`, which every relation but a child derives.
     */
    private genderAt(position: number): Gender {
        if (this.kind === ADD_PARENTS) {
            return position === 0 ? MALE : FEMALE;
        }

        if (this.kind === ADD_CHILD) {
            return this.childGender;
        }

        return genderFor(this.kind, this.person.gender);
    }

    private showError(message: string) {
        if (!this.errorEl) {
            return;
        }

        this.errorEl.setText(message);
        this.errorEl.show();
    }

    /**
     * Validates every form in the modal and hands the result to the caller. Nothing is written
     * here: the modal only closes once the input is good enough to build pages from.
     */
    private submit() {
        const drafts: PersonDraft[] = [];

        for (const [position, input] of this.inputs.entries()) {
            const result = buildDraft(input, this.genderAt(position));
            if ('error' in result) {
                const prefix =
                    this.kind === ADD_PARENTS ? (position === 0 ? 'Father: ' : 'Mother: ') : '';

                this.showError(`${prefix}${result.error}`);

                return;
            }

            drafts.push(result.draft);
        }

        const [first, second] = drafts;
        if (!first) {
            return;
        }

        if (this.kind === ADD_PARENTS) {
            if (!second) {
                return;
            }

            this.onSubmit({ kind: ADD_PARENTS, father: first, mother: second });
        } else if (this.kind === ADD_SPOUSE) {
            this.onSubmit({ kind: ADD_SPOUSE, draft: first });
        } else {
            this.onSubmit({ kind: this.kind, draft: first });
        }

        this.close();
    }
}
