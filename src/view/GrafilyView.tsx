import { StrictMode, createContext } from 'react';
import { ItemView, WorkspaceLeaf, App, Plugin, ViewStateResult } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';

import { FamilyFlow } from './graph';
import { LayoutOptions } from 'layout';

export const VIEW_TYPE = 'grafily-view';

/**
 * A request to immediately build a graph for the given person, skipping the startup menu.
 * Used to open the view directly from the `grafily-navigation` code block.
 */
export type GrafilyViewRequest = {
    options: LayoutOptions;
    personId: string;
};

/**
 * What Obsidian persists for this tab, so that closing and reopening the app brings the graph
 * back instead of the startup menu.
 *
 * The two ways a tab can hold a graph are mutually exclusive, and `getState` only ever writes
 * one of them:
 * - `graphName` - a saved graph is open. It is restored exactly, straight out of the plugin data
 *   file, with every collapse, expand and rearrange intact.
 * - `options` + `personId` - the tab was opened directly for a person and never saved. There is
 *   nothing stored to restore, so the graph is rebuilt from that person. Anything the user did to
 *   it is not part of the rebuild.
 */
export type GrafilyViewState = {
    graphName?: string;
    options?: LayoutOptions;
    personId?: string;
};

const ReactView = ({
    plugin,
    dataDir,
    initialRequest,
    initialGraphName,
    onTitleChange,
    onGraphNameChange,
}: {
    plugin: Plugin;
    dataDir: string;
    initialRequest: GrafilyViewRequest | null;
    initialGraphName: string | null;
    onTitleChange: (title: string) => void;
    onGraphNameChange: (graphName: string | null) => void;
}) => {
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <FamilyFlow
                plugin={plugin}
                dataDir={dataDir}
                initialRequest={initialRequest}
                initialGraphName={initialGraphName}
                onTitleChange={onTitleChange}
                onGraphNameChange={onGraphNameChange}
            />
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
    // The saved graph currently open in this tab, if any. Kept in sync by the React tree so that
    // `getState` can persist it.
    loadedGraphName: string | null = null;
    title = 'Grafily';

    constructor(leaf: WorkspaceLeaf, dataDir: string, plugin?: Plugin) {
        super(leaf);
        this.plugin = plugin || null;
        this.dataDir = dataDir;
    }

    getViewType() {
        return VIEW_TYPE;
    }

    getDisplayText() {
        return this.title;
    }

    getIcon() {
        return 'network';
    }

    private handleTitleChange = (title: string) => {
        this.title = title;
        (this.leaf as WorkspaceLeaf & { updateHeader: () => void }).updateHeader();
    };

    private handleGraphNameChange = (graphName: string | null) => {
        if (this.loadedGraphName === graphName) {
            return;
        }

        this.loadedGraphName = graphName;

        // Obsidian only writes the workspace file when it thinks something changed, and it has no
        // way to notice a change inside our React tree. Asking for a save is what makes the newly
        // opened graph survive a restart. The call is debounced by Obsidian.
        this.app.workspace.requestSaveLayout();
    };

    async onOpen() {
        this.root = createRoot(this.contentEl);
        this.renderReactRoot();
    }

    /**
     * Returns what Obsidian should persist for this tab. See {@link GrafilyViewState}: a saved
     * graph wins over a build request, so the two never both apply on restore.
     */
    getState(): Record<string, unknown> {
        const state: GrafilyViewState = this.loadedGraphName
            ? { graphName: this.loadedGraphName }
            : (this.initialRequest ?? {});

        return { ...super.getState(), ...state };
    }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        const restored = state as GrafilyViewState | null;

        if (restored?.graphName) {
            this.loadedGraphName = restored.graphName;
            this.initialRequest = null;

            if (this.root) {
                this.renderReactRoot();
            }
        } else if (restored?.options && restored?.personId) {
            this.initialRequest = { options: restored.options, personId: restored.personId };
            this.loadedGraphName = null;

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
                            initialGraphName={this.loadedGraphName}
                            onTitleChange={this.handleTitleChange}
                            onGraphNameChange={this.handleGraphNameChange}
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
