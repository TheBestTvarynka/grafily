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
    const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);

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
        if (selectedPerson) {
            setSelectedPerson({
                ...selectedPerson,
                capabilities: layout.capabilities(selectedPerson.id),
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
        if (selectedPerson) {
            setSelectedPerson({
                ...selectedPerson,
                capabilities: layout.capabilities(selectedPerson.id),
            });
        }
    };

    const expandChildren = (nodeId: string) => {
        const newGraph = layout.expandChildren(nodeId);
        newGraph[0] = shiftGraphByAnchorNode(graph[0], newGraph[0], nodeId);

        setGraph(newGraph);
        setIsChanged(true);
        if (selectedPerson) {
            setSelectedPerson({
                ...selectedPerson,
                capabilities: layout.capabilities(selectedPerson.id),
            });
        }
    };

    const expandParents = (personId: string) => {
        const newGraph = layout.expandParents(personId);

        const [id] = personIdToNodeId(personId, index);
        newGraph[0] = shiftGraphByAnchorNode(graph[0], newGraph[0], id.id);

        setGraph(newGraph);
        setIsChanged(true);
        if (selectedPerson) {
            setSelectedPerson({
                ...selectedPerson,
                capabilities: layout.capabilities(selectedPerson.id),
            });
        }
    };

    const rearrange = (personId: string, action: RearrangeAction) => {
        const newGraph = layout.rearrange(personId, action);

        const [id] = personIdToNodeId(personId, index);
        newGraph[0] = shiftGraphByAnchorNode(graph[0], newGraph[0], id.id);

        setGraph(newGraph);
        setIsChanged(true);
        if (selectedPerson) {
            setSelectedPerson({
                ...selectedPerson,
                capabilities: layout.capabilities(selectedPerson.id),
            });
        }
    };

    const contains = (personId: string): boolean => {
        return layout.contains(personId);
    };

    const toggleSiblingVisibility = (personId: string) => {
        if (!selectedPerson) {
            return;
        }

        const [nodeId] = personIdToNodeId(selectedPerson.id, index);
        const newGraph = layout.toggleSiblingVisibility(personId, nodeId.id);

        newGraph[0] = shiftGraphByAnchorNode(graph[0], newGraph[0], selectedPerson.id);

        setGraph(newGraph);
        setIsChanged(true);

        const updatedChildrenNodes = selectedPerson.childrenNodes.map((children) => {
            return { personId: children.personId, isVisible: layout.contains(children.personId) };
        });

        setSelectedPerson({
            ...selectedPerson,
            capabilities: layout.capabilities(selectedPerson.id),
            childrenNodes: updatedChildrenNodes,
        });
    };

    const handleBuildGraph = (layoutName: LayoutName, personId: string) => {
        const newLayout = new GenericLayout(layoutName, index);
        const newGraph = newLayout.buildNodes(personId);

        const [id] = personIdToNodeId(personId, index);
        const newNode = newGraph[0].find((n) => n.id === id.id);
        if (newNode) {
            // We cannot use `reactflow`-related API because this function is located outside of the `ReactFlow`
            // component. Instead, we will calculate the center of the graph container and shift by its half-size.
            // It is not center-perfect (because it does not include node size), but it is good enough.
            //
            // Important: the viewport scale must be 1.0 and viewport (x; y) mut be (0; 0).
            const familyGraphContainer = document.getElementById('familyGraphContainer');
            let dx = 0;
            let dy = 0;
            if (familyGraphContainer) {
                dx = familyGraphContainer.clientWidth / 2;
                dy = familyGraphContainer.clientHeight / 2;
            }

            newGraph[0] = shiftGraphBy(
                newGraph[0],
                newNode.position.x - dx,
                newNode.position.y - dy,
            );
        } else {
            console.error(`Node with id ${id.id} not found in the new graph.`);
        }

        const personNode = newGraph[0].find((node) => node.id === personId);
        let x = 0;
        let y = 0;

        if (personNode) {
            x = personNode.position.x;
            y = personNode.position.y;
        } else {
            console.error(
                `Person node with id ${personId} not found in the new graph. Defaulting position to (0, 0).`,
            );

            x = 0;
            y = 0;
        }

        const children = index.personChildren.get(personId) ?? [];

        setLayout(newLayout);
        setGraph(newGraph);
        setIsInitialized(true);
        setIsChanged(true);
        setSelectedPerson({
            id: personId,
            x,
            y,
            capabilities: newLayout.capabilities(personId),
            childrenNodes: children.map((childrenId) => {
                return {
                    personId: childrenId,
                    isVisible: newLayout.contains(childrenId),
                };
            }),
        });
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

    const handleHome = async (updateViewport: () => void) => {
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

        updateViewport();

        // Reset graph state and return to startup menu
        setLoadedGraphName(null);
        setGraph([[], []]);
        setIsInitialized(false);
        setIsChanged(false);
        setLayout(DEFAULT_EMPTY_LAYOUT);
    };

    const handleHomeClick = (updateViewport: () => void) => {
        handleHome(updateViewport).catch((err) => console.error(err));
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
                selectedPerson: selectedPerson,
                selectPerson: setSelectedPerson,
                refreshIndex,
                contains,
                toggleSiblingVisibility,
            }}
        >
            <div
                id="familyGraphContainer"
                style={{ position: 'relative', width: '100%', height: '100%' }}
            >
                <ReactFlow nodes={graph[0]} edges={graph[1]} nodeTypes={nodeTypes}>
                    <Background color="grey" variant={BackgroundVariant.Dots} gap={20} />
                    <Controls />
                </ReactFlow>
                {isInitialized && (
                    <SidePanel
                        loadedGraphName={loadedGraphName}
                        selectedPerson={selectedPerson}
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

    return shiftGraphBy(newNodes, dx, dy);
};

const shiftGraphBy = (nodes: Node[], dx: number, dy: number): Node[] => {
    return nodes.map((node) => {
        node.position.x -= dx;
        node.position.y -= dy;

        return node;
    });
};
