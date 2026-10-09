import type { ReactElement } from 'react';

/** The app mark: a diamond outline on an ink tile (M1). */
export function LogoMark(): ReactElement {
  return (
    <span
      aria-hidden="true"
      className="grid size-[22px] shrink-0 place-items-center rounded-control bg-primary"
    >
      <span className="size-2 rotate-45 border-[1.5px] border-primary-foreground" />
    </span>
  );
}
