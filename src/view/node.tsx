import { Handle, Position } from '@xyflow/react';
import { useApp } from 'hooks';
import { MARRIAGE_NODE_SIZE, NODE_HEIGHT, NODE_WIDTH } from 'layout';
import { Person } from 'model';
import { TFile } from 'obsidian';

export const KNOWN_PERSON = 'known';
export const UNKNOWN_PERSON = 'UNknown';
type KnownPerson = {
    kind: 'known';
    person: Person;
};
type UnknownPerson = {
    kind: 'unknown';
    label: string;
};
type PersonNodeData = KnownPerson | UnknownPerson;

// Fuck TS.
/* eslint-disable  @typescript-eslint/no-explicit-any */
/* eslint-disable  @typescript-eslint/no-unsafe-member-access */
/* eslint-disable  @typescript-eslint/no-unsafe-argument */
export function PersonNode({ data }: any) {
    const app = useApp();

    const onClick = () => {
        if (!app) {
            return;
        }

        /* eslint-disable  @typescript-eslint/no-unsafe-assignment */
        const file = data?.file;
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

    return (
        <div
            style={{
                padding: '0.5em',
                border: '1px solid #222',
                borderRadius: '10px',
                background: '#403735',
                width: `${NODE_WIDTH}px`,
                height: `${NODE_HEIGHT}px`,
                display: 'flex',
                justifyContent: 'flex-start',
                color: '#e3dfc1ff',
            }}
        >
            <div onClick={onClick} style={{ display: 'flex', flexDirection: 'column' }}>
                <span>{getSurname(data)}</span>
                <span>{getName(data)}</span>
                <div
                    style={{
                        display: 'inline-flex',
                        fontSize: '0.8em',
                        color: 'rgba(123, 117, 117, 1)',
                    }}
                >
                    <span>{getBirthYear(data)}</span>
                    <span>-</span>
                    <span>{getDeathYear(data)}</span>
                </div>
            </div>
            <Handle type="target" position={Position.Top} id="top" />
            <Handle type="target" position={Position.Bottom} id="bottom" />
            <Handle type="target" position={Position.Left} id="left" />
            <Handle type="target" position={Position.Right} id="right" />
        </div>
    );
}

export function MarriageNode() {
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
            <Handle type="source" position={Position.Bottom} id="bottom" />
        </div>
    );
}

function getSurname(data: PersonNodeData): string {
    if (data.kind === KNOWN_PERSON) {
        return data.person.name.surname;
    } else {
        return data.label;
    }
}

function getName(data: PersonNodeData): string {
    if (data.kind === KNOWN_PERSON) {
        return data.person.name.name;
    } else {
        return data.label;
    }
}

function getBirthYear(data: PersonNodeData): string {
    if (data.kind === KNOWN_PERSON) {
        const year = data.person.birth?.year;

        if (!year) {
            return '????';
        }

        return `${year}`;
    } else {
        return '????';
    }
}

function getDeathYear(data: PersonNodeData): string {
    if (data.kind === KNOWN_PERSON) {
        const year = data.person.death?.year;

        if (!year) {
            return '????';
        }

        return `${year}`;
    } else {
        return '????';
    }
}
