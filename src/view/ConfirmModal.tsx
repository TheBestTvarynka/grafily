import { App, Modal, Setting } from 'obsidian';

export class ConfirmModal extends Modal {
    private message: string;
    private confirmText: string;
    private onChoice: (confirmed: boolean) => void;

    constructor(
        app: App,
        message: string,
        onChoice: (confirmed: boolean) => void,
        confirmText: string = 'Delete',
    ) {
        super(app);
        this.message = message;
        this.confirmText = confirmText;
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
                    .setButtonText(this.confirmText)
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

export function confirmDialog(app: App, message: string, confirmText?: string): Promise<boolean> {
    return new Promise((resolve) => {
        new ConfirmModal(app, message, resolve, confirmText).open();
    });
}
