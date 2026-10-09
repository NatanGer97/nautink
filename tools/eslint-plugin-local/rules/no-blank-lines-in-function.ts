/**
 * Convention: a function body has no blank lines. A function that needs visual
 * sections is a function that needs extraction.
 */
import type { Rule } from 'eslint';
import type { ArrowFunctionExpression, FunctionDeclaration, FunctionExpression } from 'estree';

type Range = [number, number];
type FunctionNode = FunctionDeclaration | FunctionExpression | ArrowFunctionExpression;

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    fixable: 'whitespace',
    docs: {
      description: 'Ban blank lines inside a function body.',
    },
    schema: [],
    messages: {
      blankLine:
        'Blank line inside a function body. Extract a named helper instead of grouping statements visually.',
    },
  },
  create(context: Rule.RuleContext): Rule.RuleListener {
    const sourceCode = context.sourceCode;
    const reported = new Set<number>();

    /** Ranges where a blank line is part of a literal or a comment, not layout. */
    function protectedRanges(): Range[] {
      const ranges: Range[] = sourceCode
        .getAllComments()
        .flatMap((comment) => (comment.range === undefined ? [] : [comment.range]));
      return ranges;
    }

    /** True when the line index sits inside one of the protected ranges. */
    function isProtected(lineNumber: number, ranges: Range[], templateRanges: Range[]): boolean {
      const check = (range: Range): boolean => {
        const start = sourceCode.getLocFromIndex(range[0]).line;
        const end = sourceCode.getLocFromIndex(range[1]).line;
        return lineNumber > start && lineNumber < end;
      };
      return ranges.some(check) || templateRanges.some(check);
    }

    const templateRanges: Range[] = [];
    const comments = protectedRanges();

    /** Report every blank line between the braces of the body. */
    function checkBody(node: FunctionNode): void {
      const body = node.body;
      if (body.type !== 'BlockStatement' || body.range === undefined) {
        return;
      }
      const firstLine = sourceCode.getLocFromIndex(body.range[0]).line;
      const lastLine = sourceCode.getLocFromIndex(body.range[1]).line;
      for (let line = firstLine + 1; line < lastLine; line += 1) {
        const text: string = sourceCode.lines[line - 1] ?? '';
        if (text.trim() !== '' || reported.has(line)) {
          continue;
        }
        if (isProtected(line, comments, templateRanges)) {
          continue;
        }
        reported.add(line);
        const start = sourceCode.getIndexFromLoc({ line, column: 0 });
        context.report({
          loc: { start: { line, column: 0 }, end: { line, column: text.length } },
          messageId: 'blankLine',
          fix: (fixer) => fixer.removeRange([start, start + text.length + 1]),
        });
      }
    }

    return {
      TemplateLiteral(node): void {
        if (node.range !== undefined) {
          templateRanges.push(node.range);
        }
      },
      'FunctionDeclaration:exit': checkBody,
      'FunctionExpression:exit': checkBody,
      'ArrowFunctionExpression:exit': checkBody,
    };
  },
};

export default rule;
