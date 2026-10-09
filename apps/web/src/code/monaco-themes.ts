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
  foreground: '#1B1B19',
  muted: '#5E5C57',
  faint: '#6F6D67',
  gutter: '#B4B1AA',
  accent: '#3451D1',
  accentWash: '#EEF1FD',
  success: '#1F7A52',
  warning: '#8A6A1C',
  destructive: '#B4362F',
  border: '#F0EEEA',
};

const DARK: EditorPalette = {
  panel: '#1A1A19',
  foreground: '#EDEDEB',
  muted: '#A8A6A0',
  faint: '#8E8C86',
  gutter: '#5E5C57',
  accent: '#9AAEFF',
  accentWash: '#1E2440',
  success: '#4CC38A',
  warning: '#E5C46B',
  destructive: '#F07A72',
  border: '#232321',
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
