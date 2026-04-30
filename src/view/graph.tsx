import { createContext, useEffect, useState } from 'react';

import {
    ReactFlow,
    Background,
    Controls,
    ReactFlowProvider,
    BackgroundVariant,
    Node,
    Edge,
} from '@xyflow/react';

import { buildIndex, emptyIndex, familyFromPersons, Index } from '../model';
import { useApp } from '../hooks';
import { extractPageMeta } from '../parsing';
import { PersonNode, MarriageNode } from './node';
import { BRANDES_KORF, GenericLayout, LayoutName, MARRIAGE_NODE_TYPE } from 'layout';
import { StartupMenu } from './StartupMenu';
import { SavePanel } from './SavePanel';

export type GraphContextValue = {
    layout: GenericLayout;
    index: Index;

    collapseChildren: (nodeId: string) => void;
    collapseParents: (personId: string) => void;

    expandChildren: (nodeId: string) => void;
    expandParents: (personId: string) => void;
};
export const GraphContext = createContext<GraphContextValue | null>(null);

const nodeTypes = {
    personNode: PersonNode,
    marriageNode: MarriageNode,
};

function FamilyGraph({ plugin }: { plugin: any }) {
    const [layout, setLayout] = useState<GenericLayout>(
        new GenericLayout(BRANDES_KORF, emptyIndex()),
    );
    const [index, setIndex] = useState<Index>(emptyIndex());

    const [graph, setGraph] = useState<[Node[], Edge[]]>([[], []]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [savedGraphs, setSavedGraphs] = useState<
        Record<string, { nodes: Node[]; edges: Edge[] }>
    >({});

    const shiftGraphByAnchorNode = (
        oldNodes: Node[],
        newNodes: Node[],
        anchorNodeId: string,
    ): Node[] => {
        const oldNode = oldNodes.find((n) => n.id === anchorNodeId);
        const newNode = newNodes.find((n) => n.id === anchorNodeId);

        if (!oldNode || !newNode) {
            console.warn(
                `Anchor node with id ${anchorNodeId} not found in one of the graphs. Skipping viewport shift.`,
            );

            return newNodes;
        }

        const dx = newNode.position.x - oldNode.position.x;
        const dy = newNode.position.y - oldNode.position.y;

        return newNodes.map((node) => {
            node.position.x -= dx;
            node.position.y -= dy;

            return node;
        });
    };

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

            if (!cancelled) {
                setIndex(familyIndex);
            }
        })().catch((err) => console.error(err));

        return () => {
            cancelled = true;
        };
    }, [app]);

    useEffect(() => {
        if (!plugin) {
            return;
        }

        (async () => {
            try {
                const savedStates = (await plugin.loadData()) || {};

                if (!savedStates || Object.keys(savedStates).length === 0) {
                    setSavedGraphs({});
                    return;
                }

                const validGraphs: Record<string, { nodes: Node[]; edges: Edge[] }> = {};
                for (const [key, value] of Object.entries(savedStates)) {
                    if (
                        value &&
                        typeof value === 'object' &&
                        'nodes' in value &&
                        'edges' in value &&
                        Array.isArray((value as any).nodes) &&
                        Array.isArray((value as any).edges)
                    ) {
                        validGraphs[key] = {
                            nodes: (value as any).nodes,
                            edges: (value as any).edges,
                        };
                    }
                }

                setSavedGraphs(validGraphs);
            } catch (err) {
                console.error('Failed to load saved graphs:', err);

                setSavedGraphs({});
            }
        })();
    }, [plugin]);

    const collapseChildren = (nodeId: string) => {
        const newGraph = layout.collapseChildren(nodeId);
        newGraph[0] = shiftGraphByAnchorNode(graph[0], newGraph[0], nodeId);

        setGraph(newGraph);
    };

    const collapseParents = (personId: string) => {
        const newGraph = layout.collapseParents(personId);

        const personMarriage = (index.personMarriages.get(personId) ?? []).first();

        let nodeId: string;
        if (personMarriage) {
            nodeId = personMarriage.id;
        } else {
            nodeId = personId;
        }

        newGraph[0] = shiftGraphByAnchorNode(graph[0], newGraph[0], nodeId);

        setGraph(newGraph);
    };

    const expandChildren = (nodeId: string) => {
        const newGraph = layout.expandChildren(nodeId);
        newGraph[0] = shiftGraphByAnchorNode(graph[0], newGraph[0], nodeId);

        setGraph(newGraph);
    };

    const expandParents = (personId: string) => {
        const newGraph = layout.expandParents(personId);

        const personMarriage = (index.personMarriages.get(personId) ?? []).first();

        let nodeId: string;
        if (personMarriage) {
            nodeId = personMarriage.id;
        } else {
            nodeId = personId;
        }

        newGraph[0] = shiftGraphByAnchorNode(graph[0], newGraph[0], nodeId);

        setGraph(newGraph);
    };

    const handleStartupMenuSubmit = (layoutName: LayoutName, personId: string) => {
        const newLayout = new GenericLayout(layoutName, index);
        const newGraph = newLayout.buildNodes(personId);

        setLayout(newLayout);
        setGraph(newGraph);
        setIsInitialized(true);
    };

    const handleLoadSavedGraph = (nodes: Node[], edges: Edge[]) => {
        setGraph([nodes, edges]);
        setIsInitialized(true);
    };

    const handleSaveGraph = async (name: string, data: { nodes: Node[]; edges: Edge[] }) => {
        if (!plugin) {
            console.error('Plugin instance not available');
            throw new Error('Plugin instance not available');
        }

        try {
            const existingStates = (await plugin.loadData()) || {};

            const updatedStates = {
                ...existingStates,
                [name]: data,
            };

            await plugin.saveData(updatedStates);

            console.debug(`Graph state "${name}" saved successfully`);
        } catch (err) {
            console.error('Failed to save graph state:', err);
            throw err;
        }
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
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <ReactFlow nodes={graph[0]} edges={graph[1]} nodeTypes={nodeTypes}>
                    <Background color="grey" variant={BackgroundVariant.Dots} gap={20} />
                    <Controls />
                </ReactFlow>
                {isInitialized && (
                    <SavePanel nodes={graph[0]} edges={graph[1]} onSave={handleSaveGraph} />
                )}
                {!isInitialized && index.personById.size > 0 && (
                    <StartupMenu
                        persons={Array.from(index.personById.keys())}
                        savedGraphs={savedGraphs}
                        onSubmit={handleStartupMenuSubmit}
                        onLoadSavedGraph={handleLoadSavedGraph}
                    />
                )}
            </div>
        </GraphContext.Provider>
    );
}

export function FamilyFlow({ plugin }: { plugin: any }) {
    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                border: 'none',
            }}
        >
            <ReactFlowProvider>
                <FamilyGraph plugin={plugin} />
            </ReactFlowProvider>
        </div>
    );
}
