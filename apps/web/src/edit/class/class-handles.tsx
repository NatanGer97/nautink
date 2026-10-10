import { Handle, Position } from '@xyflow/react';

import type { ReactElement } from 'react';

const SIDES: readonly (readonly [string, Position])[] = [
  ['t', Position.Top],
  ['r', Position.Right],
  ['b', Position.Bottom],
  ['l', Position.Left],
];

/** A dot on each side: drag from one to connect (links attach to the facing sides). */
export function ClassHandles(): ReactElement {
  return (
    <>
      {SIDES.map(([id, position]) => (
        <Handle key={id} id={id} type="source" position={position} />
      ))}
    </>
  );
}
