import { useState } from 'react';
import {
    BRANDES_KORF,
    DEFAULT_ALGORITHM,
    GRAPH,
    LayoutKind,
    LayoutOptions,
    PositioningAlgorithm,
    QUADRATIC,
    TREE,
} from '../layout';
import { GRAPH_ICON, TREE_ICON } from 'images';
import { getIcon } from 'obsidian';
import { useApp } from '../hooks';
import { confirmDialog } from './ConfirmModal';
import { GraphDto } from './graph';

export type StartupMenuProps = {
    persons: string[];
    savedGraphs?: Record<string, GraphDto>;
    onSubmit: (options: LayoutOptions, personId: string) => void;
    onLoadSavedGraph?: (graphName: string) => void;
    onDeleteSavedGraph?: (graphName: string) => Promise<void>;
};

export function StartupMenu({
    persons,
    savedGraphs = {},
    onSubmit,
    onLoadSavedGraph,
    onDeleteSavedGraph,
}: StartupMenuProps) {
    const [kind, setKind] = useState<LayoutKind>(GRAPH);
    const [algorithm, setAlgorithm] = useState<PositioningAlgorithm>(DEFAULT_ALGORITHM);
    const [selectedPerson, setSelectedPerson] = useState<string>(persons[0] ?? '');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedSavedGraph, setSelectedSavedGraph] = useState<string>('');
    const app = useApp();

    const filteredPersons = persons.filter((person) =>
        person.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const savedGraphNames = Object.keys(savedGraphs);

    const handleSelectPerson = (person: string) => {
        setSelectedPerson(person);
        setSearchQuery('');
    };

    const handleSubmit = () => {
        if (selectedPerson) {
            onSubmit({ kind, algorithm }, selectedPerson);
        }
    };

    const handleLoadSavedGraph = () => {
        if (selectedSavedGraph && onLoadSavedGraph) {
            const graphData = savedGraphs[selectedSavedGraph];
            if (graphData) {
                onLoadSavedGraph(selectedSavedGraph);
            }
        }
    };

    const handleDeleteSavedGraph = async (graphName: string) => {
        if (!onDeleteSavedGraph || !app) {
            return;
        }

        const confirmed = await confirmDialog(
            app,
            `Are you sure you want to delete "${graphName}"?`,
        );
        if (!confirmed) {
            return;
        }

        try {
            await onDeleteSavedGraph(graphName);
            if (selectedSavedGraph === graphName) {
                setSelectedSavedGraph('');
            }
        } catch (err) {
            console.error('Failed to delete graph:', err);
        }
    };

    return (
        <div className="grafily-startup-menu-overlay">
            <div className="grafily-startup-menu">
                <div className="grafily-startup-menu-container">
                    <div className="grafily-startup-menu-left">
                        <div className="grafily-startup-menu-section">
                            <span className="grafily-startup-menu-label">Layout:</span>
                            <div className="grafily-startup-menu-options">
                                <label className="grafily-startup-menu-radio">
                                    <input
                                        type="radio"
                                        name="kind"
                                        value={GRAPH}
                                        checked={kind === GRAPH}
                                        onChange={() => setKind(GRAPH)}
                                    />
                                    <span>Graph explorer</span>
                                    <span>
                                        Start with a graph that includes siblings of direct
                                        relatives.
                                    </span>
                                    <img src={GRAPH_ICON} style={{ width: '80%' }} />
                                </label>
                                <label className="grafily-startup-menu-radio">
                                    <input
                                        type="radio"
                                        name="kind"
                                        value={TREE}
                                        checked={kind === TREE}
                                        onChange={() => setKind(TREE)}
                                    />
                                    <span>Family tree</span>
                                    <span>Start with person's family tree.</span>
                                    <img src={TREE_ICON} style={{ width: '60%' }} />
                                </label>
                            </div>
                        </div>

                        <div className="grafily-startup-menu-section">
                            <span className="grafily-startup-menu-label">Positioning:</span>
                            <div className="grafily-startup-menu-options">
                                <label className="grafily-startup-menu-radio">
                                    <input
                                        type="radio"
                                        name="algorithm"
                                        value={QUADRATIC}
                                        checked={algorithm === QUADRATIC}
                                        onChange={() => setAlgorithm(QUADRATIC)}
                                    />
                                    <span>Quadratic</span>
                                </label>
                                <label className="grafily-startup-menu-radio">
                                    <input
                                        type="radio"
                                        name="algorithm"
                                        value={BRANDES_KORF}
                                        checked={algorithm === BRANDES_KORF}
                                        onChange={() => setAlgorithm(BRANDES_KORF)}
                                    />
                                    <span>Brandes-Kopf</span>
                                </label>
                            </div>
                        </div>

                        <div className="grafily-startup-menu-section">
                            <label htmlFor="person-search" className="grafily-startup-menu-label">
                                Starting person:
                            </label>
                            <input
                                id="person-search"
                                type="text"
                                placeholder="Search person..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="grafily-startup-menu-search-input"
                            />
                            {filteredPersons.length > 0 && (
                                <ul className="grafily-startup-menu-person-list">
                                    {filteredPersons.map((person) => (
                                        <li
                                            key={person}
                                            className={`grafily-startup-menu-person-item ${
                                                selectedPerson === person ? 'selected' : ''
                                            }`}
                                            onClick={() => handleSelectPerson(person)}
                                        >
                                            {person}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {selectedPerson && (
                                <div className="grafily-startup-menu-selected-person">
                                    Selected: <strong>{selectedPerson}</strong>
                                </div>
                            )}
                        </div>

                        <div className="grafily-startup-menu-actions">
                            <button
                                onClick={handleSubmit}
                                disabled={!selectedPerson}
                                className="mod-cta"
                            >
                                Start
                            </button>
                        </div>
                    </div>

                    {savedGraphNames.length > 0 && (
                        <div className="grafily-startup-menu-right">
                            <h3>Saved graphs</h3>
                            <ul className="grafily-startup-menu-saved-list">
                                {savedGraphNames.map((graphName) => (
                                    <li
                                        key={graphName}
                                        className={`grafily-startup-menu-saved-item ${
                                            selectedSavedGraph === graphName ? 'selected' : ''
                                        }`}
                                    >
                                        <div
                                            className="grafily-startup-menu-saved-item-content"
                                            onClick={() => setSelectedSavedGraph(graphName)}
                                        >
                                            {graphName}
                                        </div>
                                        {onDeleteSavedGraph && (
                                            <button
                                                className="grafily-delete-button"
                                                onClick={() => {
                                                    handleDeleteSavedGraph(graphName).catch((err) =>
                                                        console.error(
                                                            'Failed to delete graph:',
                                                            err,
                                                        ),
                                                    );
                                                }}
                                                title="Delete this graph"
                                                dangerouslySetInnerHTML={{
                                                    __html: getIcon('trash')?.outerHTML || '',
                                                }}
                                            />
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={handleLoadSavedGraph}
                                disabled={!selectedSavedGraph}
                                className="mod-cta"
                                style={{ width: '100%', marginTop: '8px' }}
                            >
                                Load
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
