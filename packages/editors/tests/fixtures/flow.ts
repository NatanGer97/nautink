/** Flowchart sources for round-trip tests: v1's template plus the edge cases v1 handles. */
export const FLOW_FIXTURES: Readonly<Record<string, string>> = {
  template: `flowchart TD
    start([Start]) --> input[/Read request/]
    input --> valid{Valid?}
    valid -->|yes| save[(Save to DB)]
    valid -->|no| error[Show error]
    error --> input
    save --> done([Done])
`,
  blank: 'flowchart TD\n',
  graphKeyword: 'graph LR\n    a --> b\n',
  directions: 'flowchart BT\n    a\n',
  arrows: `flowchart LR
    a --- b
    a --o c
    a --x d
    a -.-> e
    a -.- f
    a ==> g
    a === h
    a ==o i
    a -.-x j
    a <--> k
    a ~~~ l
`,
  chainsAndAmpersands: 'flowchart TD\n    a --> b --> c\n    a & b --> d\n',
  parallelEdges: 'flowchart TD\n    a --> b\n    a -->|again| b\n',
  labels: `flowchart TD
    a["Say &quot;hi&quot;"] -- text on link --> b("a (b)")
    c[end] --> d["--"]
    e[A label] -->|"with | pipe"| f
`,
  shapes: `flowchart TD
    a@{ shape: doc, label: "Report" }
    b@{ shape: cloud }
    c@{ shape: sm-circ }
    d>Flag]
    e[[Sub]]
    f[\\Out\\]
    g[/Trap\\]
    h(((Double)))
    i{{Hex}}
    j@{ shape: lightning-bolt, label: "Bolt" }
`,
  icons: `flowchart TD
    a@{ icon: "mdi:database", form: "square", label: "DB", pos: "b", h: 60 }
    b@{ img: "https://example.com/x.png", label: "Pic", w: 80, h: 40, constraint: "on" }
    c@{ icon: "logos:aws" }
    a --> b
`,
  subgraphs: `flowchart LR
    subgraph outer [Outer group]
        direction TB
        a --> b
        subgraph inner
            c
        end
    end
    subgraph solo
        d
    end
    outer --> d
    c --> d
`,
  styling: `flowchart TD
    %% a comment that is dropped
    a:::hot --> b
    c
    class b,c cool
    classDef hot fill:#f00
    classDef cool stroke:#00f
    style a stroke-width:4px
    linkStyle 0 stroke:red
    click a href "https://example.com"
    accTitle: Title
    accDescr: Description
`,
  preamble: `---
title: Hello
---
%%{init: {"theme": "dark"}}%%
flowchart TD
    a --> b
`,
};
