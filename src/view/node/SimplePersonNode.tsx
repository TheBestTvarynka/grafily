import { MouseEvent } from 'react';
import { getIcon, TFile } from 'obsidian';
import { useApp, useGraph } from '../../hooks';
import { PersonVisibility } from '../../layout';
import { PersonNode } from './PersonNode';
import { NONE_SIDE } from '../../model';

export function SimplePersonNode({
    personId,
    visibility,
}: {
    personId: string;
    visibility: PersonVisibility;
}) {
    const app = useApp();
    const graph = useGraph();

    const onClick = (e: MouseEvent) => {
        if (!graph) {
            return;
        }

        e.stopPropagation();

        if (e.ctrlKey || e.metaKey) {
            if (!app) {
                return;
            }

            const person = graph.index.personById.get(personId);
            const file = person?.file;
            if (!file) {
                console.warn('node data.file does not present');
                return;
            }

            if (!(file instanceof TFile)) {
                return;
            }

            app.workspace
                .getLeaf('tab')
                .openFile(file, { active: true })
                .catch((err) => console.error(err));
        } else {
            if (!visibility.disabled) {
                graph.toggleSiblingVisibility(personId);
            }
        }
    };

    const classes = ['grafily-simple-node', !visibility.isVisible && 'grafily-node-hidden']
        .filter(Boolean)
        .join(' ');

    return (
        <div
            className={classes}
            onClick={onClick}
            title={visibility.isVisible ? 'Hide node' : 'Show node'}
        >
            {!visibility.disabled ? (
                <div
                    className="grafily-simple-node-hover-overlay"
                    dangerouslySetInnerHTML={{
                        __html: getIcon(visibility.isVisible ? 'eye-off' : 'eye')?.outerHTML || '',
                    }}
                />
            ) : (
                <div></div>
            )}
            <PersonNode
                positionAbsoluteX={0}
                positionAbsoluteY={0}
                data={{
                    id: personId,
                    isParentsCollapsible: false,
                    isParentsCollapsed: false,
                    side: NONE_SIDE,
                }}
                onClickDisabled={true}
            />
        </div>
    );
}
