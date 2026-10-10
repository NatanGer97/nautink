// Intentional differences from v1, recorded next to v1's outputs instead of editing them (see
// README.md). Each group says why the port differs; each change names a fixture case (and, for ops,
// the step) and what the port gives there instead. `applyDeviations` refuses a change whose case is
// gone or whose output equals v1's, so this list cannot go stale silently.

import type { GoldenDeviations } from '../golden-runner.ts';

export const GOLDEN_DEVIATIONS: readonly GoldenDeviations[] = [
  {
    editor: 'state',
    reason:
      'Mermaid treats `Id : text` as a description of the state, not its display name. v1 turned the first description into a display name and wrote it back as `state "text" as Id`; the port keeps it a description and writes `Id : text` again. Only `state "Name" as Id` sets a display name.',
    changes: [
      {
        kind: 'roundTrip',
        name: 'descriptions',
        expected: {
          kind: 'ok',
          code: 'stateDiagram-v2\n    state "Waiting for input" as Waiting\n    Idle : The idle state\n    Idle : second line\n    state "Same" as Same\n    Same : with a description\n    Plain\n    Waiting --> Idle\n',
        },
      },
      {
        kind: 'roundTrip',
        name: 'notes',
        expected: {
          kind: 'ok',
          code: 'stateDiagram-v2\n    State1 : A description\n    State1 --> State2\n    note right of State1\n        Important information!\n        You can write\n        notes.\n    end note\n    note left of State2 : This is the note to the left.\n',
        },
      },
      {
        kind: 'ops',
        name: 'updateState description',
        step: 0,
        expected:
          'stateDiagram-v2\n    Review : line one\n    Review : line two\n    state Published {\n        [*] --> Live\n        Live --> Archived : expire\n    }\n    [*] --> Draft\n    Draft --> Review : submit\n    Review --> Draft : changes requested\n    Review --> Published : approve\n    Published --> [*]\n',
      },
      {
        kind: 'ops',
        name: 'renameState with notes',
        step: 0,
        expected:
          'stateDiagram-v2\n    First : A description\n    First --> State2\n    note right of First\n        Important information!\n        You can write\n        notes.\n    end note\n    note left of State2 : This is the note to the left.\n',
      },
      {
        kind: 'ops',
        name: 'deleteItems note',
        step: 0,
        expected:
          'stateDiagram-v2\n    State1 : A description\n    State1 --> State2\n    note left of State2 : This is the note to the left.\n',
      },
      {
        kind: 'ops',
        name: 'deleteItems state with note',
        step: 0,
        expected:
          'stateDiagram-v2\n    State1 : A description\n    note right of State1\n        Important information!\n        You can write\n        notes.\n    end note\n',
      },
      {
        kind: 'ops',
        name: 'addNote twice',
        step: 0,
        expected:
          'stateDiagram-v2\n    State1 : A description\n    State1 --> State2\n    note right of State1\n        Important information!\n        You can write\n        notes.\n    end note\n    note left of State2 : This is the note to the left.\n    note right of State1 : Another\n',
      },
      {
        kind: 'ops',
        name: 'updateNote text',
        step: 0,
        expected:
          'stateDiagram-v2\n    State1 : A description\n    State1 --> State2\n    note right of State1 : Changed\n    note left of State2 : This is the note to the left.\n',
      },
      {
        kind: 'ops',
        name: 'updateNote side',
        step: 0,
        expected:
          'stateDiagram-v2\n    State1 : A description\n    State1 --> State2\n    note right of State1\n        Important information!\n        You can write\n        notes.\n    end note\n    note right of State2 : This is the note to the left.\n',
      },
      {
        kind: 'layouts',
        name: 'descriptions',
        expected: {
          positions: {
            Waiting: {
              x: 20,
              y: 34,
            },
            Idle: {
              x: 37,
              y: 142,
            },
            Same: {
              x: 220,
              y: 20,
            },
            Plain: {
              x: 413,
              y: 34,
            },
          },
        },
      },
      {
        kind: 'layouts',
        name: 'notes',
        expected: {
          positions: {
            State1: {
              x: 31,
              y: 20,
            },
            State2: {
              x: 263,
              y: 142,
            },
            'note:State1:0': {
              x: 177,
              y: 22,
            },
            'note:State2:0': {
              x: 20,
              y: 146,
            },
          },
        },
      },
    ],
  },
];
