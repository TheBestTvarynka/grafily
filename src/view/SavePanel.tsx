import { useState } from 'react';
import { Node, Edge } from '@xyflow/react';
import { getIcon } from 'obsidian';

export type SavePanelProps = {
    nodes: Node[];
    edges: Edge[];
    onSave: (name: string, data: { nodes: Node[]; edges: Edge[] }) => Promise<void>;
};

export function SavePanel({ nodes, edges, onSave }: SavePanelProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSaveClick = () => {
        setIsModalOpen(true);
        setInputValue('');
    };

    const handleSave = async () => {
        if (!inputValue.trim()) {
            return;
        }

        setIsSaving(true);
        try {
            await onSave(inputValue, { nodes, edges });
            setIsModalOpen(false);
            setInputValue('');
        } catch (err) {
            console.error('Failed to save graph state:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setIsModalOpen(false);
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <>
            <div className="grafily-save-panel">
                <button
                    className="grafily-save-button"
                    onClick={handleSaveClick}
                    title="Save graph state"
                    dangerouslySetInnerHTML={{
                        __html: getIcon('save')?.outerHTML || '',
                    }}
                />
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
                                onClick={handleSave}
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
