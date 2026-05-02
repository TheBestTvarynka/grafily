/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */

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
import {
    BRANDES_KORF,
    GenericLayout,
    LayoutName,
    SerializableLayout,
    fromSerializableObject,
} from 'layout';
import { StartupMenu } from './StartupMenu';
import { SidePanel } from './SidePanel';
import { Plugin } from 'obsidian';

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

export type GraphDto = {
    data: [Node[], Edge[]];
    layout: SerializableLayout;
};

function FamilyGraph({ plugin }: { plugin: Plugin }) {
    const [layout, setLayout] = useState<GenericLayout>(
        new GenericLayout(BRANDES_KORF, emptyIndex()),
    );
    const [index, setIndex] = useState<Index>(emptyIndex());

    const [graph, setGraph] = useState<[Node[], Edge[]]>([[], []]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [savedGraphs, setSavedGraphs] = useState<Record<string, GraphDto>>({});
    const [loadedGraphName, setLoadedGraphName] = useState<string | null>(null);

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
                const savedData = (await plugin.loadData()) || {};

                // Extract graphs from the nested structure
                const graphsData = savedData.graphs || {};

                if (!graphsData || Object.keys(graphsData).length === 0) {
                    setSavedGraphs({});
                    return;
                }

                const graphs: Record<string, GraphDto> = {};
                for (const [key, value] of Object.entries(graphsData)) {
                    graphs[key] = value as GraphDto;
                }

                setSavedGraphs(graphs);
            } catch (err) {
                console.error('Failed to load saved graphs:', err);

                setSavedGraphs({});
            }
        })().catch((err) => console.error(err));
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

    const handleLoadSavedGraph = (graphName: string) => {
        const loadedGraph = savedGraphs[graphName];
        if (!loadedGraph) {
            console.error(`Graph ${graphName} is not found in the loaded graphs`);
            return;
        }

        setLayout(fromSerializableObject(loadedGraph.layout, index));
        setGraph(loadedGraph.data);
        setLoadedGraphName(graphName);
        setIsInitialized(true);
    };

    const handleSaveGraph = async (name: string) => {
        if (!plugin) {
            console.error('Plugin instance not available');
            throw new Error('Plugin instance not available');
        }

        try {
            const existingStates = (await plugin.loadData()) || {};

            const graphDto: GraphDto = {
                data: graph,
                layout: layout.toSerializableObject(),
            };
            const graphs = {
                ...savedGraphs,
                [name]: graphDto,
            };

            const updatedStates = {
                ...existingStates,
                graphs,
            };
            JSON.stringify(updatedStates);

            await plugin.saveData(updatedStates);
            setLoadedGraphName(name);

            setSavedGraphs(graphs);

            console.debug(`Graph state "${name}" saved successfully`);
        } catch (err) {
            console.error('Failed to save graph state:', err);
            throw err;
        }
    };

    const handleDeleteGraph = async (graphName: string) => {
        if (!plugin) {
            console.error('Plugin instance not available');
            throw new Error('Plugin instance not available');
        }

        try {
            const existingStates = (await plugin.loadData()) || {};
            const graphs = existingStates?.graphs || {};

            delete graphs[graphName];

            const updatedStates = {
                ...existingStates,
                graphs,
            };

            await plugin.saveData(updatedStates);

            console.debug(`Graph state "${graphName}" deleted successfully`);

            setLoadedGraphName(null);
            setGraph([[], []]);
            setIsInitialized(false);

            const saved = savedGraphs;
            delete saved[graphName];
            setSavedGraphs({ ...saved });
        } catch (err) {
            console.error('Failed to delete graph state:', err);
            throw err;
        }
    };

    const handleHome = () => {
        // Reset graph state and return to startup menu
        setLoadedGraphName(null);
        setGraph([[], []]);
        setIsInitialized(false);
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
                    <SidePanel
                        loadedGraphName={loadedGraphName}
                        onSave={handleSaveGraph}
                        onDelete={handleDeleteGraph}
                        onHome={handleHome}
                    />
                )}
                {!isInitialized && index.personById.size > 0 && (
                    <StartupMenu
                        persons={Array.from(index.personById.keys())}
                        savedGraphs={savedGraphs}
                        onSubmit={handleStartupMenuSubmit}
                        onLoadSavedGraph={handleLoadSavedGraph}
                        onDeleteSavedGraph={handleDeleteGraph}
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
