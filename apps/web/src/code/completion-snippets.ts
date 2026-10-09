import type { EditorId } from '@nautink/visual-core/editor-contract';

/** A snippet: what the list shows, what it inserts (Monaco snippet syntax), and a hint. */
export interface SnippetInfo {
  label: string;
  insertText: string;
  detail: string;
}

/** Diagram starters offered on the first line: [keyword, description]. */
export const STARTERS: readonly (readonly [string, string])[] = [
  ['flowchart TD', 'Flowchart, top to bottom'],
  ['flowchart LR', 'Flowchart, left to right'],
  ['sequenceDiagram', 'Sequence diagram'],
  ['classDiagram', 'UML class diagram'],
  ['erDiagram', 'Entity relationship diagram'],
  ['stateDiagram-v2', 'State diagram'],
  ['gantt', 'Gantt chart'],
  ['mindmap', 'Mind map'],
  ['timeline', 'Timeline'],
  ['pie', 'Pie chart'],
  ['journey', 'User journey'],
  ['gitGraph', 'Git graph'],
  ['architecture-beta', 'Architecture diagram'],
  ['quadrantChart', 'Quadrant chart'],
  ['kanban', 'Kanban board'],
  ['xychart-beta', 'XY chart'],
  ['sankey-beta', 'Sankey diagram'],
  ['block-beta', 'Block diagram'],
];

/** Snippets and arrows per visual diagram type (v1's `monaco-complete.js`). */
export const SNIPPETS_BY_TYPE: Readonly<Record<EditorId, readonly SnippetInfo[]>> = {
  flow: [
    {
      label: 'subgraph',
      insertText: 'subgraph ${1:id} [${2:Title}]\n\t$0\nend',
      detail: 'Group of nodes',
    },
    {
      label: 'direction',
      insertText: 'direction ${1|TB,LR,BT,RL|}',
      detail: 'Direction inside a subgraph',
    },
    {
      label: 'node with shape',
      insertText:
        '${1:id}@{ shape: ${2|rect,rounded,stadium,diam,cyl,doc,cloud,person|}, label: "${3:Label}" }',
      detail: 'Extended shape syntax',
    },
    {
      label: 'icon node',
      insertText:
        '${1:id}@{ icon: "${2:logos:aws}", form: "${3|square,rounded,circle|}", label: "${4:Label}" }',
      detail: 'Node with an icon',
    },
    {
      label: 'classDef',
      insertText: 'classDef ${1:name} fill:${2:#f9f},stroke:${3:#333},stroke-width:${4:1px}',
      detail: 'Define a style class',
    },
    {
      label: 'class',
      insertText: 'class ${1:nodeIds} ${2:className}',
      detail: 'Apply a style class',
    },
    {
      label: 'style',
      insertText: 'style ${1:id} fill:${2:#f9f},stroke:${3:#333}',
      detail: 'Style one node',
    },
    {
      label: 'linkStyle',
      insertText: 'linkStyle ${1:0} stroke:${2:#f66},stroke-width:${3:2px}',
      detail: 'Style a link by index',
    },
    {
      label: 'click',
      insertText: 'click ${1:id} href "${2:https://}" "${3:Tooltip}"',
      detail: 'Make a node a link',
    },
    { label: '-->', insertText: '--> ', detail: 'Arrow' },
    { label: '-->|label|', insertText: '-->|${1:label}| ', detail: 'Arrow with label' },
    { label: '-.->', insertText: '-.-> ', detail: 'Dotted arrow' },
    { label: '==>', insertText: '==> ', detail: 'Thick arrow' },
    { label: '---', insertText: '--- ', detail: 'Line without arrow' },
    { label: '--o', insertText: '--o ', detail: 'Circle end' },
    { label: '--x', insertText: '--x ', detail: 'Cross end' },
  ],
  sequence: [
    {
      label: 'participant',
      insertText: 'participant ${1:A} as ${2:Alice}',
      detail: 'Participant with alias',
    },
    { label: 'actor', insertText: 'actor ${1:U} as ${2:User}', detail: 'Actor (stick figure)' },
    {
      label: 'participant (database)',
      insertText: 'participant ${1:DB}@{ "type": "database" } as ${2:Database}',
      detail: 'Database participant',
    },
    { label: '->>', insertText: '->>${1:B}: ${2:message}', detail: 'Solid arrow' },
    { label: '-->>', insertText: '-->>${1:A}: ${2:reply}', detail: 'Dotted arrow (reply)' },
    { label: '-x', insertText: '-x${1:B}: ${2:message}', detail: 'Cross end' },
    { label: '-)', insertText: '-)${1:B}: ${2:async}', detail: 'Async arrow' },
    { label: 'loop', insertText: 'loop ${1:condition}\n\t$0\nend', detail: 'Loop block' },
    {
      label: 'alt',
      insertText: 'alt ${1:condition}\n\t$2\nelse ${3:otherwise}\n\t$0\nend',
      detail: 'Alternative paths',
    },
    { label: 'opt', insertText: 'opt ${1:condition}\n\t$0\nend', detail: 'Optional block' },
    {
      label: 'par',
      insertText: 'par ${1:first}\n\t$2\nand ${3:second}\n\t$0\nend',
      detail: 'Parallel block',
    },
    {
      label: 'critical',
      insertText: 'critical ${1:action}\n\t$2\noption ${3:failure}\n\t$0\nend',
      detail: 'Critical region',
    },
    { label: 'break', insertText: 'break ${1:condition}\n\t$0\nend', detail: 'Break out' },
    {
      label: 'rect',
      insertText: 'rect ${1:rgb(240, 240, 255)}\n\t$0\nend',
      detail: 'Highlight region',
    },
    {
      label: 'Note over',
      insertText: 'Note over ${1:A},${2:B}: ${3:text}',
      detail: 'Note across participants',
    },
    {
      label: 'Note right of',
      insertText: 'Note right of ${1:A}: ${2:text}',
      detail: 'Note beside a participant',
    },
    { label: 'activate', insertText: 'activate ${1:A}', detail: 'Start activation' },
    { label: 'deactivate', insertText: 'deactivate ${1:A}', detail: 'End activation' },
    { label: 'autonumber', insertText: 'autonumber', detail: 'Number messages' },
    {
      label: 'box',
      insertText: 'box ${1:Aqua} ${2:Group}\n\t$0\nend',
      detail: 'Group participants',
    },
  ],
  class: [
    {
      label: 'class',
      insertText: 'class ${1:Name} {\n\t+${2:String} ${3:field}\n\t+${4:method}() ${5:void}\n}',
      detail: 'Class with members',
    },
    {
      label: 'interface',
      insertText: 'class ${1:Name} {\n\t<<interface>>\n\t+${2:method}() ${3:void}\n}',
      detail: 'Interface',
    },
    { label: '<<abstract>>', insertText: '<<abstract>>', detail: 'Stereotype' },
    { label: '<<enumeration>>', insertText: '<<enumeration>>', detail: 'Stereotype' },
    { label: '<|--', insertText: '<|-- ${1:Child}', detail: 'Inheritance (parent <|-- child)' },
    { label: '..|>', insertText: '..|> ${1:Interface}', detail: 'Realization' },
    { label: '*--', insertText: '*-- ${1:Part}', detail: 'Composition' },
    { label: 'o--', insertText: 'o-- ${1:Part}', detail: 'Aggregation' },
    { label: '-->', insertText: '--> ${1:B}', detail: 'Association' },
    { label: '..>', insertText: '..> ${1:B}', detail: 'Dependency' },
    {
      label: 'multiplicity',
      insertText: '${1:A} "${2:1}" --> "${3:*}" ${4:B} : ${5:label}',
      detail: 'Relation with multiplicities',
    },
    { label: 'note for', insertText: 'note for ${1:Class} "${2:text}"', detail: 'Note on a class' },
    { label: 'namespace', insertText: 'namespace ${1:Name} {\n\t$0\n}', detail: 'Group classes' },
    { label: 'direction', insertText: 'direction ${1|TB,LR,BT,RL|}', detail: 'Layout direction' },
  ],
  er: [
    {
      label: 'entity',
      insertText: '${1:ENTITY} {\n\t${2:int} ${3:id} PK\n\t$0\n}',
      detail: 'Entity with attributes',
    },
    { label: '||--o{', insertText: '||--o{ ${1:B} : ${2:has}', detail: 'One to zero-or-more' },
    { label: '||--|{', insertText: '||--|{ ${1:B} : ${2:has}', detail: 'One to one-or-more' },
    { label: '||--||', insertText: '||--|| ${1:B} : ${2:is}', detail: 'One to one' },
    { label: '}o--o{', insertText: '}o--o{ ${1:B} : ${2:relates}', detail: 'Many to many' },
    { label: 'PK', insertText: 'PK', detail: 'Primary key' },
    { label: 'FK', insertText: 'FK', detail: 'Foreign key' },
    { label: 'UK', insertText: 'UK', detail: 'Unique key' },
  ],
  state: [
    { label: '[*] -->', insertText: '[*] --> ${1:State}', detail: 'Start transition' },
    { label: '--> [*]', insertText: '--> [*]', detail: 'End transition' },
    {
      label: 'transition',
      insertText: '${1:A} --> ${2:B} : ${3:event}',
      detail: 'Labelled transition',
    },
    {
      label: 'state composite',
      insertText: 'state ${1:Name} {\n\t[*] --> ${2:Inner}\n\t$0\n}',
      detail: 'Composite state',
    },
    {
      label: 'state alias',
      insertText: 'state "${1:Long name}" as ${2:S1}',
      detail: 'State with a display name',
    },
    { label: '<<choice>>', insertText: 'state ${1:check} <<choice>>', detail: 'Choice' },
    { label: '<<fork>>', insertText: 'state ${1:fork} <<fork>>', detail: 'Fork' },
    { label: '<<join>>', insertText: 'state ${1:join} <<join>>', detail: 'Join' },
    { label: 'note', insertText: 'note right of ${1:State} : ${2:text}', detail: 'Note' },
    { label: '--', insertText: '--', detail: 'Concurrent region separator' },
    { label: 'direction', insertText: 'direction ${1|TB,LR,BT,RL|}', detail: 'Layout direction' },
  ],
};
