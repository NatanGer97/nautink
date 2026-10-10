import type { editor } from 'monaco-editor/editor/editor.api.js';

export const LIGHT_THEME: string = 'nautink-light';
export const DARK_THEME: string = 'nautink-dark';

/** The PRD §6.1 tokens the editor uses. Monaco needs literal colors; it cannot read CSS variables. */
interface EditorPalette {
  panel: string;
  foreground: string;
  muted: string;
  faint: string;
  gutter: string;
  accent: string;
  accentWash: string;
  success: string;
  warning: string;
  destructive: string;
  border: string;
}

const LIGHT: EditorPalette = {
  panel: '#FFFFFF',
  foreground: '#0E1F33',
  muted: '#4A5A6D',
  faint: '#5D6C7E',
  gutter: '#A9B6C3',
  accent: '#00727F',
  accentWash: '#E2F3F5',
  success: '#1F6630',
  warning: '#7A5C14',
  destructive: '#B4362F',
  border: '#EAF0F4',
};

const DARK: EditorPalette = {
  panel: '#0F1B2B',
  foreground: '#E8EEF6',
  muted: '#A3B1C2',
  faint: '#8796A9',
  gutter: '#4A5D74',
  accent: '#2FB6C4',
  accentWash: '#0D2B36',
  success: '#8EDB94',
  warning: '#E5C46B',
  destructive: '#F07A72',
  border: '#172638',
};

/** Monaco wants colors without the `#` in token rules. */
function bare(color: string): string {
  return color.slice(1);
}

function tokenRules(palette: EditorPalette): editor.ITokenThemeRule[] {
  return [
    { token: 'keyword.diagram', foreground: bare(palette.accent), fontStyle: 'bold' },
    { token: 'keyword', foreground: bare(palette.accent) },
    { token: 'operator', foreground: bare(palette.muted) },
    { token: 'string', foreground: bare(palette.success) },
    { token: 'comment', foreground: bare(palette.faint), fontStyle: 'italic' },
    { token: 'annotation', foreground: bare(palette.warning) },
    { token: 'number', foreground: bare(palette.warning) },
  ];
}

function editorColors(palette: EditorPalette): editor.IColors {
  return {
    'editor.background': palette.panel,
    'editor.foreground': palette.foreground,
    'editorGutter.background': palette.panel,
    'editorLineNumber.foreground': palette.gutter,
    'editorLineNumber.activeForeground': palette.accent,
    'editor.lineHighlightBackground': `${palette.accentWash}80`,
    'editor.lineHighlightBorder': '#00000000',
    'editor.selectionBackground': palette.accentWash,
    'editorCursor.foreground': palette.accent,
    'editorError.foreground': palette.destructive,
    'editorWidget.border': palette.border,
    focusBorder: '#00000000',
  };
}

function theme(base: editor.BuiltinTheme, palette: EditorPalette): editor.IStandaloneThemeData {
  return { base, inherit: true, rules: tokenRules(palette), colors: editorColors(palette) };
}

export const MONACO_THEMES: Readonly<Record<string, editor.IStandaloneThemeData>> = {
  [LIGHT_THEME]: theme('vs', LIGHT),
  [DARK_THEME]: theme('vs-dark', DARK),
};

/** The editor theme for the app's theme. */
export function monacoThemeName(isDark: boolean): string {
  return isDark ? DARK_THEME : LIGHT_THEME;
}
