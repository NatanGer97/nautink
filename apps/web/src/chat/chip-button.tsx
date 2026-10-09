import { Tooltip, TooltipContent, TooltipTrigger } from '@nautink/ui/components/tooltip';
import { cn } from '@nautink/ui/lib/utils';

import type { ComponentProps, MouseEvent, ReactElement } from 'react';

/** The mockups' `.chip`: a small outlined button (M1 change card, quick actions). */
export const CHIP_CLASS: string =
  'inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-control border border-border bg-panel px-2.5 text-xs text-muted-foreground outline-none hover:border-input hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:border-border aria-disabled:hover:text-muted-foreground';

export interface ChipButtonProps extends ComponentProps<'button'> {
  /** Shown as a tooltip on hover and focus. */
  hint?: string;
  /**
   * Why the chip cannot run now. Keeps it focusable (`aria-disabled`) so the tooltip can say so,
   * the way `IconButton` does.
   */
  disabledReason?: string;
}

/** A chip button, with an optional tooltip. */
export function ChipButton({
  hint,
  disabledReason,
  className,
  onClick,
  ...props
}: ChipButtonProps): ReactElement {
  const isDisabled: boolean = disabledReason !== undefined;
  const tip: string | undefined = disabledReason ?? hint;
  const button: ReactElement = (
    <button
      type="button"
      aria-disabled={isDisabled ? true : undefined}
      className={cn(CHIP_CLASS, className)}
      onClick={(event: MouseEvent<HTMLButtonElement>) => {
        if (!isDisabled) {
          onClick?.(event);
        }
      }}
      {...props}
    />
  );
  if (tip === undefined) {
    return button;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent className="max-w-64">{tip}</TooltipContent>
    </Tooltip>
  );
}
