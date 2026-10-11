import { openNautinkDb } from '../src/db/db.ts';

import type { NautinkDb } from '../src/db/db.ts';

/** A new, empty database with a unique name, so tests never share state. */
export async function openFreshDb(): Promise<NautinkDb> {
  return openNautinkDb(`nautink-test-${crypto.randomUUID()}`);
}
