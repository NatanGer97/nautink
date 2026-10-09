# Writing an issue

Two jobs: **create** a new issue from a description, or **adopt** an existing untracked plan into a
tracked one. The pipeline both serve is described in `docs/agents/sdlc.md`.

Filing an issue is outward-facing and hard to undo — the number is consumed even if the issue is closed.
**Always show the draft and wait for an explicit confirmation before `gh issue create`.** Never file one
because a plan or another procedure implied it.

## Create

Input is a description: the command's argument, or the conversation when no argument is given.

1. **Read the context first.** `README.md` and `AGENTS.md`/`CLAUDE.md`, any project glossary, and the
   code area the work touches. An issue that names concepts the codebase doesn't use is an issue that
   will be planned wrong.

2. **Draft.** Title is one line, plain language, no invented terminology. Body:

   ```markdown
   ## Problem

   What isn't possible or isn't right today.

   ## Outcome

   What is true once this is done. Observable, not a description of the implementation.

   ## Scope notes

   Constraints, what it deliberately doesn't cover.
   ```

3. **Labels**, per `docs/agents/triage-labels.md`. `ready-for-agent` only when the issue is genuinely
   fully specified — an agent could pick it up with no further questions. When it isn't, leave it off and
   say which questions are open. Don't apply `needs-triage` to an issue you just wrote with the user.

4. **Confirm, then create.**

   ```bash
   gh issue create --title "<title>" --body "$(cat <<'BODY'
   <body>
   BODY
   )"
   ```

   Add `--label` only for labels decided in step 3.

5. **Return the number.** `gh issue create` prints the issue URL; the trailing path segment is the number.
   Report it. When `plan-writer` called this procedure, it continues down the tracked path with that number.

## Adopt

Input is a path to an existing plan whose frontmatter says `issue: none`.

Read the plan first. If its frontmatter already has a real `issue:`, stop — it's already tracked, there is
nothing to adopt.

1. **Draft the issue from the plan**, not from scratch: Problem from the plan's `## Context`, Outcome from
   its `## Target`, Scope notes from `## Out of scope`. Confirm, then create, as above.

2. **Rename the file**, keeping the slug:

   ```bash
   git mv docs/plans/<slug>.md docs/plans/<n>-<slug>.md
   ```

3. **Post the orchestrator**, seeded from the plan's *current* checkbox state — not all `pending`. A task
   already ticked `- [x]` becomes `done`. A half-executed plan must adopt mid-flight without losing
   progress.

   ```bash
   gh issue comment <n> --body "$(cat <<'BODY'
   ## Tasks

   | #   | Task   | Status |
   | --- | ------ | ------ |
   | T1  | <name> | done   |
   | T2  | <name> | pending |

   Plan: `docs/plans/<n>-<slug>.md`
   BODY
   )"
   ```

4. **Rewrite the frontmatter**: `issue: <n>` and `orchestrator_comment: <url from step 3>`. Drop the line
   in the plan body that said it was untracked.

After adoption, `/execute-plan <n>` resumes normally and updates that comment.

## Never

- Never run `gh issue create` without a confirmation on the draft.
- Never adopt a plan that already has an issue.
- Never seed an adopted orchestrator with every row `pending` when tasks are already done.
