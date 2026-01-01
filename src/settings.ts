import { App, PluginSettingTab, Setting } from 'obsidian';

import Grafily from './main';

export interface GrafilySettings {
    mySetting: string;
}

export const DEFAULT_SETTINGS: GrafilySettings = {
    mySetting: 'default',
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
            .setName('Settings #1')
            .setDesc("It's a secret")
            .addText((text) =>
                text
                    .setPlaceholder('Enter your secret')
                    .setValue(this.plugin.settings.mySetting)
                    .onChange(async (value) => {
                        this.plugin.settings.mySetting = value;
                        await this.plugin.saveSettings();
                    }),
            );
    }
}
