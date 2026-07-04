import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
    private message: string;
    private onChoice: (confirmed: boolean) => void;

    constructor(app: App, message: string, onChoice: (confirmed: boolean) => void) {
        super(app);
        this.message = message;
        this.onChoice = onChoice;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('p', { text: this.message });

        new Setting(contentEl)
            .addButton((btn) =>
                btn.setButtonText('Cancel').onClick(() => {
                    this.onChoice(false);
                    this.close();
                }),
            )
            .addButton((btn) =>
                btn
                    .setButtonText('Delete')
                    .setWarning()
                    .onClick(() => {
                        this.onChoice(true);
                        this.close();
                    }),
            );
    }

    onClose() {
        this.contentEl.empty();
    }
}

export function confirmDialog(app: App, message: string): Promise<boolean> {
    return new Promise((resolve) => {
        new ConfirmModal(app, message, resolve).open();
    });
}
