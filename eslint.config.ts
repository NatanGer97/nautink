import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import local from './tools/eslint-plugin-local/index.ts';

const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];
const TEST_FILES = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/tests/**',
];
// Browser code: the web app and every package that renders React or touches the DOM.
const BROWSER_FILES = [
  '**/apps/web/**/*.{ts,tsx}',
  '**/packages/ui/**/*.{ts,tsx}',
  '**/packages/visual-core/**/*.{ts,tsx}',
  '**/packages/editors/**/*.{ts,tsx}',
  '**/packages/storage/**/*.{ts,tsx}',
];
// Stock shadcn/ui files, added by its CLI and kept identical to the registry so `shadcn add --diff`
// stays readable. The repo's code-style rules do not apply to them.
const VENDORED_UI_FILES = [
  '**/packages/ui/src/components/**/*.{ts,tsx}',
  '**/packages/ui/src/hooks/**/*.{ts,tsx}',
  '**/packages/ui/src/lib/utils.ts',
];
const CONFIG_FILES = [
  '**/*.config.{js,ts,mjs,mts}',
  'eslint.config.ts',
  'vitest.shared.config.ts',
  'scripts/**',
  'tools/eslint-plugin-local/**',
  '.claude/hooks/**',
];

// Shared with the per-file override below, which only adds an exception to it.
const NAMING_CONVENTION = [
  { selector: 'default', format: ['camelCase'], leadingUnderscore: 'forbid' },
  {
    selector: 'variable',
    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
    leadingUnderscore: 'forbid',
  },
  { selector: 'parameter', format: ['camelCase'] },
  { selector: 'function', format: ['camelCase', 'PascalCase'] },
  { selector: 'typeLike', format: ['PascalCase'] },
  { selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
  { selector: 'objectLiteralProperty', format: null },
  { selector: 'typeProperty', format: ['camelCase'] },
  { selector: 'import', format: ['camelCase', 'PascalCase'] },
  {
    selector: ['variable', 'parameter', 'classProperty', 'typeProperty', 'accessor'],
    types: ['boolean'],
    format: ['PascalCase'],
    prefix: ['is', 'has', 'can', 'should', 'did', 'will', 'was', 'are'],
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/*.d.ts',
      // Deliberately-broken fixtures that prove the gates fire; see tools/lint-fixtures/README.md.
      'tools/lint-fixtures/**',
    ],
  },

  // ---------------------------------------------------------------- base (TS)
  js.configs.recommended,
  // Type-aware configs default to every JS file too; keep them on TypeScript only.
  ...[...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked].map(
    (config) => ({ ...config, files: TS_FILES }),
  ),
  {
    files: TS_FILES,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2022 },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'import-x': importX,
      unicorn,
      local,
    },
    settings: {
      'import-x/resolver': { typescript: true, node: true },
    },
    rules: {
      // -- naming ---------------------------------------------------------
      '@typescript-eslint/naming-convention': ['error', ...NAMING_CONVENTION],
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/catch-error-name': ['error', { name: 'err' }],
      'unicorn/no-abusive-eslint-disable': 'error',

      // -- types ----------------------------------------------------------
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'never' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': 'off', // interface for entities, type for unions: judgement, not lint
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: false,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/typedef': [
        'error',
        {
          arrayDestructuring: false,
          objectDestructuring: false,
          arrowParameter: false,
          memberVariableDeclaration: true,
          parameter: true,
          propertyDeclaration: true,
          variableDeclaration: true,
          variableDeclarationIgnoreFunction: true,
        },
      ],
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/no-inferrable-types': 'off', // the convention is explicit types everywhere, including locals

      // -- function shape -------------------------------------------------
      'max-lines-per-function': [
        'error',
        { max: 20, skipBlankLines: false, skipComments: true, IIFEs: true },
      ],
      'max-params': ['error', 3],
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      'local/no-blank-lines-in-function': 'error',
      'no-else-return': ['error', { allowElseIf: false }],

      // -- async ----------------------------------------------------------
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(then|catch)$/]",
          message: 'Use async/await, not .then()/.catch() chains.',
        },
        {
          selector: 'ConditionalExpression ConditionalExpression',
          message: 'Nested ternaries are banned. Extract a named boolean or use early returns.',
        },
      ],

      // -- conditions & data ----------------------------------------------
      'no-nested-ternary': 'error',
      'no-unneeded-ternary': 'error',
      'no-magic-numbers': 'off',
      '@typescript-eslint/no-magic-numbers': [
        'warn',
        {
          ignore: [-1, 0, 1],
          ignoreArrayIndexes: true,
          ignoreDefaultValues: true,
          ignoreEnums: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
          enforceConst: true,
        },
      ],
      'no-param-reassign': ['error', { props: true }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': ['error', 'always'],
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],

      // -- errors ---------------------------------------------------------
      '@typescript-eslint/only-throw-error': 'error',
      'no-useless-catch': 'error',
      'prefer-promise-reject-errors': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'error',

      // -- comments & debris ----------------------------------------------
      'no-console': 'error',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-warning-comments': ['warn', { terms: ['todo', 'fixme', 'xxx'], location: 'start' }],
      'no-inline-comments': 'warn',

      // -- imports & modules ----------------------------------------------
      'import-x/order': [
        'error',
        {
          groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index'], 'type'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import-x/no-cycle': 'error',
      'import-x/no-default-export': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-relative-packages': 'error',
      'local/no-barrel-file': 'error',
    },
  },

  // ------------------------------------------------- no JavaScript (ADR-001)
  // The repo is TypeScript only. Node runs the tooling scripts by stripping their types, so there is
  // no reason left for a .js file.
  {
    files: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Program',
          message: 'This repo is TypeScript only (ADR-001). Use .ts or .tsx.',
        },
      ],
    },
  },

  // ---------------------------------------------------------- browser + React
  {
    files: BROWSER_FILES,
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },

  // React components: markup reads badly when cut into 20-line pieces, so .tsx files get 60 lines
  // per function. Logic in .ts files keeps the full rule (ADR-001).
  {
    files: ['**/*.tsx'],
    rules: {
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: false, skipComments: true }],
    },
  },

  // Vendored shadcn/ui: kept as the CLI writes it, so only the accessibility rules apply.
  {
    files: VENDORED_UI_FILES,
    ...tseslint.configs.disableTypeChecked,
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/typedef': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      // shadcn passes CSS custom properties as `{ '--x': … } as React.CSSProperties`.
      '@typescript-eslint/consistent-type-assertions': 'off',
      'max-lines-per-function': 'off',
      'max-params': 'off',
      complexity: 'off',
      'local/no-blank-lines-in-function': 'off',
      'local/no-barrel-file': 'off',
      'import-x/no-default-export': 'off',
      'import-x/order': 'off',
      'no-restricted-syntax': 'off',
      'no-nested-ternary': 'off',
      'no-inline-comments': 'off',
      curly: 'off',
      'unicorn/filename-case': 'off',
    },
  },

  // @nautink/storage keeps v1's boolean record fields so v1 backups import unchanged (PRD §7.3, §8).
  // Only these four names, only in the file that declares the records, skip the boolean prefix.
  {
    files: ['packages/storage/src/records.ts'],
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'typeProperty',
          filter: { regex: '^(pinned|titleAuto|auto|streaming)$', match: true },
          format: ['camelCase'],
        },
        ...NAMING_CONVENTION,
      ],
    },
  },

  // ------------------------------------------------------------------ tests
  {
    files: TEST_FILES,
    rules: {
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/typedef': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'local/no-blank-lines-in-function': 'off',
      'no-restricted-syntax': 'off',
    },
  },

  // -------------------------------------------------------- config & tooling
  {
    files: CONFIG_FILES,
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: false },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      'import-x/no-default-export': 'off',
      'no-console': 'off',
      '@typescript-eslint/typedef': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'max-lines-per-function': 'off',
      'local/no-blank-lines-in-function': 'off',
      'unicorn/filename-case': 'off',
      // ESLint rule visitors are named after AST node types (`ExportAllDeclaration`).
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      'no-inline-comments': 'off',
      // Package configs import the shared root config by relative path; this rule's autofix would
      // turn that into an unresolvable package import.
      'import-x/no-relative-packages': 'off',
    },
  },

  // ------------------------------------------------------ lint fixtures only
  {
    files: ['tools/lint-fixtures/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: false, ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      'unicorn/filename-case': 'off',
      'no-inline-comments': 'off',
      'no-warning-comments': 'off',
    },
  },

  prettierConfig,
);
