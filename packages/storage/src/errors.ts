/** Thrown when a diagram or version id is not in the database. */
export class RecordNotFoundError extends Error {
  constructor(kind: 'diagram' | 'version', id: string) {
    super(`No ${kind} with id "${id}".`);
    this.name = 'RecordNotFoundError';
  }
}

/** The record, or a `RecordNotFoundError` naming the id when there is none. */
export function requireRecord<T>(
  record: T | undefined,
  kind: 'diagram' | 'version',
  id: string,
): T {
  if (record === undefined) {
    throw new RecordNotFoundError(kind, id);
  }
  return record;
}
