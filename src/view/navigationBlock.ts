import { MarkdownPostProcessorContext, TFile } from 'obsidian';

import Grafily from '../main';
import { DEFAULT_ALGORITHM, GRAPH, TREE } from '../layout';

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
            .activateView({ options: { kind: TREE, algorithm: DEFAULT_ALGORITHM }, personId })
            .catch((err) => console.error(err));
    };
    explorerButton.onclick = () => {
        plugin
            .activateView({ options: { kind: GRAPH, algorithm: DEFAULT_ALGORITHM }, personId })
            .catch((err) => console.error(err));
    };
}
