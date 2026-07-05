import { Handle, Position } from '@xyflow/react';
import { useApp, useGraph } from 'hooks';
import { MINUS_ICON, PLUS_ICON, PROFILE_IMAGE_PLACEHOLDER } from 'images';
import { MARRIAGE_NODE_SIZE, NODE_HEIGHT, NODE_WIDTH } from '../layout';
import {
    FEMALE,
    Gender,
    LEFT_SIDE,
    MALE,
    MarriageNodeSide,
    NONE_SIDE,
    Person,
    RIGHT_SIDE,
    UNDEFINED_GENDER,
} from 'model';
import { TFile, getIcon } from 'obsidian';
import { useEffect, useState, MouseEvent } from 'react';

export type PersonNodeData = {
    id: string;
    isParentsCollapsible: boolean;
    isParentsCollapsed: boolean;
    side: MarriageNodeSide;
};

export function PersonNode({
    data,
    positionAbsoluteX,
    positionAbsoluteY,
    onClickDisabled = false,
}: {
    data: PersonNodeData;
    positionAbsoluteX: number;
    positionAbsoluteY: number;
    onClickDisabled?: boolean;
}) {
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

    const openPersonPage = () => {
        if (!app || onClickDisabled) {
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

    const onNodeClick = (e: MouseEvent) => {
        if (onClickDisabled === false && (e.ctrlKey || e.metaKey)) {
            if (!graph) {
                return;
            }

            const personId = data.id;

            const children = graph.index.personChildren.get(personId) ?? [];

            graph.selectPerson({
                id: personId,
                x: positionAbsoluteX,
                y: positionAbsoluteY,
                capabilities: graph.layout.capabilities(data.id),
                childrenNodes: children.map((childrenId) => {
                    return {
                        personId: childrenId,
                        isVisible: graph.contains(childrenId),
                    };
                }),
            });
        } else {
            openPersonPage();
        }
    };

    const getImageSrc = (): string => {
        if (!app) {
            return PROFILE_IMAGE_PLACEHOLDER;
        }

        if (!person?.image) {
            return PROFILE_IMAGE_PLACEHOLDER;
        }

        const file = app.metadataCache.getFirstLinkpathDest(person.image, person.file.name);

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
            className={`${getNodeClass(person?.gender ?? UNDEFINED_GENDER)} grafily-person-node`}
            style={{
                width: `${NODE_WIDTH}px`,
                height: `${NODE_HEIGHT}px`,
            }}
        >
            {hasParents && data.isParentsCollapsible ? (
                <button onClick={collapseParents} className="grafily-collapse-parents-button">
                    <img src={getHideChildNodesIcon()} />
                </button>
            ) : (
                <></>
            )}
            {graph?.selectedPerson?.id === data.id ? (
                <button
                    onClick={() => graph?.selectPerson(null)}
                    className="grafily-node-deselect-button"
                    dangerouslySetInnerHTML={{ __html: getIcon('target')?.outerHTML || '' }}
                />
            ) : (
                <></>
            )}
            <img
                src={getImageSrc()}
                style={{ height: '90%', borderRadius: '50%', aspectRatio: '1 / 1' }}
            />
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    cursor: 'pointer',
                }}
                onClick={onNodeClick}
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

export function SimplePersonNode({
    personId,
    isVisible,
}: {
    personId: string;
    isVisible: boolean;
}) {
    const graph = useGraph();

    const onClick = (e: MouseEvent) => {
        if (!graph) {
            return;
        }

        e.stopPropagation();
        graph.toggleSiblingVisibility(personId);
    };

    const classes = ['grafily-simple-node', !isVisible && 'grafily-node-hidden']
        .filter(Boolean)
        .join(' ');

    return (
        <div className={classes} onClick={onClick} title={isVisible ? 'Hide node' : 'Show node'}>
            <div
                className="grafily-simple-node-hover-overlay"
                dangerouslySetInnerHTML={{
                    __html: getIcon(isVisible ? 'eye-off' : 'eye')?.outerHTML || '',
                }}
            />
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

export type MarriageNodeData = {
    id: string;
    isChildrenCollapsible: boolean;
    isChildrenCollapsed: boolean;
};

export function MarriageNode({ data }: { data: MarriageNodeData }) {
    const graph = useGraph();

    const [hasChildren, setHasChildren] = useState<boolean>(true);

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
            {data.isChildrenCollapsible && hasChildren ? (
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

    return year ? `${year}` : '';
}

function getDeathYear(person: Person): string {
    const year = person.death?.year;

    return year ? `${year}` : '';
}

function getNodeClass(gender: Gender): string {
    if (gender === MALE) {
        return 'grafily-male-node';
    } else if (gender === FEMALE) {
        return 'grafily-female-node';
    } else {
        return 'grafily-undefined-gender-node';
    }
}
