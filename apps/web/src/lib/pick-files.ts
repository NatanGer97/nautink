/** What a file picker accepts. */
export interface PickFilesOptions {
  /** The `accept` attribute, e.g. `.json,application/json`. */
  accept: string;
  isMultiple: boolean;
}

/**
 * Opens the browser's file picker and resolves with the chosen files, or none when it is
 * cancelled. The input is attached while open so every browser (and Playwright) sees the click.
 */
export async function pickFiles({ accept, isMultiple }: PickFilesOptions): Promise<File[]> {
  const input: HTMLInputElement = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.multiple = isMultiple;
  input.hidden = true;
  document.body.append(input);
  const files: File[] = await new Promise<File[]>((resolve) => {
    input.addEventListener('change', () => {
      resolve([...(input.files ?? [])]);
    });
    input.addEventListener('cancel', () => {
      resolve([]);
    });
    input.click();
  });
  input.remove();
  return files;
}
