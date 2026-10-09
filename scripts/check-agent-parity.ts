#!/usr/bin/env node
/**
 * Proves the multi-harness wiring is intact: CLAUDE.md is the AGENTS.md symlink, every procedure in
 * docs/agents/skills has a Claude Code skill stub pointing at it, and every Claude Code command has the
 * matching Codex CLI prompt. The commands are canonical; the prompts are derived from them, because
 * Codex has no skill loader and must be told the procedure's path instead of its name.
 * Run with --write to regenerate the derived prompts.
 */
import { lstatSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const REPO_ROOT = path.join(import.meta.dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'docs', 'agents', 'skills');
const CLAUDE_SKILLS_DIR = path.join(REPO_ROOT, '.claude', 'skills');
const COMMANDS_DIR = path.join(REPO_ROOT, '.claude', 'commands');
const PROMPTS_DIR = path.join(REPO_ROOT, '.codex', 'prompts');
const write = process.argv.includes('--write');

function markdownIn(directory: string): string[] {
  return readdirSync(directory)
    .filter((entry) => entry.endsWith('.md'))
    .sort();
}

/** The Codex prompt a Claude command implies: the same text, with skill names resolved to paths. */
function derivePrompt(commandText: string): string {
  return commandText.replaceAll(
    /[Uu]se the `([a-z-]+)` skill/g,
    (_match: string, skill: string) => `Follow \`docs/agents/skills/${skill}.md\``,
  );
}

function checkMemorySymlink(failures: string[]): void {
  const link = path.join(REPO_ROOT, 'CLAUDE.md');
  const stats = lstatSync(link, { throwIfNoEntry: false });
  if (stats?.isSymbolicLink() !== true) {
    failures.push(
      'CLAUDE.md is not a symlink — it must point at AGENTS.md so the two cannot drift',
    );
    return;
  }
  const target = readlinkSync(link);
  if (target !== 'AGENTS.md') {
    failures.push(`CLAUDE.md points at ${target}, expected AGENTS.md`);
  }
}

function checkSkillStubs(failures: string[]): void {
  const procedures = markdownIn(SKILLS_DIR).map((entry) => entry.replace(/\.md$/, ''));
  const stubs = readdirSync(CLAUDE_SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of procedures) {
    if (!stubs.includes(name)) {
      failures.push(`docs/agents/skills/${name}.md has no .claude/skills/${name}/SKILL.md stub`);
      continue;
    }
    const stub = readFileSync(path.join(CLAUDE_SKILLS_DIR, name, 'SKILL.md'), 'utf8');
    if (!stub.includes(`docs/agents/skills/${name}.md`)) {
      failures.push(`.claude/skills/${name}/SKILL.md does not point at its procedure file`);
    }
  }
  for (const name of stubs) {
    if (!procedures.includes(name)) {
      failures.push(`.claude/skills/${name} has no procedure in docs/agents/skills/`);
    }
  }
}

function checkPrompts(failures: string[]): void {
  const prompts = markdownIn(PROMPTS_DIR);
  for (const name of markdownIn(COMMANDS_DIR)) {
    const expected = derivePrompt(readFileSync(path.join(COMMANDS_DIR, name), 'utf8'));
    const promptPath = path.join(PROMPTS_DIR, name);
    if (write) {
      writeFileSync(promptPath, expected);
      continue;
    }
    if (!prompts.includes(name)) {
      failures.push(
        `.claude/commands/${name} has no .codex/prompts/${name} — run pnpm agents:sync`,
      );
      continue;
    }
    if (readFileSync(promptPath, 'utf8') !== expected) {
      failures.push(
        `.codex/prompts/${name} drifted from .claude/commands/${name} — run pnpm agents:sync`,
      );
    }
  }
  for (const name of prompts) {
    if (!markdownIn(COMMANDS_DIR).includes(name)) {
      failures.push(`.codex/prompts/${name} has no .claude/commands/${name}`);
    }
  }
}

const failures: string[] = [];
checkMemorySymlink(failures);
checkSkillStubs(failures);
checkPrompts(failures);

if (failures.length > 0) {
  console.error('Agent parity check failed:\n' + failures.map((line) => `  - ${line}`).join('\n'));
  process.exit(1);
}

console.log(
  write
    ? 'Codex prompts regenerated from the Claude Code commands.'
    : 'Agent parity check passed (CLAUDE.md symlink, skill stubs, Codex prompts all in sync).',
);
