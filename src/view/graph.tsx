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

import { buildIndex, emptyIndex, familyFromPersons, Index } from '../model';
import { useApp } from '../hooks';
import { extractPageMeta } from '../parsing';
import { PersonNode, MarriageNode } from './node';
import {
    BRANDES_KORF,
    GenericLayout,
    LayoutName,
    NODE_HEIGHT,
    NODE_WIDTH,
    RearrangeAction,
    SerializableLayoutData,
    fromSerializableObject,
    personIdToNodeId,
} from 'layout';
import { StartupMenu } from './StartupMenu';
import { SelectedPerson, SidePanel } from './SidePanel';
import { App, Plugin } from 'obsidian';
import { DEFAULT_STATE, GrafilyState } from 'main';
import { confirmDialog } from './ConfirmModal';

export type GraphContextValue = {
    layout: GenericLayout;
    index: Index;

    collapseChildren: (nodeId: string) => void;
    collapseParents: (personId: string) => void;
    expandChildren: (nodeId: string) => void;
    expandParents: (personId: string) => void;
    rearrange: (personId: string, action: RearrangeAction) => void;
    contains: (personId: string) => boolean;
    toggleSiblingVisibility: (personId: string) => void;

    selectedPerson: SelectedPerson | null;
    selectPerson: (node: SelectedPerson | null) => void;

    refreshIndex: () => Promise<void>;
};
export const GraphContext = createContext<GraphContextValue | null>(null);

const nodeTypes = {
    personNode: PersonNode,
    marriageNode: MarriageNode,
};

export type GraphDto = {
    data: [Node[], Edge[]];
    layout: SerializableLayoutData;
};

const DEFAULT_EMPTY_LAYOUT: GenericLayout = new GenericLayout(BRANDES_KORF, emptyIndex());

async function scanVaultForPersons(app: App, dataDir: string): Promise<Index> {
    const { vault } = app;
    const files = vault.getFiles();

    const persons = [];
    for (const file of files) {
        if (file.path.startsWith(dataDir) && file.extension === 'md') {
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
    return buildIndex(family);
}

function FamilyGraph({ plugin, dataDir }: { plugin: Plugin; dataDir: string }) {
    const [layout, setLayout] = useState<GenericLayout>(DEFAULT_EMPTY_LAYOUT);
    const [index, setIndex] = useState<Index>(emptyIndex());

    const [graph, setGraph] = useState<[Node[], Edge[]]>([[], []]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [isChanged, setIsChanged] = useState(false);
    const [savedGraphs, setSavedGraphs] = useState<Record<string, GraphDto>>({});
    const [loadedGraphName, setLoadedGraphName] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<SelectedPerson | null>(null);

    const app = useApp();

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!app) {
                return;
            }

            const familyIndex = await scanVaultForPersons(app, dataDir);

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
                const savedData = ((await plugin.loadData()) as GrafilyState) || DEFAULT_STATE;
                const graphsData = savedData.graphs;

                if (!graphsData || Object.keys(graphsData).length === 0) {
                    setSavedGraphs({});
                    return;
                }

                setSavedGraphs({ ...savedData.graphs });
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
        setIsChanged(true);
        if (selectedNode) {
            setSelectedNode({
                ...selectedNode,
                capabilities: layout.capabilities(selectedNode.id),
            });
        }
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
        setIsChanged(true);
        if (selectedNode) {
            setSelectedNode({
                ...selectedNode,
                capabilities: layout.capabilities(selectedNode.id),
            });
        }
    };

    const expandChildren = (nodeId: string) => {
        const newGraph = layout.expandChildren(nodeId);
        newGraph[0] = shiftGraphByAnchorNode(graph[0], newGraph[0], nodeId);

        setGraph(newGraph);
        setIsChanged(true);
        if (selectedNode) {
            setSelectedNode({
                ...selectedNode,
                capabilities: layout.capabilities(selectedNode.id),
            });
        }
    };

    const expandParents = (personId: string) => {
        const newGraph = layout.expandParents(personId);

        const [id] = personIdToNodeId(personId, index);
        newGraph[0] = shiftGraphByAnchorNode(graph[0], newGraph[0], id.id);

        setGraph(newGraph);
        setIsChanged(true);
        if (selectedNode) {
            setSelectedNode({
                ...selectedNode,
                capabilities: layout.capabilities(selectedNode.id),
            });
        }
    };

    const rearrange = (personId: string, action: RearrangeAction) => {
        const newGraph = layout.rearrange(personId, action);

        const [id] = personIdToNodeId(personId, index);
        newGraph[0] = shiftGraphByAnchorNode(graph[0], newGraph[0], id.id);

        setGraph(newGraph);
        setIsChanged(true);
        if (selectedNode) {
            setSelectedNode({
                ...selectedNode,
                capabilities: layout.capabilities(selectedNode.id),
            });
        }
    };

    const contains = (personId: string): boolean => {
        return layout.contains(personId);
    };

    const toggleSiblingVisibility = (personId: string) => {
        if (!selectedNode) {
            return;
        }

        const [nodeId] = personIdToNodeId(selectedNode.id, index);
        const newGraph = layout.toggleSiblingVisibility(personId, nodeId.id);

        newGraph[0] = shiftGraphByAnchorNode(graph[0], newGraph[0], selectedNode.id);

        setGraph(newGraph);
        setIsChanged(true);

        const updatedChildrenNodes = selectedNode.childrenNodes.map((children) => {
            return { personId: children.personId, isVisible: layout.contains(children.personId) };
        });

        setSelectedNode({
            ...selectedNode,
            capabilities: layout.capabilities(selectedNode.id),
            childrenNodes: updatedChildrenNodes,
        });
    };

    const handleBuildGraph = (layoutName: LayoutName, personId: string) => {
        const newLayout = new GenericLayout(layoutName, index);
        const newGraph = newLayout.buildNodes(personId);

        setLayout(newLayout);
        setGraph(newGraph);
        setIsInitialized(true);
        setIsChanged(true);
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
        setIsChanged(false);
    };

    const handleSaveGraph = async (name: string) => {
        if (!plugin) {
            console.error('Plugin instance not available');
            throw new Error('Plugin instance not available');
        }

        try {
            const existingStates = ((await plugin.loadData()) as GrafilyState) || DEFAULT_STATE;

            const graphDto: GraphDto = {
                data: graph,
                layout: layout.toSerializableObject(),
            };
            const graphs = {
                ...savedGraphs,
                [name]: graphDto,
            };

            const updatedStates: GrafilyState = {
                settings: existingStates.settings,
                graphs,
            };
            JSON.stringify(updatedStates);

            await plugin.saveData(updatedStates);
            setLoadedGraphName(name);

            setSavedGraphs(graphs);
            setIsChanged(false);

            console.debug(`Graph state "${name}" saved successfully`);
        } catch (err) {
            console.error('Failed to save graph state:', err);
            throw err;
        }
    };

    const handleDeleteGraph = async (graphName: string) => {
        if (!plugin) {
            console.warn('Plugin or app instance not available');

            return;
        }

        try {
            const existingStates = ((await plugin.loadData()) as GrafilyState) || DEFAULT_STATE;
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
            setLayout(DEFAULT_EMPTY_LAYOUT);

            const saved = savedGraphs;
            delete saved[graphName];
            setSavedGraphs({ ...saved });
        } catch (err) {
            console.error('Failed to delete graph state:', err);
            throw err;
        }
    };

    const handleHome = async () => {
        if (isChanged) {
            if (!app) {
                console.warn('App instance not available');
                return;
            }

            const confirmed = await confirmDialog(
                app,
                'You have unsaved changes. Are you sure you want to continue? This action cannot be undone.',
                'Ok',
            );

            if (!confirmed) {
                return;
            }
        }

        // Reset graph state and return to startup menu
        setLoadedGraphName(null);
        setGraph([[], []]);
        setIsInitialized(false);
        setIsChanged(false);
        setLayout(DEFAULT_EMPTY_LAYOUT);
    };

    const handleHomeClick = () => {
        handleHome().catch((err) => console.error(err));
    };

    const { getViewport, setViewport } = useReactFlow();

    const handleRevealNode = (nodeX: number, nodeY: number) => {
        const container = activeDocument.querySelector('.react-flow');
        if (!container) {
            return;
        }

        const viewport = getViewport();

        const screenCenterX = container.clientWidth / 2;
        const screenCenterY = container.clientHeight / 2;

        const nodeCenterX = nodeX + NODE_WIDTH / 2;
        const nodeCenterY = nodeY + NODE_HEIGHT / 2;

        const newX = screenCenterX - nodeCenterX * viewport.zoom;
        const newY = screenCenterY - nodeCenterY * viewport.zoom;

        setViewport({ x: newX, y: newY, zoom: viewport.zoom }, { duration: 300 }).catch((err) =>
            console.error(err),
        );
    };

    const refreshIndex = async () => {
        if (!app) {
            return;
        }

        const familyIndex = await scanVaultForPersons(app, dataDir);
        setIndex(familyIndex);
    };

    return (
        <GraphContext.Provider
            value={{
                layout,
                collapseChildren,
                collapseParents,
                expandChildren,
                expandParents,
                rearrange,
                index,
                selectedPerson: selectedNode,
                selectPerson: setSelectedNode,
                refreshIndex,
                contains,
                toggleSiblingVisibility,
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
                        selectedPerson={selectedNode}
                        onSave={handleSaveGraph}
                        onDelete={handleDeleteGraph}
                        onHome={handleHomeClick}
                        onRevealNode={handleRevealNode}
                        onRefresh={refreshIndex}
                    />
                )}
                {!isInitialized && (
                    <StartupMenu
                        persons={Array.from(index.personById.keys())}
                        savedGraphs={savedGraphs}
                        onSubmit={handleBuildGraph}
                        onLoadSavedGraph={handleLoadSavedGraph}
                        onDeleteSavedGraph={handleDeleteGraph}
                    />
                )}
            </div>
        </GraphContext.Provider>
    );
}

export function FamilyFlow({ plugin, dataDir }: { plugin: Plugin; dataDir: string }) {
    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                border: 'none',
            }}
        >
            <ReactFlowProvider>
                <FamilyGraph plugin={plugin} dataDir={dataDir} />
            </ReactFlowProvider>
        </div>
    );
}

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
