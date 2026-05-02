import { useState, KeyboardEvent } from 'react';
import { getIcon } from 'obsidian';

export type SidePanelProps = {
    loadedGraphName?: string | null;
    onSave: (name: string) => Promise<void>;
    onDelete?: (graphName: string) => Promise<void>;
    onHome: () => void;
};

export function SidePanel({ loadedGraphName, onSave, onDelete, onHome }: SidePanelProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);

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

    const handleSaveFromModal = () => {
        handleSave(inputValue).catch((err) => console.error('Failed to save graph state:', err));
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

    return (
        <>
            <div className="grafily-save-panel">
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
                    onClick={handleSaveClick}
                    title="Save graph state"
                    dangerouslySetInnerHTML={{
                        __html: getIcon('save')?.outerHTML || '',
                    }}
                />
                {loadedGraphName && onDelete && (
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
