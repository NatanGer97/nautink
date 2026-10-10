import { TooltipProvider } from '@nautink/ui/components/tooltip';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ClassEditor } from './class-editor.tsx';
import { DARK_CODE_NODE_FILL } from '../canvas/code-colors.ts';
import { CLAUDE_EDITING } from '../read-only-reason.ts';
import { requestSelection, useCanvasSelectionStore } from '../selection/canvas-selection.ts';
import { SYNTAX_ERROR_REASON } from '../use-editor-core.ts';

import type { VisualEditorProps } from '../editor-props.ts';

const CODE = `classDiagram
    class Animal {
        <<abstract>>
        +String name
        +makeSound() void*
    }
    class Dog
    Animal <|-- Dog
    note for Dog "Good boy"
`;

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
      <ClassEditor {...props} />
    </TooltipProvider>,
  );
  return {
    onChange,
    rerender: (next): void => {
      view.rerender(
        <TooltipProvider>
          <ClassEditor {...props} {...next} />
        </TooltipProvider>,
      );
    },
  };
}

async function inspectorFor(id: string): Promise<HTMLElement> {
  act(() => {
    requestSelection('d1', [id]);
  });
  return screen.findByRole('region', { name: 'Inspector' });
}

describe('ClassEditor', () => {
  it('tones down classes the code colors in dark mode, and leaves the others alone', async () => {
    renderEditor({
      code: `${CODE}    classDef warm fill:#ffe9a8\n    class Dog:::warm\n    style Animal color:#111\n    class Cat\n`,
    });
    const dog = await screen.findByTestId('class-node-Dog');
    expect(dog.className).toContain(DARK_CODE_NODE_FILL);
    expect(dog.style.getPropertyValue('--node-fill')).toBe('#ffe9a8');
    expect(screen.getByTestId('class-node-Animal').className).toContain(DARK_CODE_NODE_FILL);
    expect(screen.getByTestId('class-node-Cat').className).not.toContain(DARK_CODE_NODE_FILL);
  });

  it('draws classes with stereotypes and members, and publishes the selection', async () => {
    renderEditor();
    const animal = await screen.findByTestId('class-node-Animal');
    expect(within(animal).getByText('«abstract»')).toBeTruthy();
    expect(within(animal).getByText('makeSound() : void')).toBeTruthy();
    expect(screen.getByTestId('class-note-note:Dog:0')).toBeTruthy();
    const inspector = await inspectorFor('Animal');
    expect(within(inspector).getByRole('heading', { name: 'Class' })).toBeTruthy();
    expect(useCanvasSelectionStore.getState().items).toEqual([
      { id: 'Animal', label: 'Animal', kind: 'class' },
    ]);
  });

  it('renames a class and edits its members through the inspector', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('class-node-Animal');
    const inspector = await inspectorFor('Dog');
    const name = within(inspector).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Puppy{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('Animal <|-- Puppy'),
      'Renamed Dog → Puppy',
    );
    const renamed = await inspectorFor('Puppy');
    await user.click(within(renamed).getByRole('button', { name: 'Attribute' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('+String field'),
      'Added attribute to Puppy',
    );
    await user.click(within(renamed).getByRole('button', { name: 'Method' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('+method()'),
      'Added method to Puppy',
    );
  });

  it('toggles static and abstract, and reorders and removes members', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('class-node-Animal');
    const inspector = await inspectorFor('Animal');
    await user.click(within(inspector).getByRole('button', { name: 'Static attribute 1' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('+String name$'),
      'Edited attribute of Animal',
    );
    await user.click(within(inspector).getByRole('button', { name: 'Abstract method 1' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('+makeSound() void\n'),
      'Edited method of Animal',
    );
    await user.click(within(inspector).getByRole('button', { name: 'Method 1 actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.stringContaining('makeSound'),
      'Removed method from Animal',
    );
  });

  it('edits a relation: kind, label, multiplicities and reverse', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('class-node-Animal');
    const inspector = await inspectorFor('R:Animal:Dog:0');
    expect(within(inspector).getByRole('heading', { name: 'Relation' })).toBeTruthy();
    const label = within(inspector).getByLabelText('Label');
    await user.type(label, 'is a{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('Animal <|-- Dog : is a'),
      'Labelled relation Animal → Dog',
    );
    await user.type(within(inspector).getByLabelText('At Dog'), '0..*{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('Animal <|-- "0..*" Dog'),
      'Changed multiplicity of Animal → Dog',
    );
    await user.click(within(inspector).getByRole('button', { name: 'Reverse' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('Dog "0..*" --|> Animal'),
      'Reversed relation Animal → Dog',
    );
  });

  it('adds a class from the toolbar and renames it in place', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('class-node-Animal');
    await user.click(screen.getByRole('button', { name: 'Add interface' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('<<interface>>'),
      'Added interface Interface1',
    );
    const input = await screen.findByRole('textbox', { name: 'Class name' });
    await user.clear(input);
    await user.type(input, 'Pet{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('class Pet'),
      'Renamed Interface1 → Pet',
    );
  });

  it('groups classes in a namespace and deletes a note', async () => {
    const { onChange } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('class-node-Animal');
    act(() => {
      requestSelection('d1', ['Animal', 'Dog']);
    });
    const many = await screen.findByRole('region', { name: 'Inspector' });
    expect(within(many).getByRole('heading', { name: '2 items' })).toBeTruthy();
    await user.click(within(many).getByRole('button', { name: 'Group in namespace' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.stringContaining('namespace Namespace1'),
      'Grouped 2 items in a namespace',
    );
    expect(await screen.findByTestId('class-namespace-Namespace1')).toBeTruthy();
    const note = await inspectorFor('note:Dog:0');
    await user.click(within(note).getByRole('button', { name: 'Delete' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.not.stringContaining('Good boy'),
      'Deleted note',
    );
  });

  it('is read-only while Claude edits, and keeps the last canvas on a syntax error', async () => {
    const { rerender } = renderEditor({ readOnlyReason: CLAUDE_EDITING });
    await screen.findByTestId('class-node-Animal');
    expect(screen.getByRole('status').textContent).toBe(CLAUDE_EDITING);
    expect(screen.getByRole('button', { name: 'Add class' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    rerender({ readOnlyReason: null, code: `${CODE}    Animal <|--\n` });
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(SYNTAX_ERROR_REASON);
    });
    expect(screen.getByTestId('class-node-Dog')).toBeTruthy();
  });

  it('places classes from outside changes, and changes direction as one step', async () => {
    const { onChange, rerender } = renderEditor();
    const user = userEvent.setup();
    await screen.findByTestId('class-node-Animal');
    rerender({ code: `${CODE}    Dog --> Bone\n` });
    expect(await screen.findByTestId('class-node-Bone')).toBeTruthy();
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
