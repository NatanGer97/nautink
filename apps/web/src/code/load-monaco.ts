import type { MonacoApi } from './monaco-setup.ts';

let loading: Promise<MonacoApi> | null = null;

/**
 * Monaco is large, so it loads the first time the code drawer opens (PRD §9), together with the
 * Mermaid language, the themes and autocomplete. Every caller shares the one instance.
 */
export async function loadMonaco(): Promise<MonacoApi> {
  loading ??= (async (): Promise<MonacoApi> => (await import('./monaco-setup.ts')).monaco)();
  return loading;
}
