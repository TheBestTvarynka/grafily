import { useState } from 'react';
import { BRANDES_KORF, REINGOLD_TILFORD, LayoutName } from '../layout';

export type StartupMenuProps = {
    persons: string[];
    onSubmit: (layoutName: LayoutName, personId: string) => void;
};

export function StartupMenu({ persons, onSubmit }: StartupMenuProps) {
    const [selectedLayout, setSelectedLayout] = useState<LayoutName>(BRANDES_KORF);
    const [selectedPerson, setSelectedPerson] = useState<string>(persons[0] ?? '');

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
                    <label htmlFor="person-select" className="grafily-startup-menu-label">
                        Starting person:
                    </label>
                    <select
                        id="person-select"
                        value={selectedPerson}
                        onChange={(e) => setSelectedPerson(e.target.value)}
                        className="dropdown"
                        style={{ height: '3em' }}
                    >
                        <option value="">Select a person...</option>
                        {persons.map((person) => (
                            <option key={person} value={person}>
                                {person}
                            </option>
                        ))}
                    </select>
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
