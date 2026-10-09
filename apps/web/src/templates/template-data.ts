// The starters of the new-diagram gallery, ported from v1's `src/templates.js`: 14 types, each with
// an example, and a blank for the five types that have a visual editor (19 starters).

/** The gallery's categories (M6), besides "All" and "Visual editor". */
export type TemplateCategory = 'Process' | 'Software design' | 'Data' | 'Planning' | 'Charts';

/** One diagram type in the gallery. */
export interface DiagramTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  /** True for the five types with a visual editor; only they offer a blank start (as v1). */
  hasVisualEditor: boolean;
  example: string;
  /** The empty diagram, for types with a visual editor. */
  blank?: string;
}

const FLOWCHART: DiagramTemplate = {
  id: 'flow',
  name: 'Flowchart',
  description: 'Processes, decisions, systems',
  category: 'Process',
  hasVisualEditor: true,
  blank: 'flowchart TD\n',
  example: `flowchart TD
    start([Start]) --> input[/Read request/]
    input --> valid{Valid?}
    valid -->|yes| save[(Save to DB)]
    valid -->|no| error[Show error]
    error --> input
    save --> done([Done])
`,
};

const CLASS: DiagramTemplate = {
  id: 'class',
  name: 'UML class',
  description: 'Classes, interfaces, relations',
  category: 'Software design',
  hasVisualEditor: true,
  blank: 'classDiagram\n    class Class1\n',
  example: `classDiagram
    class Animal {
        <<abstract>>
        +String name
        +int age
        +makeSound() void*
    }
    class Dog {
        +String breed
        +fetch() void
    }
    class Cat {
        +bool indoor
        +climb() void
    }
    class Owner {
        +String name
        +adopt(Animal a) void
    }
    Animal <|-- Dog
    Animal <|-- Cat
    Owner "1" o-- "0..*" Animal : owns
`,
};

const SEQUENCE: DiagramTemplate = {
  id: 'sequence',
  name: 'Sequence',
  description: 'Messages between participants',
  category: 'Software design',
  hasVisualEditor: true,
  blank: 'sequenceDiagram\n',
  example: `sequenceDiagram
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
};

const ER: DiagramTemplate = {
  id: 'er',
  name: 'Entity relationship',
  description: 'Database tables and keys',
  category: 'Data',
  hasVisualEditor: true,
  blank: 'erDiagram\n',
  example: `erDiagram
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
};

const STATE: DiagramTemplate = {
  id: 'state',
  name: 'State machine',
  description: 'States and transitions',
  category: 'Software design',
  hasVisualEditor: true,
  blank: 'stateDiagram-v2\n',
  example: `stateDiagram-v2
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
};

const GANTT: DiagramTemplate = {
  id: 'gantt',
  name: 'Gantt',
  description: 'Project schedule',
  category: 'Planning',
  hasVisualEditor: false,
  example: `gantt
    title Release plan
    dateFormat YYYY-MM-DD
    section Design
        Research       :a1, 2026-01-05, 7d
        Wireframes     :a2, after a1, 5d
    section Build
        Backend        :b1, after a2, 10d
        Frontend       :b2, after a2, 12d
    section Launch
        QA             :c1, after b2, 5d
        Release        :milestone, after c1, 0d
`,
};

const MINDMAP: DiagramTemplate = {
  id: 'mindmap',
  name: 'Mindmap',
  description: 'Ideas around a topic',
  category: 'Planning',
  hasVisualEditor: false,
  example: `mindmap
  root((Product launch))
    Marketing
      Blog post
      Social media
    Engineering
      Feature freeze
      Load testing
    Support
      Docs
      FAQ
`,
};

const TIMELINE: DiagramTemplate = {
  id: 'timeline',
  name: 'Timeline',
  description: 'Events over time',
  category: 'Planning',
  hasVisualEditor: false,
  example: `timeline
    title Company history
    2019 : Founded
    2021 : First product : Seed round
    2023 : 100 customers
    2025 : Series A
`,
};

const PIE: DiagramTemplate = {
  id: 'pie',
  name: 'Pie chart',
  description: 'Parts of a whole',
  category: 'Charts',
  hasVisualEditor: false,
  example: `pie title Traffic sources
    "Search" : 45
    "Direct" : 25
    "Social" : 20
    "Email" : 10
`,
};

const JOURNEY: DiagramTemplate = {
  id: 'journey',
  name: 'User journey',
  description: 'Steps and satisfaction',
  category: 'Process',
  hasVisualEditor: false,
  example: `journey
    title Checkout
    section Browse
      Find product: 4: Customer
      Read reviews: 3: Customer
    section Buy
      Add to cart: 5: Customer
      Pay: 2: Customer, Payment service
`,
};

const GIT: DiagramTemplate = {
  id: 'git',
  name: 'Git graph',
  description: 'Branches and merges',
  category: 'Software design',
  hasVisualEditor: false,
  example: `gitGraph
    commit
    branch feature
    checkout feature
    commit
    commit
    checkout main
    merge feature
    commit
`,
};

const ARCHITECTURE: DiagramTemplate = {
  id: 'architecture',
  name: 'Architecture',
  description: 'Services and infrastructure',
  category: 'Software design',
  hasVisualEditor: false,
  example: `architecture-beta
    group cloud(cloud)[Cloud]
    service web(internet)[Web] in cloud
    service api(server)[API] in cloud
    service db(database)[Database] in cloud
    web:R --> L:api
    api:R --> L:db
`,
};

const QUADRANT: DiagramTemplate = {
  id: 'quadrant',
  name: 'Quadrant',
  description: 'Two-axis prioritization',
  category: 'Charts',
  hasVisualEditor: false,
  example: `quadrantChart
    title Feature priority
    x-axis Low effort --> High effort
    y-axis Low impact --> High impact
    quadrant-1 Plan
    quadrant-2 Do now
    quadrant-3 Skip
    quadrant-4 Maybe
    Search: [0.3, 0.8]
    Dark mode: [0.2, 0.4]
    Offline sync: [0.8, 0.7]
`,
};

const KANBAN: DiagramTemplate = {
  id: 'kanban',
  name: 'Kanban',
  description: 'Task board',
  category: 'Planning',
  hasVisualEditor: false,
  example: `kanban
  todo[To do]
    t1[Write spec]
    t2[Design review]
  doing[In progress]
    t3[Build editor]
  done[Done]
    t4[Set up repo]
`,
};

/** Every diagram type, in v1's order: the visual editor types first. */
export const TEMPLATES: readonly DiagramTemplate[] = [
  FLOWCHART,
  CLASS,
  SEQUENCE,
  ER,
  STATE,
  GANTT,
  MINDMAP,
  TIMELINE,
  PIE,
  JOURNEY,
  GIT,
  ARCHITECTURE,
  QUADRANT,
  KANBAN,
];
