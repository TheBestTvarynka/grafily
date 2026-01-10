import { StrictMode, createContext, useContext, useEffect, useState } from 'react';
import { ItemView, WorkspaceLeaf, App } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';

import { FamilyFlow } from './graph';

export const VIEW_TYPE = 'my-canvas-view';

const ReactView = () => {
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <FamilyFlow />
        </div>
    );
};

export const AppContext = createContext<App | undefined>(undefined);

export class GrafilyView extends ItemView {
    root: Root | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
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
                <StrictMode>
                    <ReactView />
                </StrictMode>
            </AppContext.Provider>,
        );
    }

    async onClose() {
        this.root?.unmount();
    }
}
