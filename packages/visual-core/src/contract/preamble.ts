const FRONT_MATTER: RegExp = /^\s*---\n[\s\S]*?\n---\n?/;
const INIT_DIRECTIVE: RegExp = /^\s*%%\{[\s\S]*?\}%%\s*\n?/;

/** Leading front matter and `%%{init}%%` directives, and the diagram source after them. */
export interface SplitSource {
  preamble: string;
  body: string;
}

function takeDirectives(source: SplitSource): SplitSource {
  const match: RegExpExecArray | null = INIT_DIRECTIVE.exec(source.body);
  if (match === null) {
    return source;
  }
  return takeDirectives({
    preamble: `${source.preamble}${match[0].trim()}\n`,
    body: source.body.slice(match[0].length),
  });
}

/** Splits the preamble off the source, so editors can keep it verbatim. */
export function splitPreamble(code: string): SplitSource {
  const match: RegExpExecArray | null = FRONT_MATTER.exec(code);
  if (match === null) {
    return takeDirectives({ preamble: '', body: code });
  }
  return takeDirectives({
    preamble: `${match[0].trimEnd()}\n`,
    body: code.slice(match[0].length),
  });
}
