import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConnectionRow } from './connection-row.tsx';

describe('ConnectionRow', () => {
  it('names the CLI and shows its version, or says it is unknown', () => {
    const { rerender } = render(
      <ConnectionRow
        title="Codex CLI"
        status={{ kind: 'connected', version: '0.154.0' }}
        onRecheck={vi.fn()}
      />,
    );
    expect(screen.getByText('Codex CLI')).toBeTruthy();
    expect(screen.getByText('0.154.0')).toBeTruthy();
    rerender(
      <ConnectionRow
        title="Codex CLI"
        status={{ kind: 'connected', version: null }}
        onRecheck={vi.fn()}
      />,
    );
    expect(screen.getByText('unknown version')).toBeTruthy();
  });
});
