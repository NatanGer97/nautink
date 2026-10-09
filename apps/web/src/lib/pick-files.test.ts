import { describe, expect, it, vi } from 'vitest';

import { pickFiles } from './pick-files.ts';

function openedInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) {
    throw new Error('No file input is open.');
  }
  return input;
}

describe('pickFiles', () => {
  it('resolves with the chosen files and removes its input', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    const picking = pickFiles({ accept: '.mmd', isMultiple: true });
    const input = openedInput();
    expect(input.accept).toBe('.mmd');
    expect(input.multiple).toBe(true);
    const chosen = new File(['pie'], 'a.mmd');
    Object.defineProperty(input, 'files', { value: [chosen] });
    input.dispatchEvent(new Event('change'));
    expect(await picking).toEqual([chosen]);
    expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });

  it('resolves with nothing when the picker is cancelled', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    const picking = pickFiles({ accept: '.json', isMultiple: false });
    openedInput().dispatchEvent(new Event('cancel'));
    expect(await picking).toEqual([]);
    click.mockRestore();
  });
});
