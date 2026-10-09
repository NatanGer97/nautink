/** State diagram sources for round-trip tests: v1's template plus the edge cases v1 handles. */
export const STATE_FIXTURES: Readonly<Record<string, string>> = {
  template: `stateDiagram-v2
    [*] --> Draft
    Draft --> Review : submit
    Review --> Draft : changes requested
    Review --> Published : approve
    state Published {
        [*] --> Live
        Live --> Archived : expire
    }
    Published --> [*]
`,
  blank: 'stateDiagram-v2\n',
  v1Header: 'stateDiagram\n    direction LR\n    A --> B\n',
  pseudoStates: `stateDiagram-v2
    state fork_state <<fork>>
    state join_state <<join>>
    state if_state <<choice>>
    [*] --> fork_state
    fork_state --> A
    fork_state --> B
    A --> join_state
    B --> join_state
    join_state --> if_state
    if_state --> C : yes
    if_state --> [*] : no
`,
  descriptions: `stateDiagram-v2
    state "Waiting for input" as Waiting
    Idle : The idle state
    Idle : second line
    state "Same" as Same
    Same : with a description
    Plain
    Waiting --> Idle
`,
  nested: `stateDiagram-v2
    direction TB
    [*] --> Outer
    state Outer {
        direction LR
        [*] --> Inner
        state Inner {
            [*] --> Deep
            Deep --> [*]
        }
        Inner --> Done
    }
    Outer --> [*]
`,
  regions: `stateDiagram-v2
    [*] --> Active
    state Active {
        [*] --> NumLockOff
        NumLockOff --> NumLockOn : EvNumLockPressed
        NumLockOn --> NumLockOff : EvNumLockPressed
        --
        [*] --> CapsLockOff
        CapsLockOff --> CapsLockOn : EvCapsLockPressed
        CapsLockOn --> CapsLockOff : EvCapsLockPressed
    }
`,
  notes: `stateDiagram-v2
    State1 : A description
    note right of State1
        Important information!
        You can write
        notes.
    end note
    State1 --> State2
    note left of State2 : This is the note to the left.
`,
  styling: `stateDiagram-v2
    %% a comment that is dropped
    classDef badBadEvent fill:#f00,color:white
    classDef movement font-style:italic
    [*] --> Still
    Still --> Moving:::movement
    Moving --> Crash
    class Crash badBadEvent
    style Still fill:#0f0
    click Still href "https://example.com"
    accTitle: Title
    accDescr {
        Long
        description
    }
`,
  preamble: `---
title: Machine
---
stateDiagram-v2
    [*] --> A
`,
};
