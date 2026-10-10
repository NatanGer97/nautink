import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { mergeConfig } from 'vite';

import type { StorybookConfig } from '@storybook/react-vite';

// Storybook for @nautink/ui (PRD §9): every component and the design tokens, in light and dark,
// with the accessibility addon. This package has no Vite config of its own, so the React and
// Tailwind plugins the web app uses are added here.
const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.tsx'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) => mergeConfig(viteConfig, { plugins: [react(), tailwindcss()] }),
};

export default config;
