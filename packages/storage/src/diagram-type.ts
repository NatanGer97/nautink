// Reads a diagram's type from its first line of Mermaid, the way v1's `detectType` does.

const FRONT_MATTER_RE: RegExp = /^\s*---\n[\s\S]*?\n---\n?/;
const INIT_DIRECTIVE_RE: RegExp = /^\s*%%\{[\s\S]*?\}%%\s*\n?/;

/** Display names of the Mermaid keywords. A keyword missing here is shown as written. */
export const TYPE_NAMES: Readonly<Record<string, string>> = {
  flowchart: 'Flowchart',
  graph: 'Flowchart',
  classDiagram: 'Class',
  sequenceDiagram: 'Sequence',
  erDiagram: 'ER',
  'stateDiagram-v2': 'State',
  stateDiagram: 'State',
  gantt: 'Gantt',
  mindmap: 'Mindmap',
  timeline: 'Timeline',
  pie: 'Pie',
  journey: 'Journey',
  gitGraph: 'Git graph',
  'architecture-beta': 'Architecture',
  quadrantChart: 'Quadrant',
  kanban: 'Kanban',
  'xychart-beta': 'XY chart',
  'sankey-beta': 'Sankey',
  'block-beta': 'Block',
  C4Context: 'C4',
  requirementDiagram: 'Requirement',
  'packet-beta': 'Packet',
  radar: 'Radar',
};

/** The code without its YAML front matter and `%%{init}%%` directives. */
export function stripPreamble(code: string): string {
  let rest: string = code.replace(FRONT_MATTER_RE, '');
  let directive: RegExpExecArray | null = INIT_DIRECTIVE_RE.exec(rest);
  while (directive !== null) {
    rest = rest.slice(directive[0].length);
    directive = INIT_DIRECTIVE_RE.exec(rest);
  }
  return rest;
}

/** Trimmed lines that carry Mermaid: no preamble, no blank lines, no `%%` comments. */
export function meaningfulLines(code: string): string[] {
  return stripPreamble(code)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('%%'));
}

/** The diagram keyword (`flowchart`, `pie`, …), or '' for empty code. */
export function diagramKeyword(code: string): string {
  const [header = ''] = meaningfulLines(code);
  const [keyword = ''] = header.split(/\s/);
  return keyword;
}

/** 'Flowchart', 'Sequence', … or 'Empty'. */
export function typeName(code: string): string {
  const keyword: string = diagramKeyword(code);
  if (keyword === '') {
    return 'Empty';
  }
  return TYPE_NAMES[keyword] ?? keyword;
}
