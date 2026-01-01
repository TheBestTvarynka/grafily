import { StrictMode, createContext } from 'react';
import { ItemView, WorkspaceLeaf, App } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import {
    ReactFlow,
    Background,
    Controls,
    ReactFlowProvider,
    BackgroundVariant,
} from '@xyflow/react';

import { buildNodes } from 'layout';
import { buildIndex, defaultFamily } from 'model';
import { PersonNode, MarriageNode } from './node';

const nodeTypes = {
    personNode: PersonNode,
    marriageNode: MarriageNode,
};

function FamilyGraph() {
    const family = defaultFamily();
    const index = buildIndex(family);

    const [nodes, edges] = buildNodes('yaroslav', index);

    return (
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}>
            <Background color="skyblue" variant={BackgroundVariant.Dots} />
            <Controls />
        </ReactFlow>
    );
}

function FamilyFlow() {
    return (
        <div
            style={{
                width: '1500px',
                height: '900px',
                border: '2px solid #ccc',
                position: 'relative',
                overflow: 'visible',
            }}
        >
            <ReactFlowProvider>
                <FamilyGraph />
            </ReactFlowProvider>
        </div>
    );
}

export const VIEW_TYPE = 'my-canvas-view';

const ReactView = () => {
    return (
        <div>
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
