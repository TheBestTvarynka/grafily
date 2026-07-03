import { Plugin } from 'obsidian';

import { DEFAULT_SETTINGS, GrafilySettings, GrafilySettingTab } from './settings';
import { GrafilyView, VIEW_TYPE } from './view/GrafilyView';

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

    async onload() {
        await this.loadSettings();

        this.addRibbonIcon('network', 'Grafily', (_: MouseEvent) => {
            this.activateView().catch((err) => console.error(err));
        });

        this.registerView(VIEW_TYPE, (leaf) => new GrafilyView(leaf, this.settings.dataDir, this));

        this.addSettingTab(new GrafilySettingTab(this.app, this));
    }

    async activateView() {
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.setViewState({
            type: VIEW_TYPE,
            active: true,
        });
    }

    onunload() {}

    async loadSettings() {
        const data: GrafilyState = ((await this.loadData()) as GrafilyState) || DEFAULT_STATE;
        this.settings = data.settings;
    }

    async saveSettings() {
        const data: GrafilyState = ((await this.loadData()) as GrafilyState) || DEFAULT_STATE;
        data.settings = this.settings;

        await this.saveData(data);
    }
}
