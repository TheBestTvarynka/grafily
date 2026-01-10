import { createContext, useContext, useEffect, useState } from 'react';

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

import { buildNodes } from '../layout';
import { buildIndex, emptyIndex, familyFromPersons, Index, Person } from '../model';
import { useApp, useIndex } from '../hooks';
import { extractPageMeta } from '../parsing';
import { PersonNode, MarriageNode } from './node';

const nodeTypes = {
    personNode: PersonNode,
    marriageNode: MarriageNode,
};

function FamilyGraph() {
    const { fitView } = useReactFlow();
    const [graph, setGraph] = useState<[Node[], Edge[]]>([[], []]);
    const index = useIndex();

    useEffect(() => {
        if (graph[0].length === 0) {
            return;
        }

        fitView({ padding: 0, duration: 2000 }).catch((err) => console.error(err));
    }, [graph, fitView]);

    const app = useApp();
    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (!app || !index) {
                return;
            }

            console.log('rerender');

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
                        console.error(err);
                    }
                }
            }

            const family = familyFromPersons(persons);
            const familyIndex = buildIndex(family);
            index.resetIndex(familyIndex);
            const graph = buildNodes('Yaroslav', familyIndex);

            if (!cancelled) {
                setGraph(graph);
            }
        })().catch((err) => console.error(err));

        return () => {
            cancelled = true;
        };
    }, [app]);

    return (
        <ReactFlow nodes={graph[0]} edges={graph[1]} nodeTypes={nodeTypes}>
            <Background color="grey" variant={BackgroundVariant.Dots} gap={10} />
            <Controls />
        </ReactFlow>
    );
}

export type IndexContextValue = {
    index: Index;
    setPerson: (person: Person) => void;
    resetIndex: (index: Index) => void;
};
export const IndexContext = createContext<IndexContextValue | null>(null);

export function FamilyFlow() {
    const [index, setIndex] = useState<Index>(emptyIndex);

    const setPerson = (person: Person) => {
        console.log('set person');
        index.personById.set(person.id, person);

        setIndex({ ...index });
    };

    const resetIndex = (index: Index) => {
        setIndex(index);
    };

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                border: 'none',
            }}
        >
            <IndexContext.Provider value={{ index, setPerson, resetIndex }}>
                <ReactFlowProvider>
                    <FamilyGraph />
                </ReactFlowProvider>
            </IndexContext.Provider>
        </div>
    );
}
