import { cn } from '@nautink/ui/lib/utils';
import { memo } from 'react';

import { Handles } from './shape-node.tsx';

import type { GroupFlowNode } from './flow-types.ts';
import type { NodeProps } from '@xyflow/react';
import type { NamedExoticComponent, ReactElement } from 'react';

function GroupNodeView({ id, data, selected: isSelected }: NodeProps<GroupFlowNode>): ReactElement {
  return (
    <div
      data-testid={`flow-group-${id}`}
      aria-label={`Group ${data.title === '' ? id : data.title}`}
      className={cn(
        'rounded-card border border-dashed border-node-stroke bg-muted/40',
        isSelected && 'border-solid border-accent-ink',
      )}
      style={{ width: data.width, height: data.height }}
    >
      <div className="truncate px-2.5 pt-1.5 text-xs font-medium text-muted-foreground">
        {data.title === '' ? id : data.title}
      </div>
      <Handles />
    </div>
  );
}

/** A subgraph's frame around its members; it moves with them and is not dragged itself (v1). */
export const GroupNode: NamedExoticComponent<NodeProps<GroupFlowNode>> = memo(GroupNodeView);
