import { StrictMode, createContext, useEffect, useState } from 'react';
import { ItemView, WorkspaceLeaf, App } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import {
    ReactFlow,
    Background,
    Controls,
    ReactFlowProvider,
    BackgroundVariant,
    Node,
    Edge,
} from '@xyflow/react';

import { buildNodes } from 'layout';
import { buildIndex, familyFromPersons } from 'model';
import { PersonNode, MarriageNode } from './node';
import { useApp } from 'hooks';
import { extractPageMeta } from 'parsing';

const nodeTypes = {
    personNode: PersonNode,
    marriageNode: MarriageNode,
};

function FamilyGraph() {
    const [graph, setGraph] = useState<[Node[], Edge[]]>([[], []]);

    const app = useApp();
    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!app) {
                return;
            }

            const { vault } = app;
            const files = vault.getFiles();

            const persons = [];
            for (const file of files) {
                if (file.path.startsWith('family/') && file.extension === 'md') {
                    const content = await vault.cachedRead(file);
                    try {
                        // Remove file `.md` extension.
                        const name = file.name.substring(0, file.name.length - 3);

                        const person = extractPageMeta(content, name, file.path);
                        persons.push(person);
                    } catch (err) {
                        console.error(err);
                    }
                }
            }

            const family = familyFromPersons(persons);
            const index = buildIndex(family);
            const graph = buildNodes('Yaroslav', index);

            if (!cancelled) {
                setGraph(graph);
            }
        })().catch((err) => console.error(err));

        return () => {
            cancelled = true;
        };
    }, [app]);

    // const family = defaultFamily();
    // const index = buildIndex(family);

    // const [nodes, edges] = buildNodes('yaroslav', index);

    return (
        <ReactFlow nodes={graph[0]} edges={graph[1]} nodeTypes={nodeTypes}>
            <Background color="skyblue" variant={BackgroundVariant.Dots} />
            <Controls />
        </ReactFlow>
    );
}

function FamilyFlow() {
    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                border: 'none',
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
