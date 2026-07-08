import { useState, KeyboardEvent } from 'react';
import { getIcon } from 'obsidian';
import { useReactFlow } from '@xyflow/react';
import { useApp, useGraph } from 'hooks';
import {
    MOVE_PERSON_LEFT,
    MOVE_PERSON_RIGHT,
    NodeCapabilities,
    SWAP_MARRIAGE_SPOUSES,
} from 'layout';
import { SimplePersonNode } from './node';
import { confirmDialog } from './ConfirmModal';

export type ChildNodePreview = {
    personId: string;
    isVisible: boolean;
};

export type SelectedPerson = {
    id: string;
    x: number;
    y: number;
    capabilities: NodeCapabilities;
    childrenNodes: ChildNodePreview[];
};

export type SidePanelProps = {
    loadedGraphName: string | null;
    selectedPerson: SelectedPerson | null;
    onSave: (name: string) => Promise<void>;
    onDelete: (graphName: string) => Promise<void>;
    // `updateViewport` is a callback function that will be called when the user confirms
    // that they want to return to the home menu. When there are unsaved changes, the user
    // may discard `onHome` action to save the changes. In that case, we do not need to
    // reset the viewport. Only when the user confirms the action, the outer component will
    // call `updateViewport` to reset the viewport.
    // We cannot track unsaved changes in `SidePanel` because it's a job for the outer component.
    onHome: (updateViewport: () => void) => void;
    onRevealNode: (x: number, y: number) => void;
    onRefresh: () => Promise<void>;
};

export function SidePanel({
    loadedGraphName,
    selectedPerson,
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
    const app = useApp();

    const reactFlowInstance = useReactFlow();

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

    const confirmAndDelete = async () => {
        if (!loadedGraphName || !onDelete || !app) {
            return;
        }

        const confirmed = await confirmDialog(
            app,
            `Are you sure you want to delete "${loadedGraphName}"?`,
        );
        if (!confirmed) {
            return;
        }

        // Set default viewport state.
        reactFlowInstance
            .setViewport({ x: 0, y: 0, zoom: 1 })
            .catch((err) => console.error('Failed to reset viewport:', err));

        try {
            await onDelete(loadedGraphName);
        } catch (err) {
            console.error('Failed to delete graph state:', err);
        }
    };

    const handleDeleteClick = () => {
        confirmAndDelete().catch((err) => console.error('Failed to delete graph state:', err));
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
        if (!graph || !selectedPerson) {
            return;
        }

        graph.rearrange(selectedPerson.id, MOVE_PERSON_LEFT);
    };

    const moveNodeRight = () => {
        if (!graph || !selectedPerson) {
            return;
        }

        graph.rearrange(selectedPerson.id, MOVE_PERSON_RIGHT);
    };

    const swapSpouses = () => {
        if (!graph || !selectedPerson) {
            return;
        }

        graph.rearrange(selectedPerson.id, SWAP_MARRIAGE_SPOUSES);
    };

    const confirmAndHome = async () => {
        onHome(() => {
            // Set default viewport state.
            reactFlowInstance
                .setViewport({ x: 0, y: 0, zoom: 1 })
                .catch((err) => console.error('Failed to reset viewport:', err));
        });
    };

    const handleHomeClick = () => {
        confirmAndHome().catch((err) => console.error(err));
    };

    return (
        <>
            <div className="grafily-save-panel">
                <div className="grafily-direction-buttons">
                    {selectedPerson && (
                        <>
                            <button
                                className="grafily-direction-button"
                                onClick={moveNodeLeft}
                                title="Move node left"
                                dangerouslySetInnerHTML={{
                                    __html: getIcon('move-left')?.outerHTML || '',
                                }}
                                disabled={!selectedPerson.capabilities.movableLeft}
                            />
                            <button
                                className="grafily-direction-button"
                                onClick={moveNodeRight}
                                title="Move node right"
                                dangerouslySetInnerHTML={{
                                    __html: getIcon('move-right')?.outerHTML || '',
                                }}
                                disabled={!selectedPerson.capabilities.movableRight}
                            />
                            <button
                                className="grafily-direction-button"
                                onClick={swapSpouses}
                                title="Swap position with spouse"
                                dangerouslySetInnerHTML={{
                                    __html: getIcon('arrow-right-left')?.outerHTML || '',
                                }}
                                disabled={!selectedPerson.capabilities.spousesSwappable}
                            />
                            <button
                                className="grafily-direction-button"
                                onClick={() => {
                                    onRevealNode(selectedPerson.x, selectedPerson.y);
                                }}
                                title="Reveal the node"
                                dangerouslySetInnerHTML={{
                                    __html: getIcon('eye')?.outerHTML || '',
                                }}
                            />
                        </>
                    )}
                    <button
                        className="grafily-home-button"
                        onClick={handleHomeClick}
                        title="Return to home menu"
                        dangerouslySetInnerHTML={{
                            __html: getIcon('house')?.outerHTML || '',
                        }}
                    />
                </div>
                <button
                    className="grafily-save-button"
                    onClick={handleSaveClick}
                    title="Save graph state"
                    dangerouslySetInnerHTML={{
                        __html: getIcon('save')?.outerHTML || '',
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
                {selectedPerson && selectedPerson.childrenNodes.length > 0 && (
                    <div className="grafily-children-list">
                        {selectedPerson.childrenNodes.map((child) => (
                            <SimplePersonNode
                                personId={child.personId}
                                isVisible={child.isVisible}
                                key={child.personId}
                            />
                        ))}
                    </div>
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
