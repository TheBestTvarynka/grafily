import { StrictMode, createContext } from 'react';
import { ItemView, WorkspaceLeaf, App, Plugin } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';

import { FamilyFlow } from './graph';

export const VIEW_TYPE = 'grafily-view';

const ReactView = ({ plugin, dataDir }: { plugin: Plugin; dataDir: string }) => {
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <FamilyFlow plugin={plugin} dataDir={dataDir} />
        </div>
    );
};

export const AppContext = createContext<App | undefined>(undefined);
export const PluginContext = createContext<Plugin | undefined>(undefined);

export class GrafilyView extends ItemView {
    root: Root | null = null;
    plugin: Plugin | null = null;
    dataDir: string;

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
        this.root.render(
            <AppContext.Provider value={this.app}>
                <PluginContext.Provider value={this.plugin || undefined}>
                    <StrictMode>
                        <ReactView plugin={this.plugin!} dataDir={this.dataDir} />
                    </StrictMode>
                </PluginContext.Provider>
            </AppContext.Provider>,
        );
    }

    async onClose() {
        this.root?.unmount();
    }
}
