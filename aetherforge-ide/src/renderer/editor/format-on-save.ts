import prettier from 'prettier/standalone';
import parserBabel from 'prettier/plugins/babel';
import parserEstree from 'prettier/plugins/estree';
import parserHtml from 'prettier/plugins/html';
import parserCss from 'prettier/plugins/postcss';
import parserMarkdown from 'prettier/plugins/markdown';
import parserTypescript from 'prettier/plugins/typescript';

const plugins = [parserBabel, parserEstree, parserHtml, parserCss, parserMarkdown, parserTypescript];

const PRETTIER_PARSER: Record<string, string> = {
  javascript: 'babel',
  typescript: 'typescript',
  javascriptreact: 'babel',
  typescriptreact: 'typescript',
  html: 'html',
  vue: 'html',
  css: 'css',
  scss: 'scss',
  less: 'less',
  markdown: 'markdown'
};

export type FormatOptions = {
  usePrettier?: boolean;
  tabWidth?: number;
  useTabs?: boolean;
  printWidth?: number;
  trimTrailingWhitespace?: boolean;
  insertFinalNewline?: boolean;
};

export async function formatBuffer(
  language: string,
  source: string,
  options: FormatOptions = {}
): Promise<string> {
  let next = source;

  if (options.usePrettier) {
    const parser = PRETTIER_PARSER[language.toLowerCase()] ?? null;
    if (parser) {
      try {
        next = await prettier.format(source, {
          parser,
          plugins,
          tabWidth: options.tabWidth ?? 2,
          useTabs: options.useTabs ?? false,
          printWidth: options.printWidth ?? 110,
          singleQuote: true,
          trailingComma: 'none',
          semi: true,
          endOfLine: 'lf'
        });
      } catch {
        // keep original on parse failure
      }
    }
  }

  if (options.trimTrailingWhitespace) {
    next = next.replace(/[ \t]+$/gm, '');
  }
  if (options.insertFinalNewline && !next.endsWith('\n')) {
    next = `${next}\n`;
  }
  return next;
}
