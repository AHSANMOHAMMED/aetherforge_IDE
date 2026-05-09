export type CatalogEntry = {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
  downloads: number;
  bundled: boolean; // if true, already in extensions/installed/
  contributes: {
    commands?: string[];
    languages?: string[];
  };
};

export const CATALOG: CatalogEntry[] = [
  {
    id: 'word-count',
    name: 'Word Count',
    description: 'Counts the number of words in the currently open file and shows a toast notification.',
    author: 'AetherForge',
    version: '1.0.0',
    tags: ['utility', 'editor'],
    downloads: 1_240,
    bundled: true,
    contributes: { commands: ['word-count.count'] }
  },
  {
    id: 'hello-canvas',
    name: 'Hello Canvas',
    description:
      'Demonstrates the Canvas API by adding a "Hello from Plugin!" button node to the visual canvas.',
    author: 'AetherForge',
    version: '1.0.0',
    tags: ['canvas', 'demo'],
    downloads: 876,
    bundled: true,
    contributes: { commands: ['hello-canvas.addButton'] }
  },
  {
    id: 'prettier-format',
    name: 'Prettier Formatter',
    description: 'Auto-formats TypeScript, JavaScript, and JSON files using Prettier on save.',
    author: 'Community',
    version: '2.3.1',
    tags: ['formatter', 'typescript'],
    downloads: 15_430,
    bundled: false,
    contributes: { commands: ['prettier.formatDocument'] }
  },
  {
    id: 'git-lens',
    name: 'GitLens',
    description:
      'Supercharge your Git capabilities: inline blame annotations, commit history, and code authorship.',
    author: 'Community',
    version: '14.5.0',
    tags: ['git', 'vcs'],
    downloads: 42_000,
    bundled: false,
    contributes: { commands: ['gitlens.showBlame', 'gitlens.openCommit'] }
  },
  {
    id: 'tailwind-intellisense',
    name: 'Tailwind IntelliSense',
    description: 'Provides autocomplete, syntax highlighting, and linting for Tailwind CSS class names.',
    author: 'Community',
    version: '0.11.2',
    tags: ['css', 'tailwind'],
    downloads: 38_700,
    bundled: false,
    contributes: { languages: ['css', 'html', 'typescript'] }
  },
  {
    id: 'ai-docgen',
    name: 'AI Doc Generator',
    description:
      'Uses the AetherForge AI agent to automatically generate JSDoc comments for functions and classes.',
    author: 'Community',
    version: '1.1.0',
    tags: ['ai', 'documentation'],
    downloads: 7_820,
    bundled: false,
    contributes: { commands: ['ai-docgen.generateForFile', 'ai-docgen.generateForSelection'] }
  }
];
