// Attribute and method edits as labelled undo steps (v1's ClassEditor `actions`).
import * as ops from '@nautink/editors/class/ops';

import { run } from './class-action-context.ts';
import { className, memberWord } from './class-names.ts';

import type { ClassActionContext } from './class-action-context.ts';
import type { AttrPatch, MemberRef, MethodPatch } from '@nautink/editors/class/ops';
import type { ClassAttr } from '@nautink/editors/class/types';

/** Adds an attribute, or a value to an enumeration. */
export function addAttr(context: ClassActionContext, classId: string, isEnumLike: boolean): void {
  const attr: ClassAttr = isEnumLike
    ? { vis: '', text: 'VALUE', cls: '' }
    : { vis: '+', text: 'String field', cls: '' };
  run(context, (model) => [
    ops.addAttr(model, classId, attr),
    `Added ${isEnumLike ? 'value' : 'attribute'} to ${className(model, classId)}`,
  ]);
}

export function addMethod(context: ClassActionContext, classId: string): void {
  run(context, (model) => [
    ops.addMethod(model, classId),
    `Added method to ${className(model, classId)}`,
  ]);
}

export function updateAttr(context: ClassActionContext, edit: AttrPatch): void {
  run(context, (model) => [
    ops.updateAttr(model, edit),
    `Edited attribute of ${className(model, edit.classId)}`,
  ]);
}

export function updateMethod(context: ClassActionContext, edit: MethodPatch): void {
  run(context, (model) => [
    ops.updateMethod(model, edit),
    `Edited method of ${className(model, edit.classId)}`,
  ]);
}

export function moveMember(context: ClassActionContext, ref: MemberRef & { delta: number }): void {
  run(context, (model) => [
    ops.moveMember(model, ref),
    `Reordered ${memberWord(ref.list)}s of ${className(model, ref.classId)}`,
  ]);
}

export function removeMember(context: ClassActionContext, ref: MemberRef): void {
  run(context, (model) => [
    ops.removeMember(model, ref),
    `Removed ${memberWord(ref.list)} from ${className(model, ref.classId)}`,
  ]);
}

/** One member from a line of text (inline canvas editing); empty text removes it. */
export function setMemberText(
  context: ClassActionContext,
  ref: MemberRef & { text: string },
): void {
  run(context, (model) => [
    ops.setMemberText(model, ref),
    `Edited ${memberWord(ref.list)} of ${className(model, ref.classId)}`,
  ]);
}
