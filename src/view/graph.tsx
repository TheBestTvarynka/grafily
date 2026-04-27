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
    collapseParents: (personId: string) => void;

    expandChildren: (nodeId: string) => void;
    expandParents: (personId: string) => void;
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

    const [graph, setGraph] = useState<[Node[], Edge[]]>([[], []]);

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
                <Background color="grey" variant={BackgroundVariant.Dots} gap={20} />
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
