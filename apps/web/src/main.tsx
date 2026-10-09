import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app.tsx';
import './styles.css';

const rootElement: HTMLElement | null = document.getElementById('root');
if (rootElement === null) {
  throw new Error('index.html has no #root element to mount the app into.');
}
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
