import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab } from "./settings";

import { MyCanvasView, VIEW_TYPE } from './ReactView';

import '@xyflow/react/dist/style.css';

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;

    async onload() {
        await this.loadSettings();

        // This creates an icon in the left ribbon.
        this.addRibbonIcon('dice', 'Sample', (evt: MouseEvent) => {
            // Called when the user clicks the icon.
            this.activateView();
        });

        // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        // const statusBarItemEl = this.addStatusBarItem();
        // statusBarItemEl.setText('Status bar text');

        // This adds a simple command that can be triggered anywhere
        this.addCommand({
            id: 'open-modal-simple',
            name: 'Open defa',
            callback: () => {
                new SampleModal(this.app).open();
            }
        });

        this.registerView(
            VIEW_TYPE,
            (leaf) => new MyCanvasView(leaf)
        );

        this.addCommand({
            id: 'open-modal-tbt',
            name: 'Open tbt',
            callback: () => {
                this.activateView();
            }
        });

        // This adds an editor command that can perform some operation on the current editor instance
        this.addCommand({
            id: 'replace-selected',
            name: 'Replace selected content',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                editor.replaceSelection('Sample editor command');
            }
        });
        // This adds a complex command that can check whether the current state of the app allows execution of the command
        this.addCommand({
            id: 'open-modal-complex',
            name: 'Open modal (complex)',
            checkCallback: (checking: boolean) => {
                // Conditions to check
                const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
                if (markdownView) {
                    // If checking is true, we're simply "checking" if the command can be run.
                    // If checking is false, then we want to actually perform the operation.
                    if (!checking) {
                        new SampleModal(this.app).open();
                    }

                    // This command will only show up in Command Palette when the check function returns true
                    return true;
                }
                return false;
            }
        });

        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new SampleSettingTab(this.app, this));
    }

    async activateView() {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({
            type: VIEW_TYPE,
            active: true
        });
    }

    onunload() {
        this.app.workspace.detachLeavesOfType(VIEW_TYPE);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<MyPluginSettings>);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class SampleModal extends Modal {
    constructor(app: App) {
        super(app);
    }

    onOpen() {
        let { contentEl } = this;
        contentEl.setText('Woah!');
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
