const ARROW_STEPS: Readonly<Record<string, number>> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

function select(tabs: HTMLElement[], chosen: HTMLElement): void {
  for (const tab of tabs) {
    const isChosen: boolean = tab === chosen;
    tab.setAttribute('aria-selected', String(isChosen));
    tab.tabIndex = isChosen ? 0 : -1;
    const panel: HTMLElement | null = document.getElementById(
      tab.getAttribute('aria-controls') ?? '',
    );
    if (panel === null) {
      throw new Error(`Tab "${tab.id}" controls a panel that is not on the page.`);
    }
    panel.hidden = !isChosen;
  }
}

function onKey(tabs: HTMLElement[], event: KeyboardEvent): void {
  const step: number | undefined = ARROW_STEPS[event.key];
  const current: number = tabs.findIndex((tab) => tab === document.activeElement);
  if (step === undefined || current === -1) {
    return;
  }
  event.preventDefault();
  const next: HTMLElement | undefined = tabs[(current + step + tabs.length) % tabs.length];
  if (next !== undefined) {
    select(tabs, next);
    next.focus();
  }
}

/** Wires every ARIA tab list on the page: click to choose, arrow keys to move. */
export function setUpTabs(root: Document): void {
  for (const list of root.querySelectorAll<HTMLElement>('[role=tablist]')) {
    const tabs: HTMLElement[] = [...list.querySelectorAll<HTMLElement>('[role=tab]')];
    for (const tab of tabs) {
      tab.addEventListener('click', () => {
        select(tabs, tab);
      });
    }
    list.addEventListener('keydown', (event) => {
      onKey(tabs, event);
    });
  }
}
