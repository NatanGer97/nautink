import './storybook.css';

import { TooltipProvider } from '@nautink/ui/components/tooltip';

import { applyTheme } from '../src/theme.ts';

import type { ResolvedTheme } from '../src/theme.ts';
import type { Decorator, Preview } from '@storybook/react-vite';
import type { ReactElement } from 'react';

/** Paints the toolbar's theme on <html>, as the app does, so portalled overlays follow it too. */
const withTheme: Decorator = (renderStory, context): ReactElement => {
  const theme: ResolvedTheme = context.globals.theme === 'dark' ? 'dark' : 'light';
  applyTheme(document.documentElement, theme);
  return <TooltipProvider delayDuration={0}>{renderStory()}</TooltipProvider>;
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Light or dark tokens',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [withTheme],
  parameters: {
    layout: 'padded',
    // The same rules as the app's axe e2e spec (apps/web/e2e/a11y.spec.ts).
    a11y: {
      options: {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      },
    },
  },
};

export default preview;
