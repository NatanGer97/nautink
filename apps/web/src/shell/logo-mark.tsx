import markDarkUrl from './assets/nautink-mark-dark.png';
import markUrl from './assets/nautink-mark.png';

import type { ReactElement } from 'react';

const MARK_CLASS: string = 'h-[22px] w-auto shrink-0 select-none';

/**
 * The Nautink mark (docs/brand/). The navy wave disappears on the dark panel, so dark mode swaps in
 * the light variant. Decorative: the "Nautink" text beside it names the app.
 */
export function LogoMark(): ReactElement {
  return (
    <span aria-hidden="true" className="flex shrink-0 items-center">
      <img src={markUrl} alt="" draggable={false} className={`${MARK_CLASS} dark:hidden`} />
      <img
        src={markDarkUrl}
        alt=""
        draggable={false}
        className={`${MARK_CLASS} hidden dark:block`}
      />
    </span>
  );
}
