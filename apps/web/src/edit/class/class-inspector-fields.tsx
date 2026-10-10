import { allNamespaces } from '@nautink/editors/class/layout';
import { STEREOTYPES } from '@nautink/editors/class/model';
import { useState } from 'react';

import { NEW_NAMESPACE } from './class-namespace-actions.ts';
import { CommitField, SelectField } from '../canvas/inspector-fields.tsx';

import type { SelectOption } from '../canvas/inspector-fields.tsx';
import type { ClassModel } from '@nautink/editors/class/types';
import type { ReactElement } from 'react';

/** Which namespace a class or note is in, or a new one (v1's NamespaceSelect). */
export function NamespaceSelect({
  model,
  value,
  onChange,
}: {
  model: ClassModel;
  value: string;
  onChange: (choice: string) => void;
}): ReactElement {
  const options: SelectOption[] = [
    { value: '', label: 'None' },
    ...allNamespaces(model)
      .sort()
      .map((id) => ({ value: id, label: id })),
    { value: NEW_NAMESPACE, label: 'New namespace…' },
  ];
  return (
    <SelectField
      label="Namespace"
      value={value}
      groups={[{ label: 'Namespaces', options }]}
      onChange={onChange}
    />
  );
}

const CUSTOM: string = '__custom';

const STEREOTYPE_OPTIONS: SelectOption[] = [
  { value: '', label: 'None' },
  ...STEREOTYPES.map((stereotype) => ({ value: stereotype, label: `«${stereotype}»` })),
  { value: CUSTOM, label: 'Custom…' },
];

function StereotypeEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  const isKnown: boolean = value === '' || STEREOTYPES.includes(value);
  const [isCustom, setCustom] = useState<boolean>(!isKnown);
  const customValue: string = isKnown ? '' : value;
  return (
    <>
      <SelectField
        label="Stereotype"
        value={isCustom ? CUSTOM : value}
        groups={[{ label: 'Stereotypes', options: STEREOTYPE_OPTIONS }]}
        onChange={(choice) => {
          setCustom(choice === CUSTOM);
          if (choice !== CUSTOM) {
            onChange(choice);
          }
        }}
      />
      {isCustom ? (
        <CommitField
          label="Custom stereotype"
          value={customValue}
          placeholder="e.g. entity"
          shouldFocus={isKnown}
          onCommit={onChange}
        />
      ) : null}
    </>
  );
}

/** The class's first annotation: a known stereotype, none, or a custom one (v1). */
export function StereotypeField(props: {
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  // A new value from outside (undo, Claude) restarts the field with it.
  return <StereotypeEditor key={props.value} {...props} />;
}
