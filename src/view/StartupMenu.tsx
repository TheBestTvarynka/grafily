import { useState } from 'react';
import { BRANDES_KORF, REINGOLD_TILFORD, LayoutName } from '../layout';

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
                    <label className="grafily-startup-menu-label">Layout Algorithm</label>
                    <div className="grafily-startup-menu-options">
                        <label className="grafily-startup-menu-radio">
                            <input
                                type="radio"
                                name="layout"
                                value={BRANDES_KORF}
                                checked={selectedLayout === BRANDES_KORF}
                                onChange={() => setSelectedLayout(BRANDES_KORF)}
                            />
                            <span>Brandes-Kopf (General Graphs)</span>
                        </label>
                        <label className="grafily-startup-menu-radio">
                            <input
                                type="radio"
                                name="layout"
                                value={REINGOLD_TILFORD}
                                checked={selectedLayout === REINGOLD_TILFORD}
                                onChange={() => setSelectedLayout(REINGOLD_TILFORD)}
                            />
                            <span>Reingold-Tilford (Tree Structures)</span>
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
