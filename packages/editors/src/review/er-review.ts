// An ER diagram as review elements: entities (with their attributes) and relationships.
import { removedRefs, signature } from './review-element.ts';
import { erEditor } from '../er/model.ts';

import type { ReviewAdapter } from './review-adapter.ts';
import type { ReviewElement } from './review-element.ts';
import type { ErEntity, ErModel, ErRelationship } from '../er/model.ts';

function entityElement(entity: ErEntity): ReviewElement {
  const { name, ...fields } = entity;
  return {
    id: name,
    kind: 'node',
    key: `entity:${name}`,
    sig: signature(fields),
    label: entity.alias || name,
  };
}

function relationshipElement(relationship: ErRelationship): ReviewElement {
  const { id, from, to, ...fields } = relationship;
  return {
    id,
    kind: 'edge',
    key: `relationship:${from}>${to}`,
    sig: signature(fields),
    label: relationship.label || `${from} → ${to}`,
    ends: [from, to],
  };
}

/** Entities, then relationships. A changed attribute marks its entity as changed. */
export function erElements(model: ErModel): ReviewElement[] {
  return [...model.entities.map(entityElement), ...model.rels.map(relationshipElement)];
}

/** The proposal plus what it removed. A removed entity shows outside any subgraph. */
export function erUnion(before: ErModel, after: ErModel): ErModel {
  const removed: Set<string> = removedRefs(erElements(before), erElements(after));
  return {
    ...after,
    entities: [
      ...after.entities,
      ...before.entities.filter((entity) => removed.has(`node:${entity.name}`)),
    ],
    rels: [...after.rels, ...before.rels.filter((rel) => removed.has(`edge:${rel.id}`))],
  };
}

export const erReview: ReviewAdapter<ErModel> = {
  module: erEditor,
  elements: erElements,
  union: erUnion,
};
