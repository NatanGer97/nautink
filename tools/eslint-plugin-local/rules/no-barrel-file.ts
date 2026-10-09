/**
 * Convention: no barrel files. Import from the module that owns the symbol so the
 * dependency graph stays honest (and tree-shaking stays predictable).
 */
import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ban re-export barrels (export * / index.ts re-exports).',
    },
    schema: [],
    messages: {
      barrel: 'Barrel re-export is banned. Import from the module that defines the symbol.',
    },
  },
  create(context: Rule.RuleContext): Rule.RuleListener {
    const filename = context.filename.replaceAll('\\', '/');
    const isIndexFile = /\/index\.(?:ts|tsx|js|jsx|mts|cts)$/.test(filename);

    return {
      ExportAllDeclaration(node): void {
        context.report({ node, messageId: 'barrel' });
      },
      ExportNamedDeclaration(node): void {
        if (node.source !== null && node.source !== undefined && isIndexFile) {
          context.report({ node, messageId: 'barrel' });
        }
      },
    };
  },
};

export default rule;
