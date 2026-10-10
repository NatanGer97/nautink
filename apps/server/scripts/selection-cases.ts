// The ten scripted prompts of PRD §4.1's "done when": each asks about a canvas selection.

/** One scripted prompt: the diagram, what is selected, and what the user asks. */
export interface SelectionCase {
  name: string;
  code: string;
  selected: readonly string[];
  message: string;
}

const CHECKOUT: string = `flowchart TD
  start([Checkout]) --> cart[Validate cart]
  cart --> pay{Payment ok?}
  pay -->|yes| order[Create order]
  pay -->|no| retry[Retry payment]
  retry -->|after 3 tries| review[Manual review]
  review -->|approved| order
  order --> done([Done])`;

const SIGNUP: string = `flowchart LR
  visit[Landing page] --> form[Sign-up form]
  form --> verify[Verify email]
  verify --> welcome[Welcome tour]
  form --> social[Social login]
  social --> welcome
  welcome --> dash[Dashboard]`;

export const SELECTION_CASES: readonly SelectionCase[] = [
  {
    name: 'rename two nodes',
    code: CHECKOUT,
    selected: ['retry', 'review'],
    message: 'Rename these two steps to be more specific.',
  },
  {
    name: 'reshape two nodes',
    code: CHECKOUT,
    selected: ['retry', 'review'],
    message: 'Make these rounded rectangles.',
  },
  {
    name: 'insert a step after one node',
    code: CHECKOUT,
    selected: ['cart'],
    message: 'Add a step right after this one that applies discount codes.',
  },
  { name: 'delete one node', code: CHECKOUT, selected: ['review'], message: 'Delete this step.' },
  {
    name: 'split a decision',
    code: CHECKOUT,
    selected: ['pay'],
    message: 'Split this decision into two checks: "Card valid?" and then "Funds available?".',
  },
  {
    name: 'highlight two nodes',
    code: CHECKOUT,
    selected: ['order', 'done'],
    message: 'Highlight these in green.',
  },
  {
    name: 'group two nodes',
    code: CHECKOUT,
    selected: ['retry', 'review'],
    message: 'Group these into a subgraph called "Payment recovery".',
  },
  {
    name: 'add options under one node',
    code: SIGNUP,
    selected: ['social'],
    message: 'Add Google and GitHub as options that lead into this step.',
  },
  {
    name: 'add a loop on one node',
    code: SIGNUP,
    selected: ['verify'],
    message: 'Add a "Resend email" loop on this step.',
  },
  {
    name: 'shorten two labels',
    code: SIGNUP,
    selected: ['welcome', 'dash'],
    message: 'Shorten these labels to one word each.',
  },
];
