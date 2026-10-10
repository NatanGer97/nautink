import type { AgentId } from '@nautink/contracts/agents';
import type { ChatRequest, ChatSelection } from '@nautink/contracts/chat';

/** Bump when the system prompt text changes, so a behavior change can be traced to a prompt. */
export const SYSTEM_PROMPT_VERSION: number = 4;

/**
 * v1's `SYSTEM_PROMPT`. Version 2 targets Mermaid 12 (ADR-001); version 3 adds the selection rule
 * (PRD §4.1); version 4 adds the Codex rules (ADR-002).
 */
export const BASE_SYSTEM_PROMPT: string = `You are the assistant inside a Mermaid diagram editor web app.
The user sees a chat, a code editor with the current Mermaid source, and a live preview.

Rules:
- When the user asks to create or change a diagram, reply with at most 2 short sentences, then exactly ONE fenced \`\`\`mermaid block containing the COMPLETE updated diagram (never a partial diff).
- Always start from the "Current diagram" provided in the message; the user may have edited it by hand. Keep their edits unless asked otherwise.
- If the message is a question that needs no diagram change, answer briefly with no mermaid block.
- Produce valid Mermaid (v12) syntax. Wrap node labels containing special characters ( ) [ ] { } : ; , " / in double quotes. Do not use HTML unless asked.
- When fixing a parse error, change only what is needed to make it parse.
- When the message lists items selected on the canvas, change only those items and their direct links unless the request asks for more. Copy every other line of the current diagram exactly, in the same order.
- Flowcharts may use Mermaid's extended shapes: \`id@{ shape: doc, label: "Spec" }\` (doc, docs, cyl, lin-cyl, h-cyl, datastore, bucket, folder, cloud, person, browser, console, delay, sl-rect, notch-rect, fr-rect, st-rect, div-rect, lin-rect, tag-rect, tag-doc, curv-trap, flag, hourglass, tri, flip-tri, bolt, bang, sm-circ, fr-circ, f-circ, cross-circ, fork, brace, brace-r, braces, text). Use them when they fit the meaning.
- Flowcharts may use icon nodes: \`id@{ icon: "logos:aws-lambda", form: "square", label: "Lambda", pos: "b" }\`. Available icon packs: logos (tech and cloud logos such as logos:aws-s3, logos:kubernetes, logos:postgresql, logos:react), mdi (Material Design: mdi:database, mdi:account), fa6-solid and fa6-brands (Font Awesome; fa: is an alias of fa6-solid), carbon. Use only icon names that exist in these packs.
- Prefer real UML diagram types when asked for UML: classDiagram for classes, sequenceDiagram for interactions, stateDiagram-v2 for state machines, erDiagram for data models.`;

/** Added only when Claude can read a codebase (repo-aware mode). */
export const REPO_AWARE_RULE: string =
  '- You can read the codebase in the working directory with Read, Grep and Glob. Use them when the user asks about the code. Never guess structure you can look up.';

/** Codex reads files only through a shell; its sandbox keeps that shell read-only (ADR-002). */
export const CODEX_REPO_AWARE_RULE: string =
  '- You can read the codebase in the working directory with read-only shell commands such as rg, cat and ls. Use them when the user asks about the code. Never guess structure you can look up. Never try to change files.';

/** Codex always has a shell, so without a codebase it is told not to use it. */
export const CODEX_NO_SHELL_RULE: string =
  '- Do not run shell commands. Everything you need is in the message.';

const AGENT_RULES: Readonly<Record<AgentId, { repoAware: string | null; noRepo: string | null }>> =
  {
    claude: { repoAware: REPO_AWARE_RULE, noRepo: null },
    codex: { repoAware: CODEX_REPO_AWARE_RULE, noRepo: CODEX_NO_SHELL_RULE },
  };

export function buildSystemPrompt(isRepoAware: boolean, agent: AgentId): string {
  const rules: { repoAware: string | null; noRepo: string | null } = AGENT_RULES[agent];
  const rule: string | null = isRepoAware ? rules.repoAware : rules.noRepo;
  return rule === null ? BASE_SYSTEM_PROMPT : `${BASE_SYSTEM_PROMPT}\n${rule}`;
}

function describeCurrentDiagram(code: string): string {
  if (code.trim() === '') {
    return 'Current diagram: (empty)';
  }
  return `Current diagram:\n\`\`\`mermaid\n${code}\n\`\`\``;
}

interface SelectedItemLine {
  id: string;
  label: string | undefined;
  kind: string | undefined;
}

function describeSelectedItem({ id, label, kind }: SelectedItemLine): string {
  const hasDistinctLabel: boolean = label !== undefined && label !== '' && label !== id;
  const name: string = kind === undefined || kind === '' ? id : `${kind} ${id}`;
  return hasDistinctLabel ? `- ${name}: ${JSON.stringify(label)}` : `- ${name}`;
}

/** The rules under the list: how far Claude may reach, and how to find editor-only ids. */
export const SELECTION_RULES: readonly string[] = [
  'Limit your changes to these items and their direct links, unless the request asks otherwise.',
  'Keep every other line of the current diagram byte-identical.',
  'An id that does not appear in the diagram belongs to the editor (a link, a message, a note): find that item by its label.',
];

/** The selection block of PRD §4.1: which items the user means, and how far Claude may reach. */
export function describeSelection(selection: ChatSelection): string {
  const hasKinds: boolean = selection.kinds !== undefined;
  const items: string[] = selection.ids.map((id: string, index: number) =>
    describeSelectedItem({ id, label: selection.labels[index], kind: selection.kinds?.[index] }),
  );
  return [
    hasKinds ? 'Selected on the canvas (kind id: label):' : 'Selected on the canvas (id: label):',
    ...items,
    ...SELECTION_RULES,
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
