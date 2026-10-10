# Brand

The Nautink logo: a wave that curls into a pen nib, with diagram nodes on its crest.

| File | Use |
| --- | --- |
| `nautink-logo-source.webp` | The original artwork (2000×667, transparent). Make every other file from this one. |
| `nautink-logo.webp` | Mark and wordmark, for light backgrounds (README) |
| `nautink-logo-dark.webp` | The same for dark backgrounds: the navy parts are recolored to `#e8eef6` |
| `nautink-mark.png`, `nautink-mark-dark.png` | The mark alone, 512×512, transparent |

The app uses its own copies:

- `apps/web/src/shell/assets/nautink-mark*.png`: the top-bar mark, 66 px tall (22 px at 3×), swapped
  by theme in `logo-mark.tsx`.
- `apps/web/public/favicon*.png` (64×64, chosen by `prefers-color-scheme`) and
  `apple-touch-icon.png` (180×180 on white).

Colors: navy `#002450`, teal `#0097a4`. The navy disappears on the dark theme's panels, so always use
the `-dark` variant there.

## Use

The Nautink name and logo are not covered by the repository's MIT license. Use them to refer to
Nautink itself; a fork or a product of your own needs its own name and logo.
