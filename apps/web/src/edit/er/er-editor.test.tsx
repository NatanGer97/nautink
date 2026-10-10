import { TooltipProvider } from '@nautink/ui/components/tooltip';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErEditor } from './er-editor.tsx';
import { agentEditingText } from '../read-only-reason.ts';
import { requestSelection, useCanvasSelectionStore } from '../selection/canvas-selection.ts';
import { SYNTAX_ERROR_REASON } from '../use-editor-core.ts';

import type { VisualEditorProps } from '../editor-props.ts';

const CODE = [
  'erDiagram',
  '    CUSTOMER ||--o{ ORDER : places',
  '    CUSTOMER {',
  '        int id PK',
  '        string email UK "login"',
  '    }',
  '',
].join('\n');

vi.mock('../positions/app-position-store.ts', async () => {
  const { MemoryPositionStore: Store } = await import('@nautink/visual-core/positions');
  return { appPositionStore: new Store() };
});

function renderEditor(overrides: Partial<VisualEditorProps> = {}): {
  onChange: ReturnType<typeof vi.fn>;
  rerender: (next: Partial<VisualEditorProps>) => void;
} {
  const onChange = vi.fn();
  const props: VisualEditorProps = {
    diagramId: 'd1',
    code: CODE,
    isDark: false,
    readOnlyReason: null,
    canSavePositions: true,
    onChange,
    ...overrides,
  };
  const view = render(
    <TooltipProvider>
      <ErEditor {...props} />
    </TooltipProvider>,
  );
  return {
    onChange,
    rerender: (next): void => {
      view.rerender(
        <TooltipProvider>
          <ErEditor {...props} {...next} />
        </TooltipProvider>,
      );
    },
  };
}

async function selectItems(ids: string[]): Promise<HTMLElement> {
  act(() => {
    requestSelection('d1', ids);
  });
  return screen.findByRole('region', { name: 'Inspector' });
}

describe('ErEditor', () => {
  it('shows entity tables with their attributes and key badges', async () => {
    renderEditor();
    const customer = await screen.findByTestId('er-node-CUSTOMER');
    expect(within(customer).getByText('email')).toBeTruthy();
    expect(within(customer).getByText('login')).toBeTruthy();
    expect(within(customer).getByTitle('Primary key').textContent).toBe('PK');
    expect(screen.getByTestId('er-node-ORDER')).toBeTruthy();
  });

  it('renames an entity and edits its attributes through the inspector', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('er-node-CUSTOMER');
    const inspector = await selectItems(['CUSTOMER']);
    expect(within(inspector).getByRole('heading', { name: 'Entity' })).toBeTruthy();
    expect(useCanvasSelectionStore.getState().items).toEqual([
      { id: 'CUSTOMER', label: 'CUSTOMER', kind: 'entity' },
    ]);
    const email = within(inspector).getByRole('listitem', { name: 'Attribute email' });
    await user.click(within(email).getByRole('button', { name: 'Foreign key' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('string email FK, UK "login"'),
      'Toggled FK in CUSTOMER',
    );
    const type = within(email).getByLabelText('Attribute type');
    await user.clear(type);
    await user.type(type, 'varchar{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('varchar email'),
      'Edited attribute of CUSTOMER',
    );
    await user.click(within(email).getByRole('button', { name: 'Move up' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringMatching(/varchar email[^\n]*\n\s+int id PK/),
      'Reordered attributes of CUSTOMER',
    );
    await user.click(within(inspector).getByRole('button', { name: 'Add attribute' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('string field'),
      'Added attribute to CUSTOMER',
    );
    const name = within(inspector).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'CLIENT{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('CLIENT ||--o{ ORDER : places'),
      'Renamed CUSTOMER → CLIENT',
    );
    expect(await screen.findByTestId('er-node-CLIENT')).toBeTruthy();
  });

  it('edits a relationship’s ends, line and direction through the inspector', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('er-node-CUSTOMER');
    const inspector = await selectItems(['R_CUSTOMER_ORDER_0']);
    expect(within(inspector).getByRole('heading', { name: 'Relationship' })).toBeTruthy();
    const atOrder = within(inspector).getByRole('group', { name: 'At ORDER' });
    await user.click(within(atOrder).getByRole('button', { name: 'One or more' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('CUSTOMER ||--|{ ORDER : places'),
      'Changed cardinality of CUSTOMER → ORDER',
    );
    await user.click(within(inspector).getByRole('radio', { name: 'Non-identifying' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('CUSTOMER ||..|{ ORDER : places'),
      'Changed line of CUSTOMER → ORDER',
    );
    await user.click(within(inspector).getByRole('button', { name: 'Reverse' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('ORDER }|..|| CUSTOMER : places'),
      'Reversed relationship CUSTOMER → ORDER',
    );
    expect(await screen.findByRole('heading', { name: 'Relationship' })).toBeTruthy();
  });

  it('adds an entity from the toolbar, renames it in place and deletes from the inspector', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('er-node-CUSTOMER');
    await user.click(screen.getByRole('button', { name: 'Add entity' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('ENTITY {'),
      'Added entity ENTITY',
    );
    const field = await screen.findByRole('textbox', { name: 'Entity name' });
    await user.clear(field);
    await user.type(field, 'PRODUCT{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('PRODUCT {'),
      'Renamed ENTITY → PRODUCT',
    );
    const inspector = await selectItems(['ORDER']);
    await user.click(within(inspector).getByRole('button', { name: 'Delete entity' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.stringContaining('ORDER'),
      'Deleted ORDER',
    );
  });

  it('shows the many-entities inspector and a group’s inspector', async () => {
    const code = `${CODE}    subgraph SALES ["Sales"]\n        ORDER\n    end\n`;
    const { onChange } = renderEditor({ code });
    const user = userEvent.setup();
    await screen.findByTestId('er-group-SALES');
    const many = await selectItems(['CUSTOMER', 'ORDER']);
    expect(within(many).getByRole('heading', { name: '2 entities' })).toBeTruthy();
    const mixed = await selectItems(['CUSTOMER', 'R_CUSTOMER_ORDER_0']);
    expect(within(mixed).getByRole('heading', { name: '2 items' })).toBeTruthy();
    expect(within(mixed).getByText('CUSTOMER, CUSTOMER → ORDER')).toBeTruthy();
    const group = await selectItems(['SALES']);
    expect(within(group).getByRole('heading', { name: 'Group' })).toBeTruthy();
    await user.click(within(group).getByRole('button', { name: 'Ungroup' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.stringContaining('subgraph'),
      'Ungrouped Sales',
    );
  });

  it('is read-only while Claude edits, and keeps the last canvas on a syntax error', async () => {
    const { rerender } = renderEditor({ readOnlyReason: agentEditingText('Claude') });
    await screen.findByTestId('er-node-CUSTOMER');
    // Claude's working pill on the canvas says so; the editor shows no note of its own.
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add entity' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    rerender({ readOnlyReason: null, code: `${CODE}    ORDER ||--\n` });
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(SYNTAX_ERROR_REASON);
    });
    expect(screen.getByTestId('er-node-ORDER')).toBeTruthy();
  });

  it('places new entities from outside changes, and hints on an empty diagram', async () => {
    const { rerender } = renderEditor();
    await screen.findByTestId('er-node-CUSTOMER');
    rerender({ code: `${CODE}    ORDER ||--|{ LINE : contains\n` });
    expect(await screen.findByTestId('er-node-LINE')).toBeTruthy();
    rerender({ code: 'erDiagram\n' });
    expect(await screen.findByText('Add an entity from the toolbar to start')).toBeTruthy();
  });

  it('lays the canvas out again without writing code, and changes direction as one step', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('er-node-CUSTOMER');
    await user.click(screen.getByRole('button', { name: 'Auto layout' }));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('combobox', { name: 'Direction' }));
    await user.click(await screen.findByRole('option', { name: 'Left → right' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('direction LR'),
      'Changed direction to LR',
    );
  });
});
