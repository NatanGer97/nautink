# Golden fixtures: the port must match v1

These JSON files record what v1 (`mermaid-chat`, the JavaScript app Nautink rebuilds) produced for a
fixed set of inputs. The tests in `src/<editor>/golden.test.ts` and `src/shared/detect-golden.test.ts`
run the same inputs through the TypeScript port and expect the same output. They need nothing outside
this repo, so they run in CI.

Recorded from `mermaid-chat` commit `7fee72d628b262962cbc8830961247fcf19b6364`.

## What each file holds

| File | Round trips | Op cases (steps) | Layouts |
| --- | --- | --- | --- |
| `flow.json` | 33 | 35 (48) | 38 |
| `class.json` | 25 | 93 (107) | 29 |
| `er.json` | 20 | 47 (58) | 21 |
| `state.json` | 23 | 54 (63) | 28 |
| `sequence.json` | 29 | 84 (94) | 26 |
| `detect.json` | 30 `detectType` cases | | |

- **`roundTrip`**: input code and what v1 gave for parse → serialize: `{ kind: "ok", code }`, or
  `{ kind: "unsupported" | "error", message }`. Inputs: every v1 template (`src/templates.js`), every
  source in `tests/fixtures/`, empty code, another diagram type, invalid code, and extra edge cases.
- **`ops`**: start code, then steps. Each step names a port op (the exported function name), its
  arguments after the model, and the code v1 serialized after it (`null` when the op returned null).
  Steps run on the model the previous step left, without parsing again, as the editor does.
- **`layouts`**: `dagre` (full layout), `place` (new items placed after an outside change, starting
  from `start`, which is v1's dagre layout of the previous code) and, for sequence, the whole
  computed layout. Positions are top-left corners rounded to 2 decimals.

## Mappings from v1 to the port

Each file's `mappings` field lists them. In short:

- Parse results: v1 `{ ok: true, graph | model }` → `{ kind: "ok" }`; `{ ok: false, kind, message }` →
  `{ kind, message }`.
- Field renames (op args use the port names): `dirExplicit` → `isDirExplicit`, `identifying` →
  `isIdentifying`, `composite` → `isComposite`, sequence `created` → `isCreated`, `on` → `isOn`,
  `wrap` → `shouldWrap`, `visible` → `isVisible`, layout `HH` → `headH`, `self` → `isSelf`,
  `destroyed` → `isDestroyed`, `open` → `isOpen`, detect `empty` → `isEmpty`.
- Flowchart: v1 wrote Mermaid's own `clickable` class back as `class <ids> clickable`; those lines are
  removed from v1's output.
- Op arguments follow the port's signatures (one object instead of 4+ positional args); the generator
  maps them to v1's positional calls. Ops returning `{ model, id }` / `{ graph, id }` are compared on
  the model.
- Sequence: item ids made in the editor are random, so args name items by position: `{ "$item": n }`
  is the n-th item (depth first) and `{ "$section": [n, s] }` is that block's list key `<id>:<s>`.
- Text is measured at 7px per character (v1's DOM-free fallback, `approximateTextWidth` in the port).
  For sequence box titles, v1 asked `CSS.supports('color', word)`; the generator answered with
  jsdom's CSS parser.
- Both sides parse with the same Mermaid (12.1.0), initialized as `tests/mermaid-loader.ts` does.

Ops on unknown ids or members are left out: the port throws there on purpose, v1 did nothing.

## Regenerating

Do not edit these files by hand, and never change them to make the port pass. If the port and v1
disagree, fix the port (or record the difference as an intentional deviation).

The generator is not committed because it imports v1's JavaScript (and the repo allows no `.js`).
To recreate it, write a Vitest test file (plain `.mjs`) outside the repo that:

1. Uses a Vitest config with `environment: 'jsdom'` and an alias that points `mermaid` at
   `packages/editors/node_modules/mermaid/dist/mermaid.core.mjs`, so v1 and the port share one
   Mermaid. Run it with this repo's Vitest from `packages/editors`
   (`../../node_modules/.bin/vitest run --config <generator>/vitest.config.mjs`); Vitest also loads
   v1's `.jsx` files and this repo's `tests/fixtures/*.ts`.
2. Calls `mermaid.initialize({ startOnLoad: false })`, stubs `HTMLCanvasElement.prototype.getContext`
   with a context whose `measureText(text)` returns `{ width: text.length * 7 }`, and sets
   `globalThis.CSS.supports(prop, value)` to "set the property on a jsdom element style and check it
   stuck".
3. Imports `src/visual/<editor>/{model,ops,layout}.js`, `src/visual/detect.js` and `src/templates.js`
   from a `mermaid-chat` checkout, runs the cases (keep the names and inputs of the current files),
   applies the mappings above, and writes `<editor>.json` here with
   `{ editor, source: { repo, commit }, mappings, roundTrip, ops, layouts }`.
4. Formats the output with the repo's Prettier (`prettier --write packages/editors/tests/golden/*.json`).

A copy of the last generator is kept outside the repo at `~/dev/projects/nautink-tools/golden-generator/`
on the machine that made these files (`generate.test.mjs`, `harness.mjs`, `engine.mjs`, one `<editor>.mjs` per editor).
