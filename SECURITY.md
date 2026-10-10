# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately through GitHub's private vulnerability reporting: open the **Security** tab of
this repository and choose **Report a vulnerability**. Only the maintainers can read the report.
Include what you found, how to reproduce it, and what an attacker could do with it.

We aim to acknowledge a report within a week, and to agree on a fix and a disclosure date with you.
We are happy to credit you in the release notes unless you prefer otherwise.

## Supported versions

Nautink has not reached 1.0. Only the latest commit on `main` (and the latest release, once there are
releases) gets security fixes.

| Version         | Supported |
| --------------- | --------- |
| `main` (latest) | Yes       |
| Anything older  | No        |

## Threat model

Nautink is a **local-only** app. There are no accounts, no hosted service and no telemetry. It is
made of two parts that run on your own machine:

- **The web app** runs in your browser and keeps your diagrams, chat history and versions in the
  browser's IndexedDB (database `nautink`). Nothing is uploaded anywhere by Nautink.
- **The local server** (`apps/server`) is a small bridge that runs **your** Claude Code CLI
  (`claude -p`) with your diagram as input and streams the reply back. It uses your existing Claude
  Code login; Nautink never sees or stores your credentials. What Claude Code sends to Anthropic is
  governed by Claude Code and your account settings.

Because the server drives your personal Claude login, the main risk is another website or another
user making it run on your behalf. These defenses are in place:

- **Localhost only.** The server binds to `127.0.0.1` (default port 8791), so other machines on the
  network cannot reach it.
- **Host guard against DNS rebinding.** Every request must be addressed to `localhost`, `127.0.0.1`
  or `[::1]` in its `Host` header, or it is refused with 403. A hostile page whose domain resolves to
  127.0.0.1 still sends its own domain, so it is blocked.
- **No CORS.** The server sends no CORS headers and only accepts JSON bodies
  (`Content-Type: application/json`), so a page on another origin cannot read its replies or send it
  a chat request without a preflight that fails.
- **Validated input.** Every request body is validated with Zod and limited to 2 MB.
- **No shell.** `claude` is spawned directly with an argument list, never through a shell. The run
  is killed when the browser disconnects.
- **Lean, read-only Claude.** Each run loads **no settings at all** (`--setting-sources ""`): no
  user or project settings, so no hooks run, and no `CLAUDE.md` is loaded as instructions. There are
  no MCP servers and no slash commands. With no codebase selected, Claude gets **no tools** and runs
  in an empty temporary folder, so it cannot read your files.
- **Repo-aware mode is opt-in and read-only.** When you choose a codebase folder (in Settings, or with
  the `REPO_DIR` variable at startup), Claude may use only `Read`, `Grep` and `Glob`, and runs in
  that folder. The folder must be inside your home folder, and your home folder itself is refused
  because it holds keys and tokens; `REPO_DIR` gets the same check. The folder's
  `.claude/settings.json` (and so its hooks) and its `CLAUDE.md` are not loaded, so a folder cannot
  run commands or give Claude instructions on its own. Claude can still read those files with its
  tools, like any other file. Choose only folders whose contents you are fine with sending to
  Claude.

Things that are **out of scope**: anything another program running as your user can already do
(it can run `claude` itself), and the behavior of the Claude Code CLI or the Anthropic API.

If you find a way around one of the defenses above, or a way for a web page to make the local server
act for it, please report it.
