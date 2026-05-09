import * as monaco from 'monaco-editor';
import { useProblemsStore } from '@/renderer/state/problems-store';
import type { ProblemEntry, ProblemSeverity } from '@/renderer/state/problems-store';

/**
 * Lightweight Monaco ↔ LSP bridge.
 *
 * The full `monaco-languageclient` + `@codingame/monaco-vscode-api` stack is heavy and pulls in a
 * compile-time dependency on @vscode/vscode. To keep the editor reactive without that footprint we
 * implement the subset of LSP that Monaco needs (initialize / didOpen / didChange / completions /
 * hover / definition / references / rename / publishDiagnostics) directly against the existing
 * IPC transport. The implementation is intentionally narrow: it speaks the spec verbatim so we can
 * swap in `monaco-languageclient` later without changing call sites.
 */

const LANGUAGES_TO_SERVERS: Record<string, string> = {
  typescript: 'typescript',
  javascript: 'typescript',
  typescriptreact: 'typescript',
  javascriptreact: 'typescript',
  python: 'python',
  rust: 'rust',
  go: 'go',
  lua: 'lua'
};

const PROVIDER_LANGUAGES: Record<string, string[]> = {
  typescript: ['typescript', 'javascript', 'typescriptreact', 'javascriptreact'],
  python: ['python'],
  rust: ['rust'],
  go: ['go'],
  lua: ['lua']
};

type LspSession = {
  id: string;
  serverLanguage: string;
  initialized: Promise<void>;
  initializedResolve: () => void;
  serverCapabilities: Record<string, unknown>;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

let unsubscribe: (() => void) | null = null;
const sessions = new Map<string, LspSession>();
const trackedModels = new WeakSet<monaco.editor.ITextModel>();
const documentVersions = new WeakMap<monaco.editor.ITextModel, number>();
const pending = new Map<number, Pending>();
const registeredProviderLanguages = new Set<string>();
let nextRequestId = 1;
let currentWorkspace: string | null = null;

function isElectronApiAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI?.lspStart);
}

function pathToUri(path: string): string {
  if (path.startsWith('file:')) return path;
  if (path.startsWith('virtual://')) {
    return `file://${path.replace(/^virtual:\/\//, '/virtual/')}`;
  }
  const normalized = path.replace(/\\/g, '/');
  return `file://${normalized.startsWith('/') ? normalized : `/${normalized}`}`;
}

function severity(severityCode: number | undefined): ProblemSeverity {
  switch (severityCode) {
    case 1:
      return 'error';
    case 2:
      return 'warning';
    case 3:
      return 'info';
    case 4:
      return 'hint';
    default:
      return 'info';
  }
}

function ensureGlobalListener(): void {
  if (unsubscribe || !isElectronApiAvailable()) {
    return;
  }
  unsubscribe = window.electronAPI.onLspMessage((payload) => {
    const message = payload.message as
      | {
          id?: number;
          method?: string;
          result?: unknown;
          error?: { message?: string; code?: number };
          params?: unknown;
        }
      | undefined;
    if (!message) return;

    if (typeof message.id === 'number' && (message.result !== undefined || message.error !== undefined)) {
      const handler = pending.get(message.id);
      if (handler) {
        pending.delete(message.id);
        if (message.error) {
          handler.reject(new Error(message.error.message ?? `LSP error ${message.error.code ?? ''}`));
        } else {
          handler.resolve(message.result);
        }
      }
      return;
    }

    if (message.method === 'textDocument/publishDiagnostics' && message.params) {
      forwardDiagnostics(message.params as PublishDiagnosticsParams);
    }
  });
}

type PublishDiagnosticsParams = {
  uri: string;
  diagnostics: Array<{
    range: { start: { line: number; character: number } };
    message: string;
    severity?: number;
    source?: string;
  }>;
};

function forwardDiagnostics(params: PublishDiagnosticsParams): void {
  const file = params.uri.startsWith('file:') ? decodeURIComponent(new URL(params.uri).pathname) : params.uri;
  const replaceForFile = useProblemsStore.getState().replaceForFile;
  const entries: ProblemEntry[] = (params.diagnostics ?? []).map((d, index) => ({
    id: `${file}:${d.range?.start?.line ?? 0}:${index}`,
    file,
    line: (d.range?.start?.line ?? 0) + 1,
    column: (d.range?.start?.character ?? 0) + 1,
    message: d.message ?? '',
    severity: severity(d.severity),
    source: d.source ?? 'lsp'
  }));
  replaceForFile(file, entries);
}

async function sendNotification(sessionId: string, method: string, params: unknown): Promise<void> {
  if (!isElectronApiAvailable()) return;
  await window.electronAPI.lspSend({
    sessionId,
    message: { jsonrpc: '2.0', method, params }
  });
}

function sendRequest<T>(sessionId: string, method: string, params: unknown): Promise<T> {
  if (!isElectronApiAvailable()) {
    return Promise.reject(new Error('Electron API unavailable'));
  }
  const id = nextRequestId++;
  const promise = new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
  });
  void window.electronAPI.lspSend({
    sessionId,
    message: { jsonrpc: '2.0', id, method, params }
  });
  return promise;
}

async function initializeSession(session: LspSession, workspacePath: string): Promise<void> {
  const result = (await sendRequest(session.id, 'initialize', {
    processId: null,
    rootUri: pathToUri(workspacePath),
    capabilities: {
      textDocument: {
        completion: { completionItem: { snippetSupport: false } },
        hover: { contentFormat: ['markdown', 'plaintext'] },
        definition: {},
        references: {},
        rename: { prepareSupport: false },
        publishDiagnostics: {}
      },
      workspace: { workspaceFolders: true }
    },
    workspaceFolders: [{ name: 'workspace', uri: pathToUri(workspacePath) }]
  })) as { capabilities?: Record<string, unknown> } | null;

  session.serverCapabilities = result?.capabilities ?? {};
  await sendNotification(session.id, 'initialized', {});
  session.initializedResolve();
}

async function ensureSession(monacoLanguage: string, workspacePath: string): Promise<LspSession | null> {
  const serverLanguage = LANGUAGES_TO_SERVERS[monacoLanguage];
  if (!serverLanguage) {
    return null;
  }

  const existing = sessions.get(serverLanguage);
  if (existing) {
    await existing.initialized;
    return existing;
  }

  if (!isElectronApiAvailable()) {
    return null;
  }

  ensureGlobalListener();

  const startResult = await window.electronAPI.lspStart({
    language: serverLanguage,
    workspacePath
  });
  if (!startResult.ok || !startResult.sessionId) {
    return null;
  }

  let initializedResolve!: () => void;
  const initialized = new Promise<void>((resolve) => {
    initializedResolve = resolve;
  });
  const session: LspSession = {
    id: startResult.sessionId,
    serverLanguage,
    initialized,
    initializedResolve,
    serverCapabilities: {}
  };
  sessions.set(serverLanguage, session);

  try {
    await initializeSession(session, workspacePath);
  } catch (err) {
    sessions.delete(serverLanguage);
    throw err;
  }

  return session;
}

function languageIdFor(modelLanguage: string): string {
  if (modelLanguage === 'javascriptreact') return 'javascriptreact';
  if (modelLanguage === 'typescriptreact') return 'typescriptreact';
  return modelLanguage;
}

async function trackModel(
  model: monaco.editor.ITextModel,
  languageId: string,
  session: LspSession
): Promise<void> {
  if (trackedModels.has(model)) {
    return;
  }
  trackedModels.add(model);
  documentVersions.set(model, 1);

  const uri = pathToUri(model.uri.path);
  await sendNotification(session.id, 'textDocument/didOpen', {
    textDocument: {
      uri,
      languageId,
      version: 1,
      text: model.getValue()
    }
  });

  model.onDidChangeContent(() => {
    const version = (documentVersions.get(model) ?? 1) + 1;
    documentVersions.set(model, version);
    void sendNotification(session.id, 'textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text: model.getValue() }]
    });
  });

  model.onWillDispose(() => {
    trackedModels.delete(model);
    void sendNotification(session.id, 'textDocument/didClose', {
      textDocument: { uri }
    });
  });
}

function registerProviders(monacoLanguage: string, getSession: () => LspSession | null): void {
  if (registeredProviderLanguages.has(monacoLanguage)) {
    return;
  }
  registeredProviderLanguages.add(monacoLanguage);

  monaco.languages.registerCompletionItemProvider(monacoLanguage, {
    triggerCharacters: ['.', '"', "'", '/', '@', '<', ' '],
    async provideCompletionItems(model, position) {
      const session = getSession();
      if (!session) return { suggestions: [] };
      try {
        const result = (await sendRequest(session.id, 'textDocument/completion', {
          textDocument: { uri: pathToUri(model.uri.path) },
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        })) as
          | {
              items?: Array<{
                label: string;
                kind?: number;
                detail?: string;
                documentation?: string | { value: string };
                insertText?: string;
                filterText?: string;
              }>;
            }
          | Array<{ label: string }>
          | null;

        const items = Array.isArray(result) ? result : (result?.items ?? []);
        const word = model.getWordUntilPosition(position);
        const range = new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn
        );
        return {
          suggestions: items.map((item) => {
            const lspItem = item as {
              label: string;
              detail?: string;
              insertText?: string;
              documentation?: string | { value: string };
            };
            const docu =
              typeof lspItem.documentation === 'string'
                ? lspItem.documentation
                : (lspItem.documentation?.value ?? '');
            return {
              label: lspItem.label,
              kind: monaco.languages.CompletionItemKind.Text,
              insertText: lspItem.insertText ?? lspItem.label,
              detail: lspItem.detail,
              documentation: docu,
              range
            } satisfies monaco.languages.CompletionItem;
          })
        };
      } catch {
        return { suggestions: [] };
      }
    }
  });

  monaco.languages.registerHoverProvider(monacoLanguage, {
    async provideHover(model, position) {
      const session = getSession();
      if (!session) return null;
      try {
        const result = (await sendRequest(session.id, 'textDocument/hover', {
          textDocument: { uri: pathToUri(model.uri.path) },
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        })) as { contents?: unknown } | null;
        if (!result?.contents) return null;
        const contents = normalizeHoverContents(result.contents);
        return { contents };
      } catch {
        return null;
      }
    }
  });

  monaco.languages.registerDefinitionProvider(monacoLanguage, {
    async provideDefinition(model, position) {
      const session = getSession();
      if (!session) return null;
      try {
        const result = (await sendRequest(session.id, 'textDocument/definition', {
          textDocument: { uri: pathToUri(model.uri.path) },
          position: { line: position.lineNumber - 1, character: position.column - 1 }
        })) as Array<{ uri: string; range: LspRange }> | { uri: string; range: LspRange } | null;

        if (!result) return null;
        const list = Array.isArray(result) ? result : [result];
        return list.map((entry) => ({
          uri: monaco.Uri.parse(entry.uri),
          range: lspRangeToMonaco(entry.range)
        }));
      } catch {
        return null;
      }
    }
  });

  monaco.languages.registerReferenceProvider(monacoLanguage, {
    async provideReferences(model, position) {
      const session = getSession();
      if (!session) return null;
      try {
        const result = (await sendRequest(session.id, 'textDocument/references', {
          textDocument: { uri: pathToUri(model.uri.path) },
          position: { line: position.lineNumber - 1, character: position.column - 1 },
          context: { includeDeclaration: true }
        })) as Array<{ uri: string; range: LspRange }> | null;
        return (result ?? []).map((entry) => ({
          uri: monaco.Uri.parse(entry.uri),
          range: lspRangeToMonaco(entry.range)
        }));
      } catch {
        return null;
      }
    }
  });

  monaco.languages.registerRenameProvider(monacoLanguage, {
    async provideRenameEdits(model, position, newName) {
      const session = getSession();
      if (!session) return null;
      try {
        const result = (await sendRequest(session.id, 'textDocument/rename', {
          textDocument: { uri: pathToUri(model.uri.path) },
          position: { line: position.lineNumber - 1, character: position.column - 1 },
          newName
        })) as { changes?: Record<string, Array<{ range: LspRange; newText: string }>> } | null;
        if (!result?.changes) {
          return { edits: [] };
        }
        const edits: monaco.languages.IWorkspaceTextEdit[] = [];
        for (const [uri, changes] of Object.entries(result.changes)) {
          for (const change of changes) {
            edits.push({
              resource: monaco.Uri.parse(uri),
              textEdit: {
                range: lspRangeToMonaco(change.range),
                text: change.newText
              },
              versionId: undefined
            });
          }
        }
        return { edits };
      } catch {
        return null;
      }
    }
  });
}

type LspRange = { start: { line: number; character: number }; end: { line: number; character: number } };

function lspRangeToMonaco(range: LspRange): monaco.IRange {
  return {
    startLineNumber: range.start.line + 1,
    startColumn: range.start.character + 1,
    endLineNumber: range.end.line + 1,
    endColumn: range.end.character + 1
  };
}

function normalizeHoverContents(contents: unknown): monaco.IMarkdownString[] {
  if (typeof contents === 'string') {
    return [{ value: contents }];
  }
  if (Array.isArray(contents)) {
    return contents
      .map((entry) => {
        if (typeof entry === 'string') return { value: entry };
        if (entry && typeof entry === 'object' && 'value' in entry) {
          return { value: String((entry as { value: unknown }).value) };
        }
        return null;
      })
      .filter((entry): entry is monaco.IMarkdownString => entry !== null);
  }
  if (contents && typeof contents === 'object' && 'value' in contents) {
    return [{ value: String((contents as { value: unknown }).value) }];
  }
  return [];
}

/**
 * Attach the active editor model to a language server, spawning the server lazily on first use.
 * Safe to call repeatedly; sessions are cached per server-language.
 */
export async function attachActiveModel(
  model: monaco.editor.ITextModel,
  monacoLanguage: string,
  workspacePath: string
): Promise<void> {
  if (!LANGUAGES_TO_SERVERS[monacoLanguage]) {
    return;
  }
  currentWorkspace = workspacePath;

  // Register providers up-front for every language the server backs so navigation/completions
  // remain available across files even before the next attach call.
  const serverLanguage = LANGUAGES_TO_SERVERS[monacoLanguage];
  for (const lang of PROVIDER_LANGUAGES[serverLanguage] ?? [monacoLanguage]) {
    registerProviders(lang, () => sessions.get(serverLanguage) ?? null);
  }

  let session: LspSession | null = null;
  try {
    session = await ensureSession(monacoLanguage, workspacePath);
  } catch {
    session = null;
  }
  if (!session) {
    return;
  }

  await trackModel(model, languageIdFor(monacoLanguage), session);
}

export async function shutdownAllLspSessions(): Promise<void> {
  if (!isElectronApiAvailable()) return;
  const ids = [...sessions.values()].map((session) => session.id);
  sessions.clear();
  await Promise.all(ids.map((id) => window.electronAPI.lspStop(id)));
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

export function __resetLspMonacoClientForTests(): void {
  sessions.clear();
  pending.clear();
  registeredProviderLanguages.clear();
  unsubscribe?.();
  unsubscribe = null;
  currentWorkspace = null;
}

export function getCurrentWorkspaceForLsp(): string | null {
  return currentWorkspace;
}
