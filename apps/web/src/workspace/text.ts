/** One line, collapsed whitespace, cut to `max` characters with an ellipsis (labels, toasts). */
export function clip(text: string, max: number = 40): string {
  const oneLine: string = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1).trimEnd()}…` : oneLine;
}

/** Lines of code, not counting one trailing newline; 0 for empty code. */
export function lineCount(code: string): number {
  return code === '' ? 0 : code.replace(/\n$/, '').split('\n').length;
}

/** The title to show for a diagram; an empty title reads "Untitled". */
export function displayTitle(title: string): string {
  return title.trim() === '' ? 'Untitled' : title;
}
