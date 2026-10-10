import { cn } from '@nautink/ui/lib/utils';
import { memo } from 'react';

import { Handles } from './entity-node.tsx';

import type { ErGroupFlowNode } from './er-types.ts';
import type { NodeProps } from '@xyflow/react';
import type { NamedExoticComponent, ReactElement } from 'react';

function ErGroupNodeView({
  id,
  data,
  selected: isSelected,
}: NodeProps<ErGroupFlowNode>): ReactElement {
  const title: string = data.title === '' ? id : data.title;
  return (
    <div
      data-testid={`er-group-${id}`}
      aria-label={`Group ${title}`}
      className={cn(
        'rounded-card border border-dashed border-node-stroke bg-muted/40',
        isSelected && 'border-solid border-accent-ink',
      )}
      style={{ width: data.width, height: data.height }}
    >
      <div className="truncate px-2.5 pt-1.5 text-xs font-medium text-muted-foreground">
        {title}
      </div>
      <Handles />
    </div>
  );
}

/** A subgraph's frame around its entities; it moves with them and is not dragged itself (v1). */
export const ErGroupNode: NamedExoticComponent<NodeProps<ErGroupFlowNode>> = memo(ErGroupNodeView);
