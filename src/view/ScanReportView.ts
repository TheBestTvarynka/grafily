import { App, ItemView, Notice, TFile, WorkspaceLeaf } from 'obsidian';

import Grafily from '../main';
import { ScanCategory, ScanReport, scanPersonPages } from '../scan';

export const SCAN_REPORT_VIEW_TYPE = 'grafily-scan-report';

/**
 * Opens the scan report in a new tab. The report starts scanning as soon as the tab opens.
 */
export async function openScanReport(app: App) {
    const leaf = app.workspace.getLeaf(true);
    await leaf.setViewState({ type: SCAN_REPORT_VIEW_TYPE, active: true });
}

/**
 * Shows which person pages in the data directory are valid and why the others are not.
 */
export class ScanReportView extends ItemView {
    private plugin: Grafily;
    // Bumped by every scan and by closing the view. A scan that finishes after it was bumped is
    // stale, and must not draw over a newer scan or into a closed view.
    private scanId = 0;

    constructor(leaf: WorkspaceLeaf, plugin: Grafily) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return SCAN_REPORT_VIEW_TYPE;
    }

    getDisplayText() {
        return 'Grafily scan report';
    }

    getIcon() {
        return 'file-search';
    }

    async onOpen() {
        this.contentEl.addClass('grafily-scan-report');

        // Not awaited, so the tab shows up right away with the loading message.
        this.scan().catch((err) => console.error(err));
    }

    async onClose() {
        this.scanId++;
    }

    private async scan() {
        const scanId = ++this.scanId;
        // Read on every scan rather than once, so a changed setting applies on the next scan.
        const dataDir = this.plugin.settings.dataDir;
        const { contentEl } = this;

        contentEl.empty();
        const loading = contentEl.createDiv({ cls: 'grafily-scan-report-loading' });
        loading.createDiv({ cls: 'grafily-scan-report-spinner' });
        loading.createSpan({ text: `Scanning person pages in "${dataDir}"...` });

        let report: ScanReport;
        try {
            report = await scanPersonPages(this.app, dataDir);
        } catch (err) {
            if (scanId === this.scanId) {
                contentEl.empty();
                contentEl.createEl('p', {
                    cls: 'mod-warning',
                    text: `Failed to scan person pages: ${err instanceof Error ? err.message : String(err)}`,
                });
            }

            return;
        }

        if (scanId === this.scanId) {
            this.renderReport(report);
        }
    }

    private renderReport(report: ScanReport) {
        const { contentEl } = this;
        contentEl.empty();

        const header = contentEl.createDiv({ cls: 'grafily-scan-report-header' });
        header.createEl('h2', { text: `Person pages in "${report.dataDir}"` });
        header.createEl('button', { text: 'Scan again' }).addEventListener('click', () => {
            this.scan().catch((err) => console.error(err));
        });

        const summary = contentEl.createDiv({ cls: 'grafily-scan-report-summary' });
        const addStat = (label: string, value: number, cls: string) => {
            const stat = summary.createDiv({ cls: `grafily-scan-report-stat ${cls}` });
            stat.createDiv({ cls: 'grafily-scan-report-stat-value', text: String(value) });
            stat.createDiv({ cls: 'grafily-scan-report-stat-label', text: label });
        };
        addStat('Total', report.total, '');
        addStat('Valid', report.total - report.invalid, 'mod-valid');
        addStat('Invalid', report.invalid, report.invalid > 0 ? 'mod-invalid' : '');

        if (report.total === 0) {
            contentEl.createEl('p', {
                text: `No pages found. Check the pages location in the plugin settings.`,
            });
            return;
        }

        if (report.invalid === 0) {
            contentEl.createEl('p', { text: 'All person pages are valid.' });
            return;
        }

        for (const category of report.categories) {
            if (category.issues.length > 0) {
                this.renderCategory(category);
            }
        }
    }

    private renderCategory(category: ScanCategory) {
        const section = this.contentEl.createDiv({ cls: 'grafily-scan-report-category' });
        section.createEl('h3', { text: `${category.title} (${category.issues.length})` });
        section.createDiv({ cls: 'setting-item-description', text: category.description });

        const list = section.createEl('ul');
        for (const issue of category.issues) {
            const item = list.createEl('li');

            const link = item.createEl('a', {
                cls: 'internal-link',
                text: issue.file.basename,
                attr: { tabindex: '0', role: 'link', 'aria-label': issue.file.path },
            });
            link.addEventListener('click', (evt) => {
                evt.preventDefault();
                this.openFile(issue.file.path);
            });
            link.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter') {
                    evt.preventDefault();
                    this.openFile(issue.file.path);
                }
            });

            for (const detail of issue.details) {
                item.createDiv({ cls: 'grafily-scan-report-detail', text: detail });
            }
        }
    }

    private openFile(path: string) {
        // The page may have been renamed or deleted since the scan.
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!(file instanceof TFile)) {
            new Notice(`"${path}" no longer exists. Scan again to refresh the report.`);
            return;
        }

        this.app.workspace
            .getLeaf('tab')
            .openFile(file)
            .catch((err) => console.error(err));
    }
}
