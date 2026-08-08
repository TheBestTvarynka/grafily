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
    return (
        <div className="grafily-simple-node">
            <PersonNode
                positionAbsoluteX={0}
                positionAbsoluteY={0}
                data={{
                    id: personId,
                    isParentsCollapsible: false,
                    isParentsCollapsed: false,
                    side: NONE_SIDE,
                }}
            />
        </div>
    );
}
