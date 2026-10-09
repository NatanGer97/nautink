// Pure ER model edits. Each returns a new model (some return { model, id }).
import { cleanName, cleanText, cleanWord, DEFAULT_LABEL, KEYS, relId } from './model.ts';

import type { ErAttribute, ErEntity, ErKey, ErModel, ErRelationship, ErSubgraph } from './model.ts';

const FIRST_SUFFIX: number = 2;

/** A model edit that also returns the id of the relationship it created or changed. */
export interface Edited {
  model: ErModel;
  id: string;
}

function mapEntity(model: ErModel, name: string, edit: (entity: ErEntity) => ErEntity): ErModel {
  return {
    ...model,
    entities: model.entities.map((entity: ErEntity) =>
      entity.name === name ? edit(entity) : entity,
    ),
  };
}

function addMember(
  subgraphs: readonly ErSubgraph[],
  groupId: string | null,
  id: string,
): ErSubgraph[] {
  return subgraphs.map((subgraph: ErSubgraph) =>
    subgraph.id === groupId ? { ...subgraph, members: [...subgraph.members, id] } : subgraph,
  );
}

/** Adds an entity, inside a subgraph when `groupId` is given. */
export function addEntity(
  model: ErModel,
  entity: Pick<ErEntity, 'name'> & Partial<ErEntity>,
  groupId: string | null = null,
): ErModel {
  const added: ErEntity = { alias: '', attributes: [], classes: [], ...entity };
  const subgraphs: ErSubgraph[] = groupId
    ? addMember(model.subgraphs, groupId, entity.name)
    : model.subgraphs;
  return { ...model, entities: [...model.entities, added], subgraphs };
}

/** Patches an entity. `%` cannot appear in an alias (the lexer rejects it), so it is dropped. */
export function updateEntity(model: ErModel, name: string, patch: Partial<ErEntity>): ErModel {
  const clean: Partial<ErEntity> =
    patch.alias === undefined
      ? patch
      : { ...patch, alias: cleanText(patch.alias).replace(/[%\\]/g, '').trim() };
  return mapEntity(model, name, (entity: ErEntity) => ({ ...entity, ...clean }));
}

// Recomputes relationship ids the way parse() does, so ids stay stable across a round trip.
function relabelIds(rels: readonly ErRelationship[]): ErRelationship[] {
  const counts: Map<string, number> = new Map<string, number>();
  return rels.map((relationship: ErRelationship) => {
    const key: string = `${relationship.from}_${relationship.to}`;
    const index: number = (counts.get(key) ?? -1) + 1;
    counts.set(key, index);
    return { ...relationship, id: relId(relationship.from, relationship.to, index) };
  });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

function renameEnds(
  rels: readonly ErRelationship[],
  rename: (id: string) => string,
): ErRelationship[] {
  return relabelIds(
    rels.map((relationship: ErRelationship) => ({
      ...relationship,
      from: rename(relationship.from),
      to: rename(relationship.to),
    })),
  );
}

function renamed(model: ErModel, from: string, name: string): ErModel {
  const rename = (id: string): string => (id === from ? name : id);
  const reference: RegExp = new RegExp(`^(style|class)(\\s+)${escapeRegExp(from)}(?=\\s)`);
  return {
    ...model,
    entities: model.entities.map((entity: ErEntity) =>
      entity.name === from ? { ...entity, name } : entity,
    ),
    rels: renameEnds(model.rels, rename),
    subgraphs: model.subgraphs.map((subgraph: ErSubgraph) => ({
      ...subgraph,
      members: subgraph.members.map(rename),
    })),
    extra: model.extra.map((line: string) => line.replace(reference, `$1$2${name}`)),
  };
}

/** Renames an entity everywhere it is referenced. Null when the new name is invalid or taken. */
export function renameEntity(model: ErModel, from: string, to: string): ErModel | null {
  const name: string = cleanName(to);
  const isTaken: boolean =
    model.entities.some((entity: ErEntity) => entity.name === name) ||
    model.subgraphs.some((subgraph: ErSubgraph) => subgraph.id === name);
  return !name || name === from || isTaken ? null : renamed(model, from, name);
}

/** A relationship to add: its ends, plus any field to override the defaults. */
export type NewRelationship = Pick<ErRelationship, 'from' | 'to'> &
  Partial<Omit<ErRelationship, 'id'>>;

/** Adds an identifying one-to-many relationship (unless `relationship` says otherwise). */
export function addRel(model: ErModel, relationship: NewRelationship): Edited {
  const added: ErRelationship = {
    id: '',
    fromCard: 'ONLY_ONE',
    toCard: 'ZERO_OR_MORE',
    isIdentifying: true,
    label: DEFAULT_LABEL,
    ...relationship,
  };
  const rels: ErRelationship[] = relabelIds([...model.rels, added]);
  return { model: { ...model, rels }, id: rels.at(-1)?.id ?? '' };
}

export function updateRel(model: ErModel, id: string, patch: Partial<ErRelationship>): ErModel {
  const clean: Partial<ErRelationship> =
    patch.label === undefined ? patch : { ...patch, label: cleanText(patch.label) };
  return {
    ...model,
    rels: model.rels.map((relationship: ErRelationship) =>
      relationship.id === id ? { ...relationship, ...clean } : relationship,
    ),
  };
}

function reversed(relationship: ErRelationship): ErRelationship {
  return {
    ...relationship,
    from: relationship.to,
    to: relationship.from,
    fromCard: relationship.toCard,
    // `u` (MD_PARENT) is only valid on the left-hand side.
    toCard: relationship.fromCard === 'MD_PARENT' ? 'ONLY_ONE' : relationship.fromCard,
  };
}

/** Swaps the ends of a relationship (cardinalities travel with their entity). */
export function reverseRel(model: ErModel, id: string): Edited {
  const index: number = model.rels.findIndex(
    (relationship: ErRelationship) => relationship.id === id,
  );
  const rels: ErRelationship[] = relabelIds(
    model.rels.map((relationship: ErRelationship, at: number) =>
      at === index ? reversed(relationship) : relationship,
    ),
  );
  return { model: { ...model, rels }, id: rels[index]?.id ?? id };
}

// Drops `group` from every subgraph and hands its members to the subgraph that contains it.
function liftMembers(model: ErModel, group: ErSubgraph): ErSubgraph[] {
  const parent: ErSubgraph | undefined = model.subgraphs.find(
    (subgraph: ErSubgraph) => subgraph.id !== group.id && subgraph.members.includes(group.id),
  );
  return model.subgraphs
    .filter((subgraph: ErSubgraph) => subgraph.id !== group.id)
    .map((subgraph: ErSubgraph) => {
      const members: string[] = subgraph.members.filter((member: string) => member !== group.id);
      const lifted: string[] =
        subgraph.id === parent?.id
          ? group.members.filter((member: string) => !members.includes(member))
          : [];
      return { ...subgraph, members: [...members, ...lifted] };
    });
}

/** Removes a subgraph frame; its members move up to the parent subgraph. Links to it are dropped. */
export function ungroup(model: ErModel, groupId: string): ErModel {
  const group: ErSubgraph | undefined = model.subgraphs.find(
    (subgraph: ErSubgraph) => subgraph.id === groupId,
  );
  if (!group) {
    return model;
  }
  const rels: ErRelationship[] = model.rels.filter(
    (relationship: ErRelationship) => relationship.from !== groupId && relationship.to !== groupId,
  );
  return { ...model, subgraphs: liftMembers(model, group), rels: relabelIds(rels) };
}

export interface ErSelection {
  entityNames?: readonly string[];
  relIds?: readonly string[];
  groupIds?: readonly string[];
}

/** Deletes entities (with their relationships), relationships and subgraphs (keeping members). */
export function deleteItems(
  model: ErModel,
  { entityNames = [], relIds = [], groupIds = [] }: ErSelection,
): ErModel {
  const next: ErModel = groupIds.reduce(ungroup, model);
  const isDeleted = (relationship: ErRelationship): boolean =>
    relIds.includes(relationship.id) ||
    entityNames.includes(relationship.from) ||
    entityNames.includes(relationship.to);
  return {
    ...next,
    entities: next.entities.filter((entity: ErEntity) => !entityNames.includes(entity.name)),
    rels: relabelIds(next.rels.filter((relationship: ErRelationship) => !isDeleted(relationship))),
    subgraphs: next.subgraphs.map((subgraph: ErSubgraph) => ({
      ...subgraph,
      members: subgraph.members.filter((member: string) => !entityNames.includes(member)),
    })),
  };
}

export function updateGroup(model: ErModel, id: string, patch: Partial<ErSubgraph>): ErModel {
  return {
    ...model,
    subgraphs: model.subgraphs.map((subgraph: ErSubgraph) =>
      subgraph.id === id ? { ...subgraph, ...patch } : subgraph,
    ),
  };
}

/** Moves an entity into a subgraph, or to the top level with null. */
export function setEntityGroup(model: ErModel, name: string, groupId: string | null): ErModel {
  const subgraphs: ErSubgraph[] = model.subgraphs.map((subgraph: ErSubgraph) => {
    const members: string[] = subgraph.members.filter((member: string) => member !== name);
    return { ...subgraph, members: subgraph.id === groupId ? [...members, name] : members };
  });
  return { ...model, subgraphs };
}

// ---- attributes ----

/** The next attribute for an entity: `int id PK` first, then `string field`, `field2`, … */
export function newAttribute(entity: ErEntity): ErAttribute {
  const names: Set<string> = new Set<string>(
    entity.attributes.map((attribute: ErAttribute) => attribute.name),
  );
  let name: string = entity.attributes.length ? 'field' : 'id';
  for (let index: number = FIRST_SUFFIX; names.has(name); index++) {
    name = `field${String(index)}`;
  }
  const isId: boolean = name === 'id';
  return { type: isId ? 'int' : 'string', name, keys: isId ? ['PK'] : [], comment: '' };
}

export function addAttribute(model: ErModel, entityName: string): ErModel {
  return mapEntity(model, entityName, (entity: ErEntity) => ({
    ...entity,
    attributes: [...entity.attributes, newAttribute(entity)],
  }));
}

/** One attribute of one entity. */
export interface AttributeRef {
  entityName: string;
  index: number;
}

function cleanAttributePatch(patch: Partial<ErAttribute>): Partial<ErAttribute> {
  return {
    ...patch,
    ...(patch.type === undefined ? {} : { type: cleanWord(patch.type, 'string') }),
    ...(patch.name === undefined ? {} : { name: cleanWord(patch.name, 'field') }),
    ...(patch.comment === undefined ? {} : { comment: cleanText(patch.comment) }),
    ...(patch.keys === undefined
      ? {}
      : { keys: KEYS.filter((key: ErKey) => patch.keys?.includes(key)) }),
  };
}

/** Patches an attribute; type and name are made valid words, keys are put in PK, FK, UK order. */
export function updateAttribute(
  model: ErModel,
  { entityName, index, patch }: AttributeRef & { patch: Partial<ErAttribute> },
): ErModel {
  const clean: Partial<ErAttribute> = cleanAttributePatch(patch);
  return mapEntity(model, entityName, (entity: ErEntity) => ({
    ...entity,
    attributes: entity.attributes.map((attribute: ErAttribute, at: number) =>
      at === index ? { ...attribute, ...clean } : attribute,
    ),
  }));
}

/** Turns one key of an attribute on or off. Unchanged when the attribute does not exist. */
export function toggleKey(
  model: ErModel,
  { entityName, index, key }: AttributeRef & { key: ErKey },
): ErModel {
  const entity: ErEntity | undefined = model.entities.find(
    (candidate: ErEntity) => candidate.name === entityName,
  );
  const attribute: ErAttribute | undefined = entity?.attributes[index];
  if (!attribute) {
    return model;
  }
  const keys: ErKey[] = attribute.keys.includes(key)
    ? attribute.keys.filter((existing: ErKey) => existing !== key)
    : [...attribute.keys, key];
  return updateAttribute(model, { entityName, index, patch: { keys } });
}

export function removeAttribute(model: ErModel, entityName: string, index: number): ErModel {
  return mapEntity(model, entityName, (entity: ErEntity) => ({
    ...entity,
    attributes: [...entity.attributes.slice(0, index), ...entity.attributes.slice(index + 1)],
  }));
}

/** Swaps an attribute with its neighbour `delta` places away; unchanged at either end. */
export function moveAttribute(
  model: ErModel,
  { entityName, index, delta }: AttributeRef & { delta: number },
): ErModel {
  return mapEntity(model, entityName, (entity: ErEntity) => {
    const attributes: ErAttribute[] = [...entity.attributes];
    const moving: ErAttribute | undefined = attributes[index];
    const other: ErAttribute | undefined = attributes[index + delta];
    if (!moving || !other) {
      return entity;
    }
    attributes[index] = other;
    attributes[index + delta] = moving;
    return { ...entity, attributes };
  });
}
