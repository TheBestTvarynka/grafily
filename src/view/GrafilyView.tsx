import { StrictMode, createContext } from 'react';
import { ItemView, WorkspaceLeaf, App, Plugin, ViewStateResult } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';

import { FamilyFlow } from './graph';
import { LayoutName } from 'layout';

export const VIEW_TYPE = 'grafily-view';

/**
 * A request to immediately build a graph for the given person, skipping the startup menu.
 * Used to open the view directly from the `grafily-navigation` code block.
 */
export type GrafilyViewRequest = {
    layoutName: LayoutName;
    personId: string;
};

const ReactView = ({
    plugin,
    dataDir,
    initialRequest,
}: {
    plugin: Plugin;
    dataDir: string;
    initialRequest: GrafilyViewRequest | null;
}) => {
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <FamilyFlow plugin={plugin} dataDir={dataDir} initialRequest={initialRequest} />
        </div>
    );
};

export const AppContext = createContext<App | undefined>(undefined);
export const PluginContext = createContext<Plugin | undefined>(undefined);

export class GrafilyView extends ItemView {
    root: Root | null = null;
    plugin: Plugin | null = null;
    dataDir: string;
    initialRequest: GrafilyViewRequest | null = null;

    constructor(leaf: WorkspaceLeaf, dataDir: string, plugin?: Plugin) {
        super(leaf);
        this.plugin = plugin || null;
        this.dataDir = dataDir;
    }

    getViewType() {
        return VIEW_TYPE;
    }

    getDisplayText() {
        return 'Grafily';
    }

    async onOpen() {
        this.root = createRoot(this.contentEl);
        this.renderReactRoot();
    }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        const request = state as GrafilyViewRequest | null;
        if (request?.layoutName && request?.personId) {
            this.initialRequest = request;
            if (this.root) {
                this.renderReactRoot();
            }
        }

        await super.setState(state, result);
    }

    private renderReactRoot() {
        this.root?.render(
            <AppContext.Provider value={this.app}>
                <PluginContext.Provider value={this.plugin || undefined}>
                    <StrictMode>
                        <ReactView
                            plugin={this.plugin!}
                            dataDir={this.dataDir}
                            initialRequest={this.initialRequest}
                        />
                    </StrictMode>
                </PluginContext.Provider>
            </AppContext.Provider>,
        );
    }

    async onClose() {
        this.root?.unmount();
    }
}
