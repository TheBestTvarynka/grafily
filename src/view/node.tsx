import { Handle, Position } from '@xyflow/react';

/* eslint-disable  @typescript-eslint/no-explicit-any */
export function PersonNode({ data }: any) {
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
            <div>
                {
                    /* eslint-disable  @typescript-eslint/no-unsafe-member-access */
                    data.label
                }
            </div>
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
