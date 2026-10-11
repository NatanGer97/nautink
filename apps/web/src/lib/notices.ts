import { toast } from 'sonner';

import type { NoticeAction } from '../workspace/store/workspace-deps.ts';

/** Errors stay a little longer, so there is time to read what went wrong. */
const ERROR_NOTICE_MS: number = 6000;

/** A toast, with an optional button such as "Undo". */
export function showNotice(message: string, action?: NoticeAction): void {
  toast(
    message,
    action === undefined ? {} : { action: { label: action.label, onClick: action.run } },
  );
}

/** An error toast. */
export function showError(message: string): void {
  toast.error(message, { duration: ERROR_NOTICE_MS });
}
