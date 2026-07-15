import { MarkdownPostProcessorContext, TFile } from 'obsidian';

import Grafily from '../main';
import { BRANDES_KORF, REINGOLD_TILFORD } from '../layout';

/**
 * Renders the `grafily-navigation` code block: two buttons that open the Grafily view in a new
 * tab, using the current page's person as the starting person.
 */
export function renderNavigationBlock(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
    plugin: Grafily,
) {
    const file = plugin.app.vault.getAbstractFileByPath(ctx.sourcePath);
    const personId = file instanceof TFile ? file.basename : null;

    const container = el.createDiv({ cls: 'grafily-navigation-block' });

    const treeButton = container.createEl('button', {
        cls: 'grafily-navigation-button',
        text: 'Family tree',
    });
    const explorerButton = container.createEl('button', {
        cls: 'grafily-navigation-button',
        text: 'Graph explorer',
    });

    if (!personId) {
        treeButton.disabled = true;
        explorerButton.disabled = true;
        return;
    }

    treeButton.onclick = () => {
        plugin
            .activateView({ layoutName: REINGOLD_TILFORD, personId })
            .catch((err) => console.error(err));
    };
    explorerButton.onclick = () => {
        plugin
            .activateView({ layoutName: BRANDES_KORF, personId })
            .catch((err) => console.error(err));
    };
}
