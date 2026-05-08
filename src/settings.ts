import { App, PluginSettingTab, Setting } from 'obsidian';

import Grafily from './main';

/**
 * Grafily plugin settings.
 *
 * @property {string} pages - Path to the directory that contains people's pages.
 */
export interface GrafilySettings {
    dataDir: string;
}

/**
 * Default settings.
 */
export const DEFAULT_SETTINGS: GrafilySettings = {
    dataDir: 'family',
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
                    .setValue(this.plugin.settings.dataDir)
                    .onChange(async (value) => {
                        this.plugin.settings.dataDir = value;
                        await this.plugin.saveSettings();
                    }),
            );
    }
}
