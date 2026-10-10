const RESET_AFTER_MS: number = 1600;

async function copyFrom(button: HTMLButtonElement): Promise<void> {
  const source: HTMLElement | null = document.getElementById(button.dataset.copy ?? '');
  if (source === null) {
    throw new Error(
      `Copy button points at "${button.dataset.copy ?? ''}", which is not on the page.`,
    );
  }
  const label: string = button.textContent.trim();
  try {
    await navigator.clipboard.writeText(source.textContent);
    button.replaceChildren('Copied');
  } catch {
    button.replaceChildren('Press ⌘C');
  }
  setTimeout(() => {
    button.replaceChildren(label);
  }, RESET_AFTER_MS);
}

/** Wires every `[data-copy]` button to copy the text of the element it names. */
export function setUpCopyButtons(root: Document): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>('button[data-copy]')) {
    button.addEventListener('click', () => {
      void copyFrom(button);
    });
  }
}
