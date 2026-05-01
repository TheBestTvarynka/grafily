import { Plugin } from 'obsidian';

import { GrafilySettings, GrafilySettingTab } from './settings';
import { GrafilyView, VIEW_TYPE } from './view/GrafilyView';

import '@xyflow/react/dist/style.css';

export default class Grafily extends Plugin {
    settings: GrafilySettings;

    async onload() {
        await this.loadSettings();

        this.addRibbonIcon('network', 'Grafily', (_: MouseEvent) => {
            this.activateView().catch((err) => console.error(err));
        });

        this.registerView(VIEW_TYPE, (leaf) => new GrafilyView(leaf, this));

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
        //
    }

    async saveSettings() {
        //
    }
}
