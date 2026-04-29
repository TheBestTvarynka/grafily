import { useState } from 'react';
import { BRANDES_KORF, REINGOLD_TILFORD, LayoutName } from '../layout';
import { GRAPH_ICON, TREE_ICON } from 'images';

export type StartupMenuProps = {
    persons: string[];
    onSubmit: (layoutName: LayoutName, personId: string) => void;
};

export function StartupMenu({ persons, onSubmit }: StartupMenuProps) {
    const [selectedLayout, setSelectedLayout] = useState<LayoutName>(BRANDES_KORF);
    const [selectedPerson, setSelectedPerson] = useState<string>(persons[0] ?? '');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const filteredPersons = persons.filter((person) =>
        person.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    const handleSelectPerson = (person: string) => {
        setSelectedPerson(person);
        setSearchQuery('');
    };

    const handleSubmit = () => {
        if (selectedPerson) {
            onSubmit(selectedLayout, selectedPerson);
        }
    };

    return (
        <div className="grafily-startup-menu-overlay">
            <div className="grafily-startup-menu">
                <h2>Grafily - Family Graph</h2>

                <div className="grafily-startup-menu-section">
                    <div className="grafily-startup-menu-options">
                        <label className="grafily-startup-menu-radio">
                            <input
                                type="radio"
                                name="layout"
                                value={BRANDES_KORF}
                                checked={selectedLayout === BRANDES_KORF}
                                onChange={() => setSelectedLayout(BRANDES_KORF)}
                            />
                            <span>Brandes-Kopf</span>
                            <span>
                                Perfect for graph of any complexity. Interactive nodes collapsing or
                                expanding.{' '}
                                <strong>
                                    Not all nodes are centered related to its ancestors or
                                    descendants.
                                </strong>
                            </span>
                            <img src={GRAPH_ICON} style={{ width: '80%' }} />
                        </label>
                        <label className="grafily-startup-menu-radio">
                            <input
                                type="radio"
                                name="layout"
                                value={REINGOLD_TILFORD}
                                checked={selectedLayout === REINGOLD_TILFORD}
                                onChange={() => setSelectedLayout(REINGOLD_TILFORD)}
                            />
                            <span>Reingold-Tilford</span>
                            <span>
                                Includes only direct ancestors and descendants of the selected
                                person.{' '}
                                <strong>
                                    All nodes are perfectly centered related to their ancestors or
                                    descendants.
                                </strong>
                            </span>
                            <img src={TREE_ICON} style={{ width: '60%' }} />
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
                    <button onClick={handleSubmit} disabled={!selectedPerson} className="mod-cta">
                        Start
                    </button>
                </div>
            </div>
        </div>
    );
}
