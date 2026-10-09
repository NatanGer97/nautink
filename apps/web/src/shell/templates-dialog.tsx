import { TemplateGalleryDialog } from '../templates/template-gallery-dialog.tsx';

import type { ReactElement } from 'react';

/** The new-diagram gallery (M6), opened by the rail's Templates button and ⌘K. */
export function TemplatesDialog(): ReactElement {
  return <TemplateGalleryDialog />;
}
