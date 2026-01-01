import { StrictMode, useState } from 'react';
import { ItemView, TFile, WorkspaceLeaf } from 'obsidian';
import { Root, createRoot } from 'react-dom/client';
import { buildIndex, defaultFamily } from 'model';
import { ReactFlow, Node, Edge, Background, Controls, ReactFlowProvider, BackgroundVariant, Handle, Position } from '@xyflow/react';
import { buildNodes } from 'layout';

function PersonNode({ data }: any) {
    return (
        <div style={{
            padding: '0.5em',
            border: '1px solid #222',
            borderRadius: '4px',
            background: '#fff',
            width: '100px',
            height: '40px',
            display: 'inline-flex',
            justifyContent: 'center',
        }}>
            <div>{data.label}</div>
            <Handle type="target" position={Position.Top} id='top' />
            <Handle type="target" position={Position.Bottom} id='bottom' />
            <Handle type="target" position={Position.Left} id='left' />
            <Handle type="target" position={Position.Right} id='right' />
        </div>
    );
}

function MarriageNode() {
    return (
        <div style={{ padding: '0.2em', height: '10px', width: '10px' }}>
            <Handle type="source" position={Position.Left} id='left' />
            <Handle type="source" position={Position.Right} id='right' />
            <Handle type="source" position={Position.Bottom} id='bottom' />
        </div>
    );
}

const nodeTypes = {
    personNode: PersonNode,
    marriageNode: MarriageNode,
};

function FamilyGraph() {
    const [variant, setVariant] = useState(BackgroundVariant.Dots);

    const family = defaultFamily();
    const index = buildIndex(family);

    const nodes: Node[] = buildNodes('yaroslav', index);
    const edges: Edge[] = [];

    return (
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes}>
            <Background color="skyblue" variant={variant} />
            <Controls />
        </ReactFlow>
    );
}

export function FamilyFlow() {
    return (
        <div style={{ width: '1500px', height: '900px', border: '2px solid #ccc', position: 'relative', overflow: 'visible' }}>
            <ReactFlowProvider>
                <FamilyGraph />
            </ReactFlowProvider>
        </div>
    );
}

export const VIEW_TYPE = "my-canvas-view";

export const ReactView = ({ name, files }: { name: string, files: TFile[] }) => {
    return (
        <div>
            <FamilyFlow />
        </div>
    );
};

export class MyCanvasView extends ItemView {
    root: Root | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType() {
        return VIEW_TYPE;
    }

    getDisplayText() {
        return 'Family Tree View';
    }

    async onOpen() {
        let vault = this.app.vault;
        let name = vault.getName();
        let files = vault.getFiles();

        this.root = createRoot(this.contentEl);
        this.root.render(
            <StrictMode>
                <ReactView name={name} files={files} />
            </StrictMode>
        );
    }

    async onClose() {
        this.root?.unmount();
    }
}
