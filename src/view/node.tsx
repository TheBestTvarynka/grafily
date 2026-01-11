import { Handle, Position } from '@xyflow/react';
import { useApp, useIndex } from 'hooks';
import { MINUS_ICON, PLUS_ICON, PROFILE_IMAGE_PLACEHOLDER } from 'images';
import { MARRIAGE_NODE_SIZE, NODE_HEIGHT, NODE_WIDTH } from '../layout';
import { LEFT_SIDE, Person, RIGHT_SIDE } from 'model';
import { TFile } from 'obsidian';
import { useEffect, useState } from 'react';

// Fuck TS.
/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/no-unsafe-member-access */
/* eslint-disable  @typescript-eslint/no-unsafe-argument */
export function PersonNode({ data }: any) {
    const app = useApp();
    const index = useIndex();

    const [parentsFoldable, setParentsFoldable] = useState<boolean>(false);
    const [hasParents, setHasParents] = useState<boolean>(true);

    useEffect(() => {
        if (!index) {
            return;
        }

        const parentsMarriage = index.index.personParents.get(data.person.id);
        if (parentsMarriage && data.person.parentsFoldable) {
            setParentsFoldable(true);
        } else {
            setParentsFoldable(false);
        }

        if (parentsMarriage) {
            setHasParents(true);
        } else {
            setHasParents(false);
        }
    }, [index]);

    const onClick = () => {
        if (!app) {
            return;
        }

        /* eslint-disable  @typescript-eslint/no-unsafe-assignment */
        const file = data?.person?.file;
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

        if (!data.person.image) {
            return PROFILE_IMAGE_PLACEHOLDER;
        }

        const file = app.vault.getFileByPath(data.person.image);

        if (!file) {
            console.warn(`file "${data.person.image}" not found in vault`);
            return PROFILE_IMAGE_PLACEHOLDER;
        }

        return app.vault.getResourcePath(file);
    };

    const collapseParents = () => {
        if (!index) {
            return;
        }

        const person: Person = data.person;
        person.hideParents = !person.hideParents;

        index.setPerson({ ...person });
    };

    const getHideParentsIcon = (): string => {
        if (data.person.hideParents) {
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
            {parentsFoldable ? (
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
                        src={getHideParentsIcon()}
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
                <span>{getSurname(data.person)}</span>
                <span>{getName(data.person)}</span>
                <div
                    style={{
                        display: 'inline-flex',
                        fontSize: '0.8em',
                        color: 'rgba(123, 117, 117, 1)',
                    }}
                >
                    {renderDates(data.person) ? (
                        <>
                            <span>{getBirthYear(data.person)}</span>
                            <span>—</span>
                            <span>{getDeathYear(data.person)}</span>
                        </>
                    ) : (
                        <></>
                    )}
                </div>
            </div>
            {hasParents ? <Handle type="target" position={Position.Top} id="top" /> : <></>}
            {data.person.marriageNodeSide === LEFT_SIDE ? (
                <Handle type="target" position={Position.Left} id="left" />
            ) : (
                <></>
            )}
            {data.person.marriageNodeSide === RIGHT_SIDE ? (
                <Handle type="target" position={Position.Right} id="right" />
            ) : (
                <></>
            )}
        </div>
    );
}

// Fuck TS.
/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/no-unsafe-member-access */
/* eslint-disable  @typescript-eslint/no-unsafe-argument */
export function MarriageNode({ data }: any) {
    const index = useIndex();

    const [hasChildren, setHasChildren] = useState<boolean>(true);

    useEffect(() => {
        if (!index) {
            return;
        }

        const marriage = index.index.marriageById.get(data?.id);
        if (!marriage) {
            console.warn(`Expected marriage(id=${data?.id}) to exist in index.`);
            return;
        }

        if (marriage.children_ids.length > 0) {
            setHasChildren(true);
        } else {
            setHasChildren(false);
        }
    }, [index]);

    return (
        <div
            style={{
                padding: '0.2em',
                height: `${MARRIAGE_NODE_SIZE}px`,
                width: `${MARRIAGE_NODE_SIZE}px`,
            }}
        >
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
