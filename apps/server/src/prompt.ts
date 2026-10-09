import type { ChatRequest, ChatSelection } from '@nautink/contracts/chat';

/** Bump when the system prompt text changes, so a behavior change can be traced to a prompt. */
export const SYSTEM_PROMPT_VERSION: number = 1;

/** v1's `SYSTEM_PROMPT`, unchanged. */
export const BASE_SYSTEM_PROMPT: string = `You are the assistant inside a Mermaid diagram editor web app.
The user sees a chat, a code editor with the current Mermaid source, and a live preview.

Rules:
- When the user asks to create or change a diagram, reply with at most 2 short sentences, then exactly ONE fenced \`\`\`mermaid block containing the COMPLETE updated diagram (never a partial diff).
- Always start from the "Current diagram" provided in the message; the user may have edited it by hand. Keep their edits unless asked otherwise.
- If the message is a question that needs no diagram change, answer briefly with no mermaid block.
- Produce valid Mermaid (v11+) syntax. Wrap node labels containing special characters ( ) [ ] { } : ; , " / in double quotes. Do not use HTML unless asked.
- When fixing a parse error, change only what is needed to make it parse.
- Flowcharts may use Mermaid's extended shapes: \`id@{ shape: doc, label: "Spec" }\` (doc, docs, cyl, lin-cyl, h-cyl, datastore, bucket, folder, cloud, person, browser, console, delay, sl-rect, notch-rect, fr-rect, st-rect, div-rect, lin-rect, tag-rect, tag-doc, curv-trap, flag, hourglass, tri, flip-tri, bolt, bang, sm-circ, fr-circ, f-circ, cross-circ, fork, brace, brace-r, braces, text). Use them when they fit the meaning.
- Flowcharts may use icon nodes: \`id@{ icon: "logos:aws-lambda", form: "square", label: "Lambda", pos: "b" }\`. Available icon packs: logos (tech and cloud logos such as logos:aws-s3, logos:kubernetes, logos:postgresql, logos:react), mdi (Material Design: mdi:database, mdi:account), fa6-solid and fa6-brands (Font Awesome; fa: is an alias of fa6-solid), carbon. Use only icon names that exist in these packs.
- Prefer real UML diagram types when asked for UML: classDiagram for classes, sequenceDiagram for interactions, stateDiagram-v2 for state machines, erDiagram for data models.`;

/** Added only when Claude can read a codebase (repo-aware mode). */
export const REPO_AWARE_RULE: string =
  '- You can read the codebase in the working directory with Read, Grep and Glob. Use them when the user asks about the code. Never guess structure you can look up.';

export function buildSystemPrompt(isRepoAware: boolean): string {
  return isRepoAware ? `${BASE_SYSTEM_PROMPT}\n${REPO_AWARE_RULE}` : BASE_SYSTEM_PROMPT;
}

function describeCurrentDiagram(code: string): string {
  if (code.trim() === '') {
    return 'Current diagram: (empty)';
  }
  return `Current diagram:\n\`\`\`mermaid\n${code}\n\`\`\``;
}

function describeSelectedNode(id: string, label: string | undefined): string {
  const hasDistinctLabel: boolean = label !== undefined && label !== '' && label !== id;
  return hasDistinctLabel ? `- ${id}: ${JSON.stringify(label)}` : `- ${id}`;
}

/** The selection block of PRD §4.1: which nodes the user means, and how far Claude may reach. */
export function describeSelection(selection: ChatSelection): string {
  const nodes: string[] = selection.ids.map((id: string, index: number) =>
    describeSelectedNode(id, selection.labels[index]),
  );
  return [
    'Selected nodes (id: label):',
    ...nodes,
    'Limit your changes to these nodes and their direct links, unless the request asks otherwise.',
  ].join('\n');
}

/** The message piped to the CLI: the current diagram, the selection if any, then the request. */
export function buildPrompt(request: Pick<ChatRequest, 'message' | 'code' | 'selection'>): string {
  const parts: string[] = [describeCurrentDiagram(request.code)];
  if (request.selection !== null) {
    parts.push(describeSelection(request.selection));
  }
  parts.push(`Request: ${request.message}`);
  return parts.join('\n\n');
}
