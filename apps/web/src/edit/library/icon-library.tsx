import { ICON_PACKS } from '@nautink/visual-core/icons';
import { useState } from 'react';

import { LibraryItem, LibrarySearch } from './library-panel.tsx';
import { useIconSearch } from './use-icon-search.ts';
import { SelectField } from '../canvas/inspector-fields.tsx';
import { IconGlyph } from '../icons/icon-glyph.tsx';

import type { IconSearchState } from './use-icon-search.ts';
import type { ReactElement, ReactNode } from 'react';

/** The drag type of an icon tile; its data is the icon name ("logos:aws"). */
export const ICON_DRAG_TYPE: string = 'application/x-nautink-icon';

const PACK_OPTIONS: { value: string; label: string }[] = ICON_PACKS.map((pack) => ({
  value: pack.prefix,
  label: pack.name,
}));

/** "logos:aws-lambda" → "aws lambda". */
export function iconCaption(name: string): string {
  return (name.split(':')[1] ?? name).replace(/-/g, ' ');
}

export interface IconLibraryProps {
  isReadOnly: boolean;
  onPick: (name: string) => void;
  /** What a dragged icon carries under `ICON_DRAG_TYPE`; the name by default. */
  dragDataOf?: (name: string) => string;
  /** Editor-specific choices shown under the pack (the flowchart's frame). */
  children?: ReactNode;
}

function Results({
  search,
  isReadOnly,
  onPick,
  dragDataOf = (name: string): string => name,
}: { search: IconSearchState } & IconLibraryProps): ReactElement {
  if (search.results === null) {
    return <p className="p-3 text-muted-foreground">Loading icons…</p>;
  }
  if (search.error !== null) {
    return <p className="p-3 text-destructive">{search.error}</p>;
  }
  if (search.results.length === 0) {
    return <p className="p-3 text-muted-foreground">No icons match. Try another word or pack.</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-1 px-2 pb-2">
      {search.results.map((name) => (
        <LibraryItem
          key={name}
          title={name}
          caption={iconCaption(name)}
          isDisabled={isReadOnly}
          dragType={ICON_DRAG_TYPE}
          dragData={dragDataOf(name)}
          onPick={() => {
            onPick(name);
          }}
        >
          <IconGlyph name={name} size={26} />
        </LibraryItem>
      ))}
    </div>
  );
}

/** The library's Icons tab (logos, mdi, Font Awesome, Carbon), each pack fetched when first opened. */
export function IconLibrary({ children, ...props }: IconLibraryProps): ReactElement {
  const [prefix, setPrefix] = useState<string>('logos');
  const [query, setQuery] = useState<string>('');
  const search: IconSearchState = useIconSearch(prefix, query);
  return (
    <>
      <div className="flex flex-col gap-2 px-2 pt-2">
        <SelectField
          label="Icon pack"
          value={prefix}
          groups={[{ label: 'Packs', options: PACK_OPTIONS }]}
          onChange={setPrefix}
        />
        {children}
      </div>
      <LibrarySearch
        label="Search icons, e.g. aws, database, user"
        value={query}
        onChange={setQuery}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Results search={search} {...props} />
      </div>
    </>
  );
}
