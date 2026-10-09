/** Sequence sources for round-trip tests: v1's template plus the edge cases v1 handles. */
export const SEQUENCE_FIXTURES: Readonly<Record<string, string>> = {
  template: `sequenceDiagram
    actor U as User
    participant W as Web app
    participant A as API
    participant D@{ "type": "database" } as Database
    U->>W: Click login
    W->>+A: POST /login
    A->>D: Find user
    alt valid password
        D-->>A: user
        A-->>W: token
    else wrong password
        A-->>W: 401
    end
    deactivate A
    W-->>U: Show result
`,
  minimal: 'sequenceDiagram\n    Alice->>Bob: Hi\n',
  arrows: `sequenceDiagram
    A->B: open
    A-->B: dotted open
    A->>B: arrow
    A-->>B: dotted arrow
    A-xB: cross
    A--xB: dotted cross
    A-)B: async
    A--)B: dotted async
    A<<->>B: both
    A<<-->>B: dotted both
    A-|\\B: half top
    A-|/B: half bottom
    A/|-B: half top reverse
    A-\\\\B: stick top
    A-//B: stick bottom
    A//-B: stick top reverse
    A--|\\B: dotted half
    A()->>B: central from
    A->>()B: central to
    A()->>()B: central both
    A->>A: self
    A->>B:
`,
  activations: `sequenceDiagram
    A->>+B: start
    B->>+C: nested
    C-->>-B: done
    B-->>-A: done
    activate A
    A->>A: self call
    deactivate A
`,
  notes: `sequenceDiagram
    participant A
    participant B
    Note left of A: left
    Note right of B: right
    Note over A: over one
    Note over A,B: over both
    Note over A: line one<br>line two
`,
  blocks: `sequenceDiagram
    A->>B: start
    loop every minute
        A->>B: ping
        opt maybe
            B-->>A: pong
        end
    end
    par first
        A->>B: x
    and second
        A->>C: y
    end
    critical connect
        A->>B: try
    option timeout
        A->>B: retry
    end
    break on failure
        A->>B: stop
    end
    rect rgb(200, 220, 255)
        A->>B: highlighted
    end
`,
  boxes: `sequenceDiagram
    box Purple Frontend
        participant A
        participant B as Web
    end
    box rgb(33,66,99) Backend
        participant C
    end
    box Team services
        participant D
    end
    box transparent Aqua
        participant E
    end
    A->>B: x
    B->>C: y
    C->>D: z
    D->>E: w
`,
  kinds: `sequenceDiagram
    participant A@{ "type": "boundary" }
    participant B@{ "type": "control" }
    participant C@{ "type": "entity" }
    participant D@{ "type": "collections" }
    participant E@{ "type": "queue" }
    A->>E: hi
`,
  lifecycle: `sequenceDiagram
    A->>B: hello
    create participant C as Carl
    B->>C: make
    create actor D
    A->>D: make actor
    destroy C
    C->>B: bye
`,
  autonumber: `sequenceDiagram
    autonumber 10 5
    A->>B: one
    autonumber off
    A->>B: two
    autonumber 3
    A->>B: three
    autonumber
    A->>B: four
`,
  wrapping: `sequenceDiagram
    A->>B: wrap:long text here
    A->>B: nowrap:short
    Note over A: wrap:a note
`,
  text: `sequenceDiagram
    title Login flow
    accTitle: Accessible title
    accDescr {
        Long
        description
    }
    A->>B: I #9829; you #35; 1#59;2
    A->>B: say #quot;hi#quot;
    link A: Dashboard @ https://example.com
    links B: {"Repo": "https://example.com"}
`,
  preamble: `---
title: Calls
---
sequenceDiagram
    A->>B: hi
`,
};
