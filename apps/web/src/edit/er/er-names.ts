import { displayName } from '@nautink/editors/er/model';
import { clip } from '@nautink/visual-core/text';

import type { ErEntity, ErModel, ErRelationship, ErSubgraph } from '@nautink/editors/er/model';

const NAME_CLIP: number = 28;

/** An entity's name in step labels and the inspector: its alias, else its name. */
export function entityName(model: ErModel, name: string): string {
  const entity: ErEntity | undefined = model.entities.find((item) => item.name === name);
  return clip(entity === undefined ? name : displayName(entity), NAME_CLIP);
}

/** A group's name: its title, else its id. */
export function groupName(model: ErModel, id: string): string {
  const group: ErSubgraph | undefined = model.subgraphs.find((item) => item.id === id);
  return clip(group === undefined || group.title === '' ? id : group.title, NAME_CLIP);
}

/** An end of a relationship: an entity or a subgraph. */
export function endName(model: ErModel, id: string): string {
  return model.subgraphs.some((group) => group.id === id)
    ? groupName(model, id)
    : entityName(model, id);
}

/** "CUSTOMER → ORDER" for a relationship, or '' when there is no such relationship. */
export function relName(model: ErModel, id: string): string {
  const rel: ErRelationship | undefined = model.rels.find((item) => item.id === id);
  return rel === undefined ? '' : `${endName(model, rel.from)} → ${endName(model, rel.to)}`;
}
