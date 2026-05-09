import { z } from 'zod';

export const PingResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  timestamp: z.number()
});

export const AppInfoSchema = z.object({
  version: z.string(),
  platform: z.string(),
  arch: z.string(),
  electron: z.string(),
  node: z.string(),
  chrome: z.string(),
  isPackaged: z.boolean(),
  userDataDir: z.string()
});

export const FileNodeSchema: z.ZodType<{
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: unknown[];
}> = z.lazy(() =>
  z.object({
    name: z.string(),
    path: z.string(),
    type: z.enum(['file', 'directory']),
    children: z.array(FileNodeSchema).optional()
  })
);

export const OperationResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional()
});

export const ReadFileResultSchema = z.object({
  content: z.string(),
  encoding: z.enum(['utf-8', 'binary']),
  size: z.number(),
  mtime: z.number()
});

export const RunTerminalPayloadSchema = z.object({
  command: z.string().min(1).max(8192),
  cwd: z.string().optional(),
  timeoutMs: z
    .number()
    .int()
    .min(0)
    .max(10 * 60_000)
    .optional()
});

export const RunTerminalResultSchema = z.object({
  ok: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number(),
  error: z.string().optional()
});

// PTY
export const TerminalCreatePayloadSchema = z.object({
  cwd: z.string().optional(),
  shell: z.string().optional(),
  cols: z.number().int().min(1).max(1000).optional(),
  rows: z.number().int().min(1).max(1000).optional(),
  env: z.record(z.string()).optional()
});

export const TerminalCreateResultSchema = z.object({
  ok: z.boolean(),
  id: z.string().optional(),
  pid: z.number().optional(),
  shell: z.string().optional(),
  error: z.string().optional()
});

export const TerminalWritePayloadSchema = z.object({
  id: z.string(),
  data: z.string()
});

export const TerminalResizePayloadSchema = z.object({
  id: z.string(),
  cols: z.number().int().min(1).max(1000),
  rows: z.number().int().min(1).max(1000)
});

export const TerminalDisposePayloadSchema = z.object({ id: z.string() });

export const TerminalDataEventSchema = z.object({ id: z.string(), chunk: z.string() });
export const TerminalExitEventSchema = z.object({
  id: z.string(),
  exitCode: z.number(),
  signal: z.number().nullable().optional()
});

// Workspace events
export const WorkspaceEventSchema = z.object({
  workspacePath: z.string(),
  kind: z.enum(['add', 'addDir', 'change', 'unlink', 'unlinkDir', 'ready', 'error']),
  path: z.string().optional(),
  error: z.string().optional()
});

export const WatchWorkspacePayloadSchema = z.object({ workspacePath: z.string() });

// Search
export const SearchInFilesPayloadSchema = z.object({
  workspacePath: z.string(),
  query: z.string().min(1).max(2048),
  includeGlobs: z.array(z.string()).optional(),
  excludeGlobs: z.array(z.string()).optional(),
  caseSensitive: z.boolean().optional(),
  isRegex: z.boolean().optional(),
  maxResults: z.number().int().min(1).max(50_000).optional()
});

export const SearchHitSchema = z.object({
  path: z.string(),
  line: z.number(),
  column: z.number(),
  preview: z.string()
});

export const SearchInFilesResultSchema = z.object({
  ok: z.boolean(),
  hits: z.array(SearchHitSchema),
  truncated: z.boolean(),
  error: z.string().optional()
});

// Git
export const GitFileStatusEntrySchema = z.object({ path: z.string(), code: z.string() });
export const GitStatusResultSchema = z.object({
  ok: z.boolean(),
  branch: z.string(),
  ahead: z.number().optional(),
  behind: z.number().optional(),
  entries: z.array(GitFileStatusEntrySchema),
  error: z.string().optional()
});

export const GitLogEntrySchema = z.object({
  hash: z.string(),
  abbreviated: z.string(),
  author: z.string(),
  email: z.string(),
  date: z.number(),
  subject: z.string(),
  body: z.string().optional()
});

export const GitLogPayloadSchema = z.object({
  workspacePath: z.string(),
  limit: z.number().int().min(1).max(2000).optional(),
  file: z.string().optional()
});

export const GitDiffPayloadSchema = z.object({
  workspacePath: z.string(),
  path: z.string().optional(),
  staged: z.boolean().optional()
});

export const GitStagePayloadSchema = z.object({
  workspacePath: z.string(),
  paths: z.array(z.string()).min(1)
});

export const GitCommitPayloadSchema = z.object({
  workspacePath: z.string(),
  message: z.string().min(1).max(8192),
  signoff: z.boolean().optional()
});

export const GitPushPayloadSchema = z.object({
  workspacePath: z.string(),
  remote: z.string().optional(),
  branch: z.string().optional(),
  force: z.boolean().optional()
});

export const GitPullPayloadSchema = z.object({
  workspacePath: z.string(),
  remote: z.string().optional(),
  branch: z.string().optional()
});

export const GitBranchListResultSchema = z.object({
  ok: z.boolean(),
  current: z.string(),
  all: z.array(z.object({ name: z.string(), remote: z.boolean(), commit: z.string().optional() })),
  error: z.string().optional()
});

export const GitBranchCreatePayloadSchema = z.object({
  workspacePath: z.string(),
  name: z.string().min(1),
  checkout: z.boolean().optional()
});

export const GitBranchCheckoutPayloadSchema = z.object({
  workspacePath: z.string(),
  name: z.string().min(1)
});

export const GitBlamePayloadSchema = z.object({ workspacePath: z.string(), path: z.string() });

// Browser
export const AnalyzeUrlPayloadSchema = z.object({ url: z.string().url() });

// Secrets
export const SecretSetPayloadSchema = z.object({
  key: z.string().min(1).max(256),
  value: z.string().max(64 * 1024)
});
export const SecretGetPayloadSchema = z.object({ key: z.string().min(1).max(256) });
export const SecretsSetMasterPayloadSchema = z.object({ passphrase: z.string().min(8).max(1024) });
export const SecretsUnlockPayloadSchema = z.object({ passphrase: z.string().min(8).max(1024) });

// Scaffolders
export const ScaffoldFullstackPayloadSchema = z.object({
  targetRoot: z.string(),
  projectName: z.string().min(1),
  backend: z.enum(['express', 'fastapi']),
  database: z.enum(['prisma', 'supabase', 'both']),
  overwrite: z.boolean().optional(),
  generatedArtifacts: z
    .object({
      openApiJson: z.string().optional(),
      prismaSchema: z.string().optional(),
      supabaseSql: z.string().optional()
    })
    .optional()
});

export const ExportCanvasNodeSchema = z.object({
  id: z.string(),
  componentType: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  props: z
    .object({
      text: z.string().optional(),
      src: z.string().optional(),
      className: z.string().optional(),
      backgroundColor: z.string().optional(),
      padding: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional()
    })
    .partial()
});

export const ExportCanvasPayloadSchema = z.object({
  targetRoot: z.string(),
  projectName: z.string().min(1),
  target: z.enum(['react', 'nextjs', 'flutter', 'react-native']),
  nodes: z.array(ExportCanvasNodeSchema),
  overwrite: z.boolean().optional()
});

// Plugins
export const PluginPermissionSchema = z.enum([
  'workspace.read',
  'workspace.write',
  'commands',
  'canvas.read',
  'canvas.write',
  'terminal.run',
  'network',
  'secrets',
  'node'
]);

export const PluginManifestRawSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/i, 'Plugin id must be alphanumeric with dashes'),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().default(''),
  author: z.string().default(''),
  main: z.string().min(1),
  publisher: z.string().optional(),
  publisherKey: z.string().optional(),
  signature: z.string().optional(),
  engines: z.object({ aetherforge: z.string().optional(), node: z.string().optional() }).optional(),
  permissions: z.array(PluginPermissionSchema).optional(),
  contributes: z
    .object({
      commands: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            keybinding: z.string().optional(),
            category: z.string().optional()
          })
        )
        .optional(),
      views: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            location: z.enum(['main', 'right', 'sidebar']).optional()
          })
        )
        .optional(),
      languages: z
        .array(
          z.object({
            id: z.string(),
            aliases: z.array(z.string()).optional(),
            extensions: z.array(z.string()).optional()
          })
        )
        .optional(),
      menus: z
        .record(
          z.array(
            z.object({ command: z.string(), when: z.string().optional(), group: z.string().optional() })
          )
        )
        .optional(),
      keybindings: z
        .array(z.object({ key: z.string(), command: z.string(), when: z.string().optional() }))
        .optional(),
      settings: z
        .record(
          z.object({ type: z.string(), default: z.unknown().optional(), description: z.string().optional() })
        )
        .optional(),
      snippets: z.array(z.object({ language: z.string(), path: z.string() })).optional(),
      themes: z
        .array(
          z.object({
            id: z.string(),
            label: z.string(),
            uiTheme: z.enum(['vs', 'vs-dark', 'hc-black']),
            path: z.string()
          })
        )
        .optional()
    })
    .optional(),
  activationEvents: z.array(z.string()).optional()
});

export const PluginInstallPayloadSchema = z.object({ sourcePath: z.string() });
export const PluginInstallFromUrlPayloadSchema = z.object({
  url: z.string().url(),
  expectedSignature: z.string().optional()
});
export const PluginUninstallPayloadSchema = z.object({ id: z.string() });
export const ExtHostRunBundlePayloadSchema = z.object({
  pluginId: z.string().min(1),
  bundlePath: z.string().min(1)
});
export const ExtHostStopPayloadSchema = z.object({ pluginId: z.string().min(1) });

// FS
export const WriteFilePayloadSchema = z.object({
  path: z.string().min(1),
  content: z.string()
});
export const CreateFilePayloadSchema = z.object({
  directoryPath: z.string().min(1),
  fileName: z.string().min(1).max(255)
});
export const CreateFolderPayloadSchema = z.object({
  directoryPath: z.string().min(1),
  folderName: z.string().min(1).max(255)
});
export const RenamePathPayloadSchema = z.object({
  targetPath: z.string().min(1),
  newName: z.string().min(1).max(255)
});
export const MovePathPayloadSchema = z.object({
  sourcePath: z.string().min(1),
  destinationPath: z.string().min(1)
});
export const DeletePathPayloadSchema = z.object({ targetPath: z.string().min(1) });

// Updates
export const UpdateInfoSchema = z.object({
  version: z.string(),
  releaseNotes: z.string().optional(),
  releaseDate: z.string().optional(),
  channel: z.enum(['stable', 'beta', 'nightly']).optional()
});

// Preview
export const PreviewStartPayloadSchema = z.object({
  workspacePath: z.string(),
  mode: z.enum(['vite', 'static']).optional()
});
export const PreviewBoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative()
});
export const PreviewAttachViewPayloadSchema = z.object({
  url: z.string().url(),
  bounds: PreviewBoundsSchema
});
export const PreviewSetBoundsPayloadSchema = z.object({
  bounds: PreviewBoundsSchema
});

// DB
export const DbExecutePayloadSchema = z.object({
  sql: z
    .string()
    .min(1)
    .max(64 * 1024),
  params: z.array(z.unknown()).optional()
});

// LSP
export const LspStartPayloadSchema = z.object({
  language: z.string().min(1).max(64),
  workspacePath: z.string()
});
export const LspMessagePayloadSchema = z
  .object({
    sessionId: z.string(),
    message: z.any()
  })
  .transform((v) => ({ sessionId: v.sessionId, message: v.message as unknown }));

// DAP
export const DapLaunchPayloadSchema = z.object({
  workspacePath: z.string(),
  type: z.string(),
  request: z.enum(['launch', 'attach']),
  configuration: z.record(z.unknown())
});

// Telemetry
export const TelemetryEventPayloadSchema = z.object({
  name: z.string().min(1).max(128),
  properties: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
});

export type ZodSchemaFor<T> = z.ZodType<T>;
