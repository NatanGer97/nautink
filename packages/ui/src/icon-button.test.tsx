import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from './components/tooltip.tsx';
import { IconButton } from './icon-button.tsx';

describe('IconButton', () => {
  it('names the button and shows the label with its shortcut in a tooltip', async () => {
    const onClick = vi.fn();
    render(
      <TooltipProvider>
        <IconButton label="Undo" shortcut="⌘Z" icon={<svg />} onClick={onClick} />
      </TooltipProvider>,
    );
    const button = screen.getByRole('button', { name: 'Undo' });
    await userEvent.tab();
    expect(button).toBe(document.activeElement);
    expect((await screen.findByRole('tooltip')).textContent).toContain('⌘Z');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('marks the active state and works without a shortcut', () => {
    render(
      <TooltipProvider>
        <IconButton label="Chat" icon={<svg />} isActive />
      </TooltipProvider>,
    );
    expect(screen.getByRole('button', { name: 'Chat' }).dataset.active).toBe('true');
  });

  it('stays focusable but ignores clicks when disabled', async () => {
    const onClick = vi.fn();
    render(
      <TooltipProvider>
        <IconButton label="Redo" icon={<svg />} isDisabled onClick={onClick} />
      </TooltipProvider>,
    );
    const button = screen.getByRole('button', { name: 'Redo' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
