import { Handle, Position } from '@xyflow/react';
import { useApp, useGraph } from 'hooks';
import { MINUS_ICON, PLUS_ICON, PROFILE_IMAGE_PLACEHOLDER } from 'images';
import { MARRIAGE_NODE_SIZE, NODE_HEIGHT, NODE_WIDTH } from '../layout';
import { LEFT_SIDE, MarriageNodeSide, Person, RIGHT_SIDE } from 'model';
import { TFile } from 'obsidian';
import { useEffect, useState } from 'react';

export type PersonNodeData = {
    id: string;
    isParentsCollapsible: boolean;
    isParentsCollapsed: boolean;
    side: MarriageNodeSide;
};

export function PersonNode({ data }: { data: PersonNodeData }) {
    const app = useApp();
    const graph = useGraph();

    const [hasParents, setHasParents] = useState<boolean>(true);
    const [person, setPerson] = useState<Person | null>(null);

    useEffect(() => {
        if (!graph) {
            return;
        }

        const person = graph.index.personById.get(data.id);

        if (!person) {
            console.warn(`Person with ID "${data.id}" not found`);
            return;
        }

        setPerson(person);
    }, [graph]);

    useEffect(() => {
        if (!graph) {
            return;
        }

        const parentsMarriage = graph.index.personParents.get(data.id);

        if (parentsMarriage) {
            setHasParents(true);
        } else {
            setHasParents(false);
        }
    }, [graph]);

    const onClick = () => {
        if (!app) {
            return;
        }

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
    };

    const getImageSrc = (): string => {
        if (!app) {
            return PROFILE_IMAGE_PLACEHOLDER;
        }

        if (!person?.image) {
            return PROFILE_IMAGE_PLACEHOLDER;
        }

        const file = app.vault.getFileByPath(person.image);

        if (!file) {
            console.warn(`file "${person.image}" not found in vault`);
            return PROFILE_IMAGE_PLACEHOLDER;
        }

        return app.vault.getResourcePath(file);
    };

    const collapseParents = () => {
        if (!graph || !person) {
            return;
        }

        if (data.isParentsCollapsed) {
            graph.expandParents(data.id);
        } else {
            graph.collapseParents(data.id);
        }
    };

    const getHideChildNodesIcon = (): string => {
        if (data.isParentsCollapsed) {
            return PLUS_ICON;
        } else {
            return MINUS_ICON;
        }
    };

    return (
        <div
            style={{
                padding: '0.2em',
                border: '2px solid #e3dfc1',
                borderRadius: '10px',
                background: '#403735',
                width: `${NODE_WIDTH}px`,
                height: `${NODE_HEIGHT}px`,
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                color: '#e3dfc1',
                position: 'relative',
                cursor: 'default',
            }}
        >
            {hasParents && data.isParentsCollapsible ? (
                <button
                    onClick={collapseParents}
                    style={{
                        outline: 'revert',
                        position: 'absolute',
                        top: '-7px',
                        left: 'calc(50% - 7px)',
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
            <img src={getImageSrc()} style={{ height: '90%', borderRadius: '50%' }} />
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    cursor: 'pointer',
                }}
                onClick={onClick}
            >
                <span>{person ? getSurname(person) : ''}</span>
                <span>{person ? getName(person) : ''}</span>
                <div
                    style={{
                        display: 'inline-flex',
                        fontSize: '0.8em',
                        color: 'rgba(123, 117, 117, 1)',
                    }}
                >
                    {person && renderDates(person) ? (
                        <>
                            <span>{person ? getBirthYear(person) : ''}</span>
                            <span>—</span>
                            <span>{person ? getDeathYear(person) : ''}</span>
                        </>
                    ) : (
                        <></>
                    )}
                </div>
            </div>
            {hasParents ? <Handle type="target" position={Position.Top} id="top" /> : <></>}
            {data.side === LEFT_SIDE ? (
                <Handle type="target" position={Position.Left} id="left" />
            ) : (
                <></>
            )}
            {data.side === RIGHT_SIDE ? (
                <Handle type="target" position={Position.Right} id="right" />
            ) : (
                <></>
            )}
        </div>
    );
}

export type MarriageNodeData = {
    id: string;
    isChildrenCollapsible: boolean;
    isChildrenCollapsed: boolean;
};

export function MarriageNode({ data }: { data: MarriageNodeData }) {
    const graph = useGraph();

    const [hasChildren, setHasChildren] = useState<boolean>(true);
    const [isChildrenCollapsible, setIsChildNodesFoldable] = useState<boolean>(false);

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

        if (data.isChildrenCollapsible) {
            setIsChildNodesFoldable(true);
        } else {
            setIsChildNodesFoldable(false);
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
            {isChildrenCollapsible ? (
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

function renderDates(person: Person): boolean {
    const date = person.birth || person.death;

    return !!date;
}

function getSurname(person: Person): string {
    return person.name.surname;
}

function getName(person: Person): string {
    return person.name.name;
}

function getBirthYear(person: Person): string {
    const year = person.birth?.year;

    if (!year) {
        return '????';
    }

    return `${year}`;
}

function getDeathYear(person: Person): string {
    const year = person.death?.year;

    if (!year) {
        return '????';
    }

    return `${year}`;
}
