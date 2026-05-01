import { Id, MARRIAGE_NODE_TYPE, PERSON_NODE_TYPE, personIdToNodeId } from 'layout';
import { Index, LEFT_SIDE, MarriageNodeSide } from 'model';

export interface FamilyTree {
    children: Map<string, Id[]>;
    root: Id;
}

export class TreeBuilder {
    private family: Index;
    private children: Map<string, Id[]> = new Map();
    private root: Id | null = null;
    private getChildNodes: (nodeId: Id, family: Index) => Id[];

    constructor(family: Index, getChildNodes: (nodeId: Id, family: Index) => Id[]) {
        this.family = family;
        this.getChildNodes = getChildNodes;
    }

    getChildren(): Map<string, Id[]> {
        return this.children;
    }

    buildInitialTree(root: string) {
        const [id] = personIdToNodeId(root, this.family);
        this.root = id;

        let currentNodes = [id];

        while (currentNodes.length > 0) {
            const newNodes: Id[] = [];
            for (const currentNode of currentNodes) {
                const children = this.getChildNodes(currentNode, this.family);
                this.children.set(currentNode.id, children);

                newNodes.push(...children);
            }

            currentNodes = newNodes;
        }
    }

    familyTree(): FamilyTree {
        if (!this.root) {
            throw new Error(
                'Tree root is not initialized. Please, call `buildInitialTree` method.',
            );
        }

        return {
            children: this.children,
            root: this.root,
        };
    }

    removeNode(nodeId: string, parentNodeId: string) {
        this.removeChildrenOf(nodeId);

        const children = this.children.get(parentNodeId);
        if (!children || children.length === 0) {
            return;
        }

        this.children.set(
            parentNodeId,
            children.filter((id) => id.id != nodeId),
        );
    }

    removeChildrenOf(nodeId: string) {
        let children = [nodeId];
        while (children.length > 0) {
            const newChildren: Id[] = [];

            for (const child of children) {
                newChildren.push(...(this.children.get(child) ?? []));

                this.children.delete(child);
            }

            children = newChildren.map((id) => id.id);
        }
    }

    addChildrenOf(nodeId: string) {
        let currentNodes: Id[] = [{ id: nodeId, type: MARRIAGE_NODE_TYPE }];

        while (currentNodes.length > 0) {
            const newNodes: Id[] = [];
            for (const currentNode of currentNodes) {
                const children = this.getChildNodes(currentNode, this.family);
                this.children.set(currentNode.id, children);

                newNodes.push(...children);
            }

            currentNodes = newNodes;
        }
    }

    addChildren(nodeId: Id, parentId: string, side: MarriageNodeSide) {
        this.addChildrenOf(nodeId.id);

        const children = this.children.get(parentId) ?? [];

        if (side === LEFT_SIDE) {
            children.splice(0, 0, nodeId);
        } else {
            children.push(nodeId);
        }

        this.children.set(parentId, children);
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
