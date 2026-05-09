import { loader } from '@monaco-editor/react';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

/**
 * Monaco workers configuration.
 *
 * Without this, monaco falls back to the editor worker for all languages,
 * making large TS files slow and breaking JSON/CSS/HTML smarts. We register
 * Vite-bundled workers and tell Monaco to use them.
 */

let initialized = false;

export function setupMonaco(): void {
  if (initialized) return;
  initialized = true;

  (
    self as unknown as { MonacoEnvironment: { getWorker: (workerId: string, label: string) => Worker } }
  ).MonacoEnvironment = {
    getWorker(_workerId, label) {
      if (label === 'json') return new JsonWorker();
      if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker();
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker();
      if (label === 'typescript' || label === 'javascript') return new TsWorker();
      return new EditorWorker();
    }
  };

  void loader.init().then((monaco) => {
    monaco.editor.defineTheme('aetherforge-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
        { token: 'keyword', foreground: '67e8f9' },
        { token: 'string', foreground: 'a5f3fc' },
        { token: 'number', foreground: 'f0abfc' }
      ],
      colors: {
        'editor.background': '#0b1220',
        'editor.foreground': '#e2e8f0',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#22d3ee',
        'editorCursor.foreground': '#22d3ee',
        'editor.selectionBackground': '#22d3ee30',
        'editor.lineHighlightBackground': '#0f1729',
        'editorWidget.background': '#0e1729',
        'editorWidget.border': '#1e293b',
        'editorIndentGuide.background1': '#1e293b'
      }
    });

    monaco.editor.defineTheme('aetherforge-light', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#f8fafc',
        'editorLineNumber.foreground': '#94a3b8',
        'editorLineNumber.activeForeground': '#0284c7'
      }
    });

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      esModuleInterop: true,
      strict: false,
      allowJs: true,
      lib: ['ESNext', 'DOM', 'DOM.Iterable']
    });

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    });
  });
}
