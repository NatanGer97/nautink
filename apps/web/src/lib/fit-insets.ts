/** Room a fit keeps free at the canvas's top and bottom, in pixels (floating bars sit there). */
export interface FitInsets {
  top: number;
  bottom: number;
}

export const NO_INSETS: FitInsets = { top: 0, bottom: 0 };
