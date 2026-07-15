import { Handle, Position } from '@xyflow/react';
import { useGraph } from '../../hooks';
import { MINUS_ICON, PLUS_ICON } from '../../images';
import { useEffect, useState } from 'react';
import { MARRIAGE_NODE_SIZE } from '../../layout';

export type MarriageNodeData = {
    id: string;
    isChildrenCollapsible: boolean;
    isChildrenCollapsed: boolean;
};

export function MarriageNode({ data }: { data: MarriageNodeData }) {
    const graph = useGraph();

    const [hasChildren, setHasChildren] = useState<boolean>(true);

    useEffect(() => {
        if (!graph) {
            return;
        }

        const marriage = graph.index.marriageById.get(data.id);
        if (!marriage) {
            console.warn(`Expected marriage(id=${data.id}) to exist in index.`);
            return;
        }

        if (marriage.childrenIds.length > 0) {
            setHasChildren(true);
        } else {
            setHasChildren(false);
        }
    }, [graph]);

    const getHideChildNodesIcon = (): string => {
        if (data.isChildrenCollapsed) {
            return PLUS_ICON;
        } else {
            return MINUS_ICON;
        }
    };

    const collapseChildren = () => {
        if (!graph) {
            return;
        }

        const id = data.id;

        if (data.isChildrenCollapsed) {
            graph.expandChildren(id);
        } else {
            graph.collapseChildren(id);
        }
    };

    return (
        <div
            style={{
                padding: '0.2em',
                height: `${MARRIAGE_NODE_SIZE}px`,
                width: `${MARRIAGE_NODE_SIZE}px`,
                position: 'relative',
            }}
        >
            {data.isChildrenCollapsible && hasChildren ? (
                <button
                    onClick={collapseChildren}
                    style={{
                        outline: 'revert',
                        position: 'absolute',
                        top: 'calc(-50% + 4px)',
                        left: 'calc(-50% + 3px)',
                        padding: 0,
                        cursor: 'pointer',
                        zIndex: 99,
                        backgroundColor: 'transparent',
                        height: '14px',
                        width: '14px',
                    }}
                >
                    <img
                        src={getHideChildNodesIcon()}
                        style={{
                            height: '100%',
                            width: '100%',
                            backgroundColor: 'rgb(64, 55, 53)',
                            borderRadius: '3px',
                        }}
                    />
                </button>
            ) : (
                <></>
            )}
            <Handle type="source" position={Position.Left} id="left" />
            <Handle type="source" position={Position.Right} id="right" />
            {hasChildren ? <Handle type="source" position={Position.Bottom} id="bottom" /> : <></>}
        </div>
    );
}
