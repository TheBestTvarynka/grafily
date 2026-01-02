import { Handle, Position } from '@xyflow/react';
import { useApp } from 'hooks';
import { TFile } from 'obsidian';

// Fuck TS.
/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/no-unsafe-member-access */
export function PersonNode({ data }: any) {
    const app = useApp();

    const onClick = () => {
        if (!app) {
            return;
        }

        /* eslint-disable  @typescript-eslint/no-unsafe-assignment */
        const file = data?.file;
        if (!file) {
            console.warn('node data.file does not present');
            return;
        }

        if (!(file instanceof TFile)) {
            return;
        }

        app.workspace
            .getLeaf('tab')
            .openFile(file, { active: true })
            .catch((err) => console.error(err));
    };

    return (
        <div
            style={{
                padding: '0.5em',
                border: '1px solid #222',
                borderRadius: '4px',
                background: '#fff',
                width: '100px',
                height: '40px',
                display: 'inline-flex',
                justifyContent: 'center',
            }}
        >
            <div onClick={onClick}>{data.label}</div>
            <Handle type="target" position={Position.Top} id="top" />
            <Handle type="target" position={Position.Bottom} id="bottom" />
            <Handle type="target" position={Position.Left} id="left" />
            <Handle type="target" position={Position.Right} id="right" />
        </div>
    );
}

export function MarriageNode() {
    return (
        <div style={{ padding: '0.2em', height: '10px', width: '10px' }}>
            <Handle type="source" position={Position.Left} id="left" />
            <Handle type="source" position={Position.Right} id="right" />
            <Handle type="source" position={Position.Bottom} id="bottom" />
        </div>
    );
}
