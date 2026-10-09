import { Button } from '@nautink/ui/components/button';
import { Kbd } from '@nautink/ui/components/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@nautink/ui/components/tooltip';
import { cn } from '@nautink/ui/lib/utils';

import type { ComponentProps, MouseEvent, ReactElement, ReactNode } from 'react';

export interface IconButtonProps extends Omit<ComponentProps<typeof Button>, 'children'> {
  /** The accessible name, also shown in the tooltip. */
  label: string;
  icon: ReactNode;
  /** Keyboard shortcut shown next to the label in the tooltip, such as `⌘K`. */
  shortcut?: string;
  /** Marks the button as the active choice (accent wash), e.g. the open rail panel. */
  isActive?: boolean;
  /**
   * Unavailable but still focusable, so the tooltip can say what it is. Uses `aria-disabled`
   * because a natively disabled button gets no pointer or focus events, and so no tooltip.
   */
  isDisabled?: boolean;
  tooltipSide?: ComponentProps<typeof TooltipContent>['side'];
}

/** A 32 px icon-only button with an `aria-label` and a tooltip that names its shortcut (PRD §6.5). */
export function IconButton({
  label,
  icon,
  shortcut,
  isActive = false,
  isDisabled = false,
  tooltipSide = 'bottom',
  className,
  onClick,
  ...buttonProps
}: IconButtonProps): ReactElement {
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    if (!isDisabled) {
      onClick?.(event);
    }
  };
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-disabled={isDisabled ? true : undefined}
          data-active={isActive}
          className={cn(
            'rounded-control text-muted-foreground hover:text-foreground',
            'data-[active=true]:bg-accent-wash data-[active=true]:text-accent-ink-strong',
            'aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent',
            className,
          )}
          onClick={handleClick}
          {...buttonProps}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} className="flex items-center gap-2">
        {label}
        {shortcut === undefined ? null : <Kbd className="font-mono text-2xs">{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}
