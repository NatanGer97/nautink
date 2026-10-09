/**
 * For an overlay's `onOpenAutoFocus`: focus the overlay itself rather than its first button.
 * Radix would focus that button, which opens its tooltip, and the first Escape would then only
 * close the tooltip instead of the overlay.
 */
export function focusOverlayContainer(event: Event): void {
  event.preventDefault();
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.focus();
  }
}
