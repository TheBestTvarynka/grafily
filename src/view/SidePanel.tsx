import { useState, KeyboardEvent } from 'react';
import { getIcon } from 'obsidian';
import { useGraph } from 'hooks';
import {
    MOVE_PERSON_LEFT,
    MOVE_PERSON_RIGHT,
    NodeCapabilities,
    SWAP_MARRIAGE_SPOUSES,
} from 'layout';

export type SelectedNode = {
    id: string;
    x: number;
    y: number;
    capabilities: NodeCapabilities;
};

export type SidePanelProps = {
    loadedGraphName: string | null;
    selectedNode: SelectedNode | null;
    onSave: (name: string) => Promise<void>;
    onDelete: (graphName: string) => Promise<void>;
    onHome: () => void;
    onRevealNode: (x: number, y: number) => void;
    onRefresh: () => Promise<void>;
};

export function SidePanel({
    loadedGraphName,
    selectedNode,
    onSave,
    onDelete,
    onHome,
    onRevealNode,
    onRefresh,
}: SidePanelProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const graph = useGraph();

    const handleSaveClick = () => {
        // If graph name is known, save directly without modal
        if (loadedGraphName) {
            handleSave(loadedGraphName).catch((err) =>
                console.error('Failed to save graph state:', err),
            );
        } else {
            setIsModalOpen(true);
            setInputValue('');
        }
    };

    const handleSave = async (graphName: string) => {
        if (!graphName.trim()) {
            return;
        }

        setIsSaving(true);
        try {
            await onSave(graphName);
            setIsModalOpen(false);
            setInputValue('');
        } catch (err) {
            console.error('Failed to save graph state:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = () => {
        if (!loadedGraphName || !onDelete) {
            return;
        }

        /* eslint-disable no-alert */
        if (!confirm(`Are you sure you want to delete "${loadedGraphName}"?`)) {
            return;
        }

        try {
            onDelete(loadedGraphName).catch((err) =>
                console.error('Failed to delete graph state:', err),
            );
        } catch (err) {
            console.error('Failed to delete graph state:', err);
        }
    };

    const handleRefresh = () => {
        onRefresh().catch((err) => console.error(err));
    };

    const handleSaveFromModal = () => {
        handleSave(inputValue).catch((err) => console.error(err));
    };

    const handleCancel = () => {
        setIsModalOpen(false);
        setInputValue('');
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSaveFromModal();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    const moveNodeLeft = () => {
        if (!graph || !selectedNode) {
            return;
        }

        graph.rearrange(selectedNode.id, MOVE_PERSON_LEFT);
    };

    const moveNodeRight = () => {
        if (!graph || !selectedNode) {
            return;
        }

        graph.rearrange(selectedNode.id, MOVE_PERSON_RIGHT);
    };

    const swapSpouses = () => {
        if (!graph || !selectedNode) {
            return;
        }

        graph.rearrange(selectedNode.id, SWAP_MARRIAGE_SPOUSES);
    };

    return (
        <>
            <div className="grafily-save-panel">
                {selectedNode && (
                    <div className="grafily-direction-buttons">
                        <button
                            className="grafily-direction-button"
                            onClick={moveNodeLeft}
                            title="Move node left"
                            dangerouslySetInnerHTML={{
                                __html: getIcon('move-left')?.outerHTML || '',
                            }}
                            disabled={!selectedNode.capabilities.movableLeft}
                        />
                        <button
                            className="grafily-direction-button"
                            onClick={moveNodeRight}
                            title="Move node right"
                            dangerouslySetInnerHTML={{
                                __html: getIcon('move-right')?.outerHTML || '',
                            }}
                            disabled={!selectedNode.capabilities.movableRight}
                        />
                        <button
                            className="grafily-direction-button"
                            onClick={swapSpouses}
                            title="Swap position with spouse"
                            dangerouslySetInnerHTML={{
                                __html: getIcon('arrow-right-left')?.outerHTML || '',
                            }}
                            disabled={!selectedNode.capabilities.spousesSwappable}
                        />
                        <button
                            className="grafily-direction-button"
                            onClick={() => {
                                onRevealNode(selectedNode.x, selectedNode.y);
                            }}
                            title="Reveal the node"
                            dangerouslySetInnerHTML={{
                                __html: getIcon('eye')?.outerHTML || '',
                            }}
                        />
                    </div>
                )}
                <button
                    className="grafily-home-button"
                    onClick={onHome}
                    title="Return to home menu"
                    dangerouslySetInnerHTML={{
                        __html: getIcon('house')?.outerHTML || '',
                    }}
                />
                <button
                    className="grafily-save-button"
                    onClick={handleRefresh}
                    title="Refresh graph (rescan vault)"
                    dangerouslySetInnerHTML={{
                        __html: getIcon('refresh-ccw')?.outerHTML || '',
                    }}
                />
                <button
                    className="grafily-save-button"
                    onClick={handleSaveClick}
                    title="Save graph state"
                    dangerouslySetInnerHTML={{
                        __html: getIcon('save')?.outerHTML || '',
                    }}
                />
                {loadedGraphName && (
                    <button
                        className="grafily-delete-button"
                        onClick={handleDeleteClick}
                        title="Delete current graph state"
                        dangerouslySetInnerHTML={{
                            __html: getIcon('trash')?.outerHTML || '',
                        }}
                    />
                )}
            </div>

            {isModalOpen && (
                <div className="grafily-save-modal-overlay" onClick={handleCancel}>
                    <div className="grafily-save-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Save graph state</h3>
                        <input
                            type="text"
                            placeholder="Enter a name for this state..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="grafily-save-input"
                        />
                        <div className="grafily-save-modal-actions">
                            <button
                                onClick={handleCancel}
                                disabled={isSaving}
                                className="grafily-save-modal-cancel"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveFromModal}
                                disabled={isSaving || !inputValue.trim()}
                                className="grafily-save-modal-confirm mod-cta"
                            >
                                {isSaving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
