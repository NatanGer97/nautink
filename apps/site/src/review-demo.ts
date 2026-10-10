type DemoState = 'proposal' | 'accepted' | 'rejected';

const ACTION_STATES: Readonly<Record<string, DemoState>> = {
  accept: 'accepted',
  reject: 'rejected',
  replay: 'proposal',
};

const KEY_STATES: Readonly<Record<string, DemoState>> = {
  Enter: 'accepted',
  Escape: 'rejected',
};

function setState(demo: HTMLElement, state: DemoState): void {
  demo.setAttribute('data-state', state);
}

function isProposalShown(demo: HTMLElement): boolean {
  return demo.dataset.state === 'proposal';
}

function onActionClick(demo: HTMLElement, event: MouseEvent): void {
  const button: HTMLElement | null =
    event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
  const state: DemoState | undefined = ACTION_STATES[button?.dataset.action ?? ''];
  if (state === undefined) {
    return;
  }
  setState(demo, state);
  demo
    .querySelector<HTMLElement>(
      state === 'proposal' ? '[data-action=accept]' : '[data-action=replay]',
    )
    ?.focus();
}

/**
 * Enter and Esc work like in the app, but only while the demo is on screen and the key is not meant
 * for a control that has focus.
 */
function onKey(demo: HTMLElement, isOnScreen: () => boolean, event: KeyboardEvent): void {
  const state: DemoState | undefined = KEY_STATES[event.key];
  const isFocusFree: boolean = document.activeElement === document.body;
  if (state === undefined || !isOnScreen() || !isFocusFree || !isProposalShown(demo)) {
    return;
  }
  event.preventDefault();
  setState(demo, state);
}

function watchVisibility(demo: HTMLElement): () => boolean {
  let isVisible: boolean = false;
  const observer: IntersectionObserver = new IntersectionObserver(
    (entries) => {
      isVisible = entries.some((entry) => entry.isIntersecting);
    },
    { threshold: 0.5 },
  );
  observer.observe(demo);
  return () => isVisible;
}

/** Wires the "Review before apply" demo: the Accept, Reject and Replay buttons and Enter / Esc. */
export function setUpReviewDemo(root: Document): void {
  const demo: HTMLElement | null = root.querySelector<HTMLElement>('.demo');
  if (demo === null) {
    throw new Error('The review demo (.demo) is missing from the page.');
  }
  const isOnScreen: () => boolean = watchVisibility(demo);
  demo.addEventListener('click', (event) => {
    onActionClick(demo, event);
  });
  root.addEventListener('keydown', (event) => {
    onKey(demo, isOnScreen, event);
  });
}
