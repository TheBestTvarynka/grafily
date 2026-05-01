import { Id, MARRIAGE_NODE_TYPE, PERSON_NODE_TYPE, personIdToNodeId } from 'layout';
import { Index } from 'model';

export interface FamilyTree {
    children: Map<Id, Id[]>;
    root: string;
}

export class TreeBuilder {
    private family: Index;
    private children: Map<Id, Id[]> = new Map();
    private root: string;
    private getChildNodes: (nodeId: Id, family: Index) => Id[];

    constructor(family: Index, root: string) {
        this.family = family;
        this.root = root;
    }

    private buildInitialTree() {
        const [id, marriage] = personIdToNodeId(this.root, this.family);

        let currentNodes = [id];

        while (currentNodes.length > 0) {
            const newNodes: Id[] = [];
            for (const currentNode of currentNodes) {
                const children = this.getChildNodes(currentNode, this.family);
                this.children.set(currentNode, children);

                newNodes.push(...children);
            }

            currentNodes = newNodes;
        }
    }

    familyTree(): FamilyTree {
        return {
            children: this.children,
            root: this.root,
        };
    }
}

export function getNodeParents(nodeId: Id, family: Index): Id[] {
    if (nodeId.type === PERSON_NODE_TYPE) {
        const parentsMarriageId = family.personParents.get(nodeId.id);

        if (!parentsMarriageId) {
            return [];
        }

        return [
            {
                id: parentsMarriageId,
                type: MARRIAGE_NODE_TYPE,
            },
        ];
    } else {
        let parentNodes: Id[] = [];

        const marriage = family.marriageById.get(nodeId.id);
        if (!marriage) {
            return [];
        }

        if (marriage.parent1Id) {
            const parentsMarriageId = family.personParents.get(marriage.parent1Id);

            if (parentsMarriageId) {
                parentNodes.push({
                    id: parentsMarriageId,
                    type: MARRIAGE_NODE_TYPE,
                });
            }
        }

        if (marriage.parent2Id) {
            const parentsMarriageId = family.personParents.get(marriage.parent2Id);

            if (parentsMarriageId) {
                parentNodes.push({
                    id: parentsMarriageId,
                    type: MARRIAGE_NODE_TYPE,
                });
            }
        }

        return parentNodes;
    }
}

export function getNodeChildren(nodeId: Id, family: Index): Id[] {
    if (nodeId.type === PERSON_NODE_TYPE) {
        return [];
    }

    const marriage = family.marriageById.get(nodeId.id);
    if (!marriage) {
        throw new Error(`Marriage ${nodeId.id} should exist`);
    }

    return marriage.childrenIds.map((childId) => {
        const [id] = personIdToNodeId(childId, family);

        return id;
    });
}
