import { App, PluginSettingTab, Setting } from 'obsidian';

import Grafily from './main';

// Grafily plugin settings.
export interface GrafilySettings {
    // Path to the directory that contains people's pages.
    pages: string;
}

export const DEFAULT_SETTINGS: GrafilySettings = {
    pages: 'family',
};

export class GrafilySettingTab extends PluginSettingTab {
    plugin: Grafily;

    constructor(app: App, plugin: Grafily) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Pages location')
            .setDesc("Path to the directory that contains people's pages")
            .addText((text) =>
                text
                    .setPlaceholder('Type directory path')
                    .setValue(this.plugin.settings.pages)
                    .onChange(async (value) => {
                        this.plugin.settings.pages = value;
                        await this.plugin.saveSettings();
                    }),
            );
    }
}
