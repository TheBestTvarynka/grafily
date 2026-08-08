import { Menu, MenuItem, Plugin, TAbstractFile, TFile } from 'obsidian';

import { DEFAULT_SETTINGS, GrafilySettings, GrafilySettingTab } from './settings';
import { GrafilyView, GrafilyViewRequest, VIEW_TYPE } from './view/GrafilyView';
import { renderNavigationBlock } from './view/navigationBlock';
import { extractPageMeta } from './parsing';
import { BRANDES_KORF, REINGOLD_TILFORD } from './layout';

import '@xyflow/react/dist/style.css';
import { GraphDto } from 'view/graph';

export type GrafilyState = {
    settings: GrafilySettings;
    graphs: Record<string, GraphDto>;
};

export const DEFAULT_STATE: GrafilyState = {
    settings: DEFAULT_SETTINGS,
    graphs: {},
};

export default class Grafily extends Plugin {
    settings: GrafilySettings;
    // Maps a person page's file path to its person id. Obsidian shows the `file-menu` context
    // menu synchronously right after firing the event, so `handleFileMenu` cannot read and parse
    // the file (an async operation) before deciding whether to add the Grafily item — by the time
    // that read resolves, the menu may already be shown, and `menu.addItem` silently does nothing.
    // This index is kept up to date ahead of time instead, so `handleFileMenu` only needs a
    // synchronous lookup.
    private personIdByPath = new Map<string, string>();

    async onload() {
        await this.loadSettings();

        this.addRibbonIcon('network', 'Grafily', (_: MouseEvent) => {
            this.activateView().catch((err) => console.error(err));
        });

        this.registerView(VIEW_TYPE, (leaf) => new GrafilyView(leaf, this.settings.dataDir, this));

        this.registerMarkdownCodeBlockProcessor('grafily-navigation', (_source, el, ctx) => {
            renderNavigationBlock(el, ctx, this);
        });

        this.addSettingTab(new GrafilySettingTab(this.app, this));

        this.app.workspace.onLayoutReady(() => {
            this.refreshPersonIndex().catch((err) => console.error(err));
        });

        this.registerEvent(
            this.app.vault.on('modify', (file) => {
                if (file instanceof TFile) {
                    this.updatePersonIndexEntry(file).catch((err) => console.error(err));
                }
            }),
        );
        this.registerEvent(
            this.app.vault.on('delete', (file) => {
                this.personIdByPath.delete(file.path);
            }),
        );
        this.registerEvent(
            this.app.vault.on('rename', (file, oldPath) => {
                this.personIdByPath.delete(oldPath);

                if (file instanceof TFile) {
                    this.updatePersonIndexEntry(file).catch((err) => console.error(err));
                }
            }),
        );

        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                this.handleFileMenu(menu, file);
            }),
        );
    }

    private async refreshPersonIndex() {
        const personIdByPath = new Map<string, string>();

        for (const file of this.app.vault.getFiles()) {
            if (!file.path.startsWith(this.settings.dataDir) || file.extension !== 'md') {
                continue;
            }

            try {
                const content = await this.app.vault.cachedRead(file);
                const person = extractPageMeta(content, file.basename, file);

                personIdByPath.set(file.path, person.id);
            } catch {
                // Not a valid person page; leave it out of the index.
            }
        }

        this.personIdByPath = personIdByPath;
    }

    private async updatePersonIndexEntry(file: TFile) {
        if (!file.path.startsWith(this.settings.dataDir) || file.extension !== 'md') {
            this.personIdByPath.delete(file.path);
            return;
        }

        try {
            const content = await this.app.vault.cachedRead(file);
            const person = extractPageMeta(content, file.basename, file);

            this.personIdByPath.set(file.path, person.id);
        } catch {
            this.personIdByPath.delete(file.path);
        }
    }

    handleFileMenu(menu: Menu, file: TAbstractFile) {
        if (!(file instanceof TFile)) {
            return;
        }

        const personId = this.personIdByPath.get(file.path);
        if (!personId) {
            return;
        }

        menu.addItem((item: MenuItem) => {
            item.setTitle('Grafily').setIcon('network');

            // `setSubmenu` is not part of Obsidian's public API typings, but it is the standard
            // way plugins (and Obsidian's own "Copy path" item) nest options under a parent one.
            const submenu = (item as MenuItem & { setSubmenu: () => Menu }).setSubmenu();

            submenu.addItem((subItem) =>
                subItem.setTitle('Family tree').onClick(() => {
                    this.activateView({ layoutName: REINGOLD_TILFORD, personId }).catch((err) =>
                        console.error(err),
                    );
                }),
            );

            submenu.addItem((subItem) =>
                subItem.setTitle('Graph explorer').onClick(() => {
                    this.activateView({ layoutName: BRANDES_KORF, personId }).catch((err) =>
                        console.error(err),
                    );
                }),
            );
        });
    }

    async activateView(request?: GrafilyViewRequest) {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({
            type: VIEW_TYPE,
            active: true,
            state: request,
        });
    }

    onunload() {}

    async loadSettings() {
        const data = ((await this.loadData()) as GrafilyState) || DEFAULT_STATE;
        this.settings = data.settings;
    }

    async saveSettings() {
        const data = ((await this.loadData()) as GrafilyState) || DEFAULT_STATE;
        data.settings = this.settings;

        await this.saveData(data);
    }
}
