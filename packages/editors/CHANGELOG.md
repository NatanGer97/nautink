# @nautink/editors

## 0.1.0

### Minor Changes

- 5bf238d: Add `updateNodes` (one patch for several flowchart nodes) and `boxParticipants` (several sequence participants into one new box).
- ee707f5: Add `reviewDiagram` (`review/review-diagram.ts`): compares Claude's proposed code with the current code for the five visual types and returns the counts of added, changed and removed elements, the code to show (the proposal with removed elements kept as ghosts) and the marked elements. Types without a visual editor, and proposals that do not parse, are reviewed as code.
- bcabe20: Add `duplicateClasses` to the class ops: copies classes under fresh ids with the relations between them, each copy in its original's namespace.
- 0f18538: Add the UML class editor's pure logic: the Mermaid model (parse and serialize), member text helpers, the class edit operations, box sizes with an injected text measurer, `classStyles`, and the dagre layout with neighbour placement.
- c0e1842: Add the ER editor's pure logic: the Mermaid model (parse and serialize) with subgraphs and every cardinality, the entity and attribute edit operations, entity box sizes with an injected text measurer, and the dagre layout with its fallbacks and neighbour placement.
- 3df3545: Add `duplicateNodes` to the flowchart ops: copies nodes under fresh ids with the links between them, each copy in its original's subgraph.
- 54d65e8: Add the flowchart editor's pure logic: the 53-shape library, node sizes, the Mermaid model (parse and serialize), the graph edit operations and the dagre layout with neighbour placement. Visual-core now requires full line coverage.
- cd2b36a: Set or clear where a sequence `autonumber` row restarts the count.
- 71ff3d3: Step sequence items up or down one place (into and out of blocks), and find the slot after an item.
- 451f399: Add the sequence editor's pure logic: the Mermaid model (parse and serialize) with participants, boxes, every arrow head, notes, activations, blocks, autonumber and create/destroy; the item tree helpers; every item, block, participant and box edit operation; and the canvas layout with an injected text measurer. Box titles are checked against a built-in CSS color list instead of the browser's `CSS.supports`.
- 5bd1f18: State diagrams: `Id : text` now parses as the state's description (as in Mermaid) and is written back as `Id : text`; only `state "Name" as Id` sets a display name. This is a recorded deviation from v1, which made the first description the display name.
- d4276b4: Add the state editor's pure logic: the Mermaid model (parse and serialize) with composites, concurrent regions, pseudo states, notes, classes and styles; the scope helpers; every state edit operation including `normalize` and `checkTransition`; leaf sizes; and the scope-by-scope dagre layout with frames, notes and neighbour placement.

### Patch Changes

- 18386be: Measure class boxes in the app's fonts (Geist for names and notes, Geist Mono for members), so the class editor's boxes fit the restyled text.
- 45e912e: Lock the five editors to v1 with golden fixtures: round trips, edit ops and layout positions recorded from v1 are checked on every test run.
- 23a1c74: Declare the MIT license in every package.
- Updated dependencies [54d65e8]
- Updated dependencies [23a1c74]
- Updated dependencies [d44d6a6]
  - @nautink/visual-core@0.1.0
