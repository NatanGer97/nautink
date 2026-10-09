/** ER sources for round-trip tests: v1's template plus the edge cases v1 handles. */
export const ER_FIXTURES: Readonly<Record<string, string>> = {
  template: `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : "ordered in"
    CUSTOMER {
        int id PK
        string email UK
        string name
    }
    ORDER {
        int id PK
        int customer_id FK
        date created_at
    }
    ORDER_ITEM {
        int order_id PK, FK
        int product_id PK, FK
        int quantity
    }
    PRODUCT {
        int id PK
        string name
        decimal price
    }
`,
  blank: 'erDiagram\n',
  cardinalities: `erDiagram
    direction LR
    A |o--o| B : "zero or one"
    C }o..|{ A : "many"
    A ||--|| D : single
    P u--o{ Q : parent
    A ||--o{ B : again
`,
  entities: `erDiagram
    "Big Entity"["The big one"] {
        string~T~ items "a #quot;quoted#quot; comment"
        int? maybe
        style kind
    }
    Lonely
    WithAlias["Alias x"]
    Styled:::hot
    "one-two" ||--o{ "end" : "a label"
    x-y ||--|| Lonely : link
`,
  subgraphs: `erDiagram
    subgraph Sales ["Sales area"]
        direction TB
        ORDER
        subgraph Billing
            INVOICE
        end
    end
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|| INVOICE : bills
    class Sales hot,cold
`,
  styling: `erDiagram
    %% a comment that is dropped
    A ||--o{ B : has
    classDef hot fill:#f00
    style A fill:#0f0
    accTitle: Title
    accDescr: Short description
`,
  accDescrBlock: `erDiagram
    accDescr {
        Long
        description
    }
    A ||--o{ B : has
`,
  preamble: `---
title: Shop
---
erDiagram
    A ||--o{ B : has
`,
};
