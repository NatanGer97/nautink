# @nautink/ui

## 0.1.0

### Minor Changes

- f761b6f: Rebrand to the logo colors: cool slate neutrals in light mode, deep navy in dark mode, the logo navy for primary buttons and teal for selection and focus. The code editor and diagram renders use the same palette.
- 405168c: Add the design system package: the PRD §6 color, type, radius and elevation tokens (light and dark) mapped onto shadcn/ui, self-hosted Geist fonts, the shadcn/ui components the app uses, a theme helper and an icon button with a shortcut tooltip.

### Patch Changes

- 15f6c60: Darken the `--faint` token so faint text passes 4.5:1 contrast in light and dark, and make the Claude connection e2e test independent of whether the API server is running.
- 23a1c74: Declare the MIT license in every package.
- bb16231: Add Storybook (React + Vite, a11y addon) with a story for every component and the design tokens in light and dark. The slider now puts its `aria-label` / `aria-labelledby` on the thumb, the element with the slider role.
