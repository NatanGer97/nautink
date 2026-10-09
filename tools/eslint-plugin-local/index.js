import noBarrelFile from './rules/no-barrel-file.js';
import noBlankLinesInFunction from './rules/no-blank-lines-in-function.js';

/** Project-local ESLint rules that no off-the-shelf plugin covers. */
const plugin = {
  meta: { name: 'eslint-plugin-local', version: '0.0.0' },
  rules: {
    'no-barrel-file': noBarrelFile,
    'no-blank-lines-in-function': noBlankLinesInFunction,
  },
};

export default plugin;
