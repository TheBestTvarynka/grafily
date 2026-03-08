import { createContext, useEffect, useState } from 'react';

import {
    ReactFlow,
    Background,
    Controls,
    ReactFlowProvider,
    BackgroundVariant,
    Node,
    Edge,
    useReactFlow,
} from '@xyflow/react';

// import { buildNodes } from '../layout/tree';
import { buildIndex, emptyIndex, familyFromPersons, Index } from '../model';
import { useApp } from '../hooks';
import { extractPageMeta } from '../parsing';
import { PersonNode, MarriageNode } from './node';
import { BRANDES_KORF, GenericLayout } from 'layout';

export type GraphContextValue = {
    layout: GenericLayout;
    index: Index;

    collapseChildren: (nodeId: string) => void;
    collapseParents: (nodeId: string) => void;

    expandChildren: (nodeId: string) => void;
    expandParents: (nodeId: string) => void;
};
export const GraphContext = createContext<GraphContextValue | null>(null);

const nodeTypes = {
    personNode: PersonNode,
    marriageNode: MarriageNode,
};

function FamilyGraph() {
    const [layout, setLayout] = useState<GenericLayout>(
        new GenericLayout(BRANDES_KORF, emptyIndex()),
    );
    const [index, setIndex] = useState<Index>(emptyIndex());

    const { fitView } = useReactFlow();
    const [graph, setGraph] = useState<[Node[], Edge[]]>([[], []]);

    useEffect(() => {
        if (graph[0].length === 0) {
            return;
        }

        fitView({ padding: 0, duration: 1000 }).catch((err) => console.error(err));
    }, [graph, fitView]);

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

                        const person = extractPageMeta(content, name, file);
                        persons.push(person);
                    } catch (err) {
                        console.warn(err);
                    }
                }
            }

            const family = familyFromPersons(persons);
            const familyIndex = buildIndex(family);

            const layout = new GenericLayout(BRANDES_KORF, familyIndex);
            const graph = layout.buildNodes('Oleksii');

            setIndex(familyIndex);
            setLayout(layout);

            if (!cancelled) {
                setGraph(graph);
            }
        })().catch((err) => console.error(err));

        return () => {
            cancelled = true;
        };
    }, [app]);

    const collapseChildren = (nodeId: string) => {
        const graph = layout.collapseChildren(nodeId);
        setGraph(graph);
    };

    const collapseParents = (nodeId: string) => {
        const graph = layout.collapseParents(nodeId);
        setGraph(graph);
    };

    const expandChildren = (nodeId: string) => {
        const graph = layout.expandChildren(nodeId);
        setGraph(graph);
    };
    const expandParents = (nodeId: string) => {
        const graph = layout.expandParents(nodeId);
        setGraph(graph);
    };

    return (
        <GraphContext.Provider
            value={{
                layout,
                collapseChildren,
                collapseParents,
                expandChildren,
                expandParents,
                index,
            }}
        >
            <ReactFlow nodes={graph[0]} edges={graph[1]} nodeTypes={nodeTypes}>
                <Background color="grey" variant={BackgroundVariant.Dots} gap={10} />
                <Controls />
            </ReactFlow>
        </GraphContext.Provider>
    );
}

export function FamilyFlow() {
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
