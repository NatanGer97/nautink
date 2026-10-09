/**
 * Convention: no barrel files. Import from the module that owns the symbol so the
 * dependency graph stays honest (and tree-shaking stays predictable).
 */
export default {
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
  create(context) {
    const filename = context.filename.replaceAll('\\', '/');
    const isIndexFile = /\/index\.(?:ts|tsx|js|jsx|mts|cts)$/.test(filename);

    return {
      ExportAllDeclaration(node) {
        context.report({ node, messageId: 'barrel' });
      },
      ExportNamedDeclaration(node) {
        if (node.source !== null && node.source !== undefined && isIndexFile) {
          context.report({ node, messageId: 'barrel' });
        }
      },
    };
  },
};
