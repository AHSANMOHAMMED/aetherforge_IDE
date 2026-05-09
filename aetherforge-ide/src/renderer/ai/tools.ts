import { useAppStore } from '@/renderer/state/app-store';
import { generateCanvasCode, CANVAS_VIRTUAL_NAME, CANVAS_VIRTUAL_PATH } from '@/renderer/canvas/sync';
import { useCanvasStore } from '@/renderer/canvas/store';
import type { CanvasSerializableNode } from '@/renderer/canvas/types';
import { useApiStore } from '@/renderer/backend/api/store';
import {
  API_OPENAPI_VIRTUAL_NAME,
  API_OPENAPI_VIRTUAL_PATH,
  API_VIRTUAL_NAME,
  API_VIRTUAL_PATH,
  generateApiCode,
  generateOpenApi
} from '@/renderer/backend/api/sync';
import type { APISerializableNode } from '@/renderer/backend/api/types';
import { useDbStore } from '@/renderer/backend/db/store';
import {
  DB_PRISMA_VIRTUAL_NAME,
  DB_PRISMA_VIRTUAL_PATH,
  DB_SUPABASE_VIRTUAL_NAME,
  DB_SUPABASE_VIRTUAL_PATH,
  generatePrismaSchema,
  generateSupabaseSql
} from '@/renderer/backend/db/sync';
import type { DBSerializableEdge, DBSerializableNode } from '@/renderer/backend/db/types';
import { useModalStore } from '@/renderer/state/modal-store';
import { formatBriefFileDiff } from './text-diff';
import { formatBackendErrorEnvelope } from '@/renderer/backend/error-envelope';
import { useAIStore } from './store';
import type { AgentToolCall, AgentToolResult, GuardedToolName } from './types';

function stringifyUnknown(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function parseCanvasNodes(value: unknown): CanvasSerializableNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const candidate = item as Record<string, unknown>;
      if (
        typeof candidate.id !== 'string' ||
        typeof candidate.label !== 'string' ||
        typeof candidate.componentType !== 'string' ||
        typeof candidate.x !== 'number' ||
        typeof candidate.y !== 'number'
      ) {
        return null;
      }

      return {
        id: candidate.id,
        label: candidate.label,
        componentType: candidate.componentType as CanvasSerializableNode['componentType'],
        x: candidate.x,
        y: candidate.y,
        props: (candidate.props ?? {}) as CanvasSerializableNode['props']
      };
    })
    .filter((item): item is CanvasSerializableNode => item !== null);
}

function parseApiNodes(value: unknown): APISerializableNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const candidate = item as Record<string, unknown>;
      if (
        typeof candidate.id !== 'string' ||
        typeof candidate.label !== 'string' ||
        typeof candidate.componentType !== 'string' ||
        typeof candidate.x !== 'number' ||
        typeof candidate.y !== 'number'
      ) {
        return null;
      }

      return {
        id: candidate.id,
        label: candidate.label,
        componentType: candidate.componentType as APISerializableNode['componentType'],
        x: candidate.x,
        y: candidate.y,
        props: (candidate.props ?? {}) as APISerializableNode['props']
      };
    })
    .filter((item): item is APISerializableNode => item !== null);
}

function parseDbNodes(value: unknown): DBSerializableNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const candidate = item as Record<string, unknown>;
      if (
        typeof candidate.id !== 'string' ||
        typeof candidate.label !== 'string' ||
        typeof candidate.componentType !== 'string' ||
        typeof candidate.x !== 'number' ||
        typeof candidate.y !== 'number'
      ) {
        return null;
      }

      return {
        id: candidate.id,
        label: candidate.label,
        componentType: candidate.componentType as DBSerializableNode['componentType'],
        x: candidate.x,
        y: candidate.y,
        props: (candidate.props ?? {}) as DBSerializableNode['props']
      };
    })
    .filter((item): item is DBSerializableNode => item !== null);
}

function parseDbEdges(value: unknown): DBSerializableEdge[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: Array<DBSerializableEdge | null> = value.map((item) => {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.source !== 'string' ||
      typeof candidate.target !== 'string'
    ) {
      return null;
    }

    const cardinality =
      candidate.cardinality === 'one-to-one' || candidate.cardinality === 'one-to-many'
        ? candidate.cardinality
        : undefined;

    const action = (valueToCheck: unknown): DBSerializableEdge['onDelete'] | undefined => {
      if (
        valueToCheck === 'Cascade' ||
        valueToCheck === 'Restrict' ||
        valueToCheck === 'NoAction' ||
        valueToCheck === 'SetNull' ||
        valueToCheck === 'SetDefault'
      ) {
        return valueToCheck;
      }
      return undefined;
    };

    return {
      id: candidate.id,
      source: candidate.source,
      target: candidate.target,
      relationName: typeof candidate.relationName === 'string' ? candidate.relationName : undefined,
      sourceField: typeof candidate.sourceField === 'string' ? candidate.sourceField : undefined,
      targetField: typeof candidate.targetField === 'string' ? candidate.targetField : undefined,
      cardinality,
      required: typeof candidate.required === 'boolean' ? candidate.required : undefined,
      onDelete: action(candidate.onDelete),
      onUpdate: action(candidate.onUpdate)
    };
  });

  return parsed.filter((item): item is DBSerializableEdge => item !== null);
}

function buildCanvasFromAnalysis(title: string, summary: string): CanvasSerializableNode[] {
  const summaryLines = summary
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);

  const heading = summaryLines[0] ?? 'UI Analysis';
  const cta = summaryLines.find((line) => line.toLowerCase().includes('button')) ?? 'Primary action';

  return [
    {
      id: `text-${Date.now()}-1`,
      componentType: 'text',
      label: title || 'Replicated UI',
      x: 120,
      y: 80,
      props: {
        text: title || 'Replicated UI',
        className: 'text-2xl font-semibold text-slate-100'
      }
    },
    {
      id: `card-${Date.now()}-2`,
      componentType: 'card',
      label: heading,
      x: 120,
      y: 160,
      props: {
        text: heading,
        className: 'rounded-lg border border-slate-500/30 bg-slate-900/90 p-4',
        width: 420,
        height: 180
      }
    },
    {
      id: `button-${Date.now()}-3`,
      componentType: 'button',
      label: 'Call to Action',
      x: 140,
      y: 370,
      props: {
        text: cta,
        className: 'rounded-md bg-cyan-500 px-4 py-2 text-white'
      }
    }
  ];
}

function countByType(nodes: CanvasSerializableNode[]): Record<string, number> {
  return nodes.reduce<Record<string, number>>((accumulator, node) => {
    accumulator[node.componentType] = (accumulator[node.componentType] ?? 0) + 1;
    return accumulator;
  }, {});
}

function formatTypeCounts(nodes: CanvasSerializableNode[]): string {
  const counts = countByType(nodes);
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return 'none';
  }

  return entries
    .map(([componentType, count]) => `${componentType}:${count}`)
    .sort((left, right) => left.localeCompare(right))
    .join(', ');
}

async function requestCanvasDiffApproval(
  source: 'analyze_url_replicate_ui' | 'apply_canvas_layout',
  contextLine: string,
  proposedNodes: CanvasSerializableNode[]
): Promise<boolean> {
  const currentNodes = useCanvasStore.getState().nodes.map((node) => ({
    id: node.id,
    componentType: node.data.componentType,
    label: node.data.label,
    x: node.position.x,
    y: node.position.y,
    props: node.data.props
  }));

  const description = [
    contextLine,
    '',
    'Canvas Diff Preview',
    `Current nodes: ${currentNodes.length} (${formatTypeCounts(currentNodes)})`,
    `Proposed nodes: ${proposedNodes.length} (${formatTypeCounts(proposedNodes)})`,
    '',
    'Applying this change will replace the current visual canvas node set.'
  ].join('\n');

  return useModalStore.getState().requestConfirm({
    title:
      source === 'analyze_url_replicate_ui'
        ? 'Apply URL replication to canvas?'
        : 'Apply proposed canvas layout?',
    description,
    confirmLabel: 'Apply Changes'
  });
}

function languageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'sql':
      return 'sql';
    case 'yml':
    case 'yaml':
      return 'yaml';
    default:
      return 'plaintext';
  }
}

async function requestWriteFileApproval(path: string, existing: string, content: string): Promise<boolean> {
  const { toolPolicies, sessionToolGrants, grantSessionTool, logToolPermissionDecision } =
    useAIStore.getState();
  const policy = toolPolicies.write_file;
  const briefSummary = `Write file: ${path} (${content.length} chars)`;

  if (policy === 'allow-always') {
    logToolPermissionDecision('write_file', policy, 'allow-auto', briefSummary);
    return true;
  }

  if (policy === 'allow-session' && sessionToolGrants.write_file) {
    logToolPermissionDecision('write_file', policy, 'allow-auto', briefSummary);
    return true;
  }

  // Surface the diff in a Monaco DiffEditor for full review before applying.
  const approved = await useModalStore.getState().requestDiffConfirm({
    title: existing ? 'Apply patch?' : 'Create new file?',
    description: existing
      ? `Policy: ${policy}. Review the unified diff below before approving.`
      : `Policy: ${policy}. New file will be created with the contents shown.`,
    path,
    language: languageFromPath(path),
    beforeText: existing,
    afterText: content,
    confirmLabel: 'Apply'
  });

  if (approved && policy === 'allow-session') {
    grantSessionTool('write_file');
  }

  const summary = [briefSummary, '', '--- Diff preview ---', formatBriefFileDiff(existing, content)].join(
    '\n'
  );
  logToolPermissionDecision('write_file', policy, approved ? 'allow-prompt' : 'deny-prompt', summary);

  return approved;
}

async function requestToolPermission(tool: GuardedToolName, summary: string): Promise<boolean> {
  const { toolPolicies, sessionToolGrants, grantSessionTool, logToolPermissionDecision } =
    useAIStore.getState();
  const policy = toolPolicies[tool];

  if (policy === 'allow-always') {
    logToolPermissionDecision(tool, policy, 'allow-auto', summary);
    return true;
  }

  if (policy === 'allow-session' && sessionToolGrants[tool]) {
    logToolPermissionDecision(tool, policy, 'allow-auto', summary);
    return true;
  }

  const approved = await useModalStore.getState().requestConfirm({
    title: `Allow tool: ${tool}?`,
    description: [
      `Policy: ${policy}`,
      '',
      summary,
      '',
      policy === 'allow-session'
        ? 'If approved, this tool will be allowed for the rest of this app session.'
        : 'This tool requires approval for each execution.'
    ].join('\n'),
    confirmLabel: 'Allow'
  });

  if (approved && policy === 'allow-session') {
    grantSessionTool(tool);
  }

  logToolPermissionDecision(tool, policy, approved ? 'allow-prompt' : 'deny-prompt', summary);

  return approved;
}

export async function executeAgentTool(call: AgentToolCall, signal: AbortSignal): Promise<AgentToolResult> {
  if (signal.aborted) {
    throw new DOMException('Canceled', 'AbortError');
  }

  if (call.tool === 'read_file') {
    const path = String(call.input.path ?? '');
    if (!path) {
      return { tool: call.tool, ok: false, output: 'Missing input.path' };
    }

    const result = await window.electronAPI.readFile(path);
    return {
      tool: call.tool,
      ok: true,
      output: result.content.slice(0, 12000)
    };
  }

  if (call.tool === 'write_file') {
    const path = String(call.input.path ?? '');
    const content = String(call.input.content ?? '');
    if (!path) {
      return { tool: call.tool, ok: false, output: 'Missing input.path' };
    }

    let existing = '';
    try {
      const readResult = await window.electronAPI.readFile(path);
      existing = readResult.content ?? '';
    } catch {
      existing = '';
    }

    const allowed = await requestWriteFileApproval(path, existing, content);
    if (!allowed) {
      return { tool: call.tool, ok: false, output: 'Permission denied by user for write_file.' };
    }

    const writeResult = await window.electronAPI.writeFile({ path, content });
    if (!writeResult.ok) {
      return { tool: call.tool, ok: false, output: writeResult.error ?? 'Write failed' };
    }

    useAppStore.getState().upsertOpenTabContent(path, content);
    await useAppStore.getState().refreshWorkspaceTree();

    return {
      tool: call.tool,
      ok: true,
      output: `Wrote ${path} (${content.length} chars)`
    };
  }

  if (call.tool === 'run_terminal') {
    const command = String(call.input.command ?? '');
    if (!command) {
      return { tool: call.tool, ok: false, output: 'Missing input.command' };
    }

    const allowed = await requestToolPermission('run_terminal', `Command:\n${command}`);
    if (!allowed) {
      return { tool: call.tool, ok: false, output: 'Permission denied by user for run_terminal.' };
    }

    if (!window.electronAPI?.runTerminalCommand) {
      return { tool: call.tool, ok: false, output: 'Terminal backend unavailable. Launch in Electron mode.' };
    }

    const cwd =
      typeof call.input.cwd === 'string'
        ? call.input.cwd
        : (useAppStore.getState().workspacePath ?? undefined);
    const result = await window.electronAPI.runTerminalCommand({
      command,
      cwd,
      timeoutMs: typeof call.input.timeoutMs === 'number' ? call.input.timeoutMs : 120_000
    });

    return {
      tool: call.tool,
      ok: result.ok,
      output: [
        `exitCode=${result.exitCode}`,
        result.stdout ? `stdout:\n${result.stdout.slice(0, 8000)}` : '',
        result.stderr ? `stderr:\n${result.stderr.slice(0, 8000)}` : '',
        !result.ok
          ? `error: ${formatBackendErrorEnvelope({
              source: 'tool:run_terminal',
              error: result.error,
              stderr: result.stderr,
              exitCode: result.exitCode,
              fallback: 'Terminal command failed'
            })}`
          : ''
      ]
        .filter(Boolean)
        .join('\n\n')
    };
  }

  if (call.tool === 'analyze_url_replicate_ui') {
    const url = String(call.input.url ?? '');
    if (!url) {
      return { tool: call.tool, ok: false, output: 'Missing input.url' };
    }

    const allowed = await requestToolPermission(
      'analyze_url_replicate_ui',
      `Analyze URL and infer UI:\n${url}`
    );
    if (!allowed) {
      return {
        tool: call.tool,
        ok: false,
        output: 'Permission denied by user for analyze_url_replicate_ui.'
      };
    }

    const analysis = await window.electronAPI.analyzeUrlWithPlaywright({ url });
    if (!analysis.ok) {
      return { tool: call.tool, ok: false, output: analysis.error ?? 'URL analysis failed' };
    }

    const generatedNodes = buildCanvasFromAnalysis(
      analysis.title ?? 'Replicated UI',
      analysis.uiSummary ?? ''
    );
    const approved = await requestCanvasDiffApproval(
      'analyze_url_replicate_ui',
      `Source URL: ${url}`,
      generatedNodes
    );
    if (!approved) {
      return {
        tool: call.tool,
        ok: false,
        output: 'Canvas update canceled by user at diff preview step.'
      };
    }

    useCanvasStore.getState().setNodesFromSerialized(generatedNodes);

    const canvasCode = generateCanvasCode(useCanvasStore.getState().nodes);
    useAppStore.getState().ensureCanvasTab();
    useAppStore.getState().upsertVirtualTabContent(CANVAS_VIRTUAL_PATH, CANVAS_VIRTUAL_NAME, canvasCode);

    return {
      tool: call.tool,
      ok: true,
      output: [
        `Analyzed URL: ${url}`,
        `Title: ${analysis.title ?? 'unknown'}`,
        analysis.uiSummary ?? '',
        'Canvas updated with a generated layout.'
      ]
        .filter(Boolean)
        .join('\n')
    };
  }

  if (call.tool === 'apply_canvas_layout') {
    const nodes = parseCanvasNodes(call.input.nodes);
    if (nodes.length === 0) {
      return {
        tool: call.tool,
        ok: false,
        output: `No valid canvas nodes in input.nodes: ${stringifyUnknown(call.input.nodes)}`
      };
    }

    const allowed = await requestToolPermission(
      'apply_canvas_layout',
      `Apply layout with ${nodes.length} nodes.`
    );
    if (!allowed) {
      return { tool: call.tool, ok: false, output: 'Permission denied by user for apply_canvas_layout.' };
    }

    const approved = await requestCanvasDiffApproval(
      'apply_canvas_layout',
      'Agent provided a new canvas layout.',
      nodes
    );
    if (!approved) {
      return {
        tool: call.tool,
        ok: false,
        output: 'Canvas layout application canceled by user at diff preview step.'
      };
    }

    useCanvasStore.getState().setNodesFromSerialized(nodes);
    const canvasCode = generateCanvasCode(useCanvasStore.getState().nodes);
    useAppStore.getState().ensureCanvasTab();
    useAppStore.getState().upsertVirtualTabContent(CANVAS_VIRTUAL_PATH, CANVAS_VIRTUAL_NAME, canvasCode);

    return {
      tool: call.tool,
      ok: true,
      output: `Canvas updated with ${nodes.length} nodes.`
    };
  }

  if (call.tool === 'apply_api_layout') {
    const nodes = parseApiNodes(call.input.nodes);
    if (nodes.length === 0) {
      return {
        tool: call.tool,
        ok: false,
        output: `No valid API nodes in input.nodes: ${stringifyUnknown(call.input.nodes)}`
      };
    }

    const allowed = await requestToolPermission(
      'apply_api_layout',
      `Apply API layout with ${nodes.length} nodes.`
    );
    if (!allowed) {
      return { tool: call.tool, ok: false, output: 'Permission denied by user for apply_api_layout.' };
    }

    useApiStore.getState().setNodesFromSerialized(nodes);
    const apiCode = generateApiCode(useApiStore.getState().nodes);
    const openapiCode = generateOpenApi(useApiStore.getState().nodes);
    useAppStore.getState().ensureApiTabs();
    useAppStore.getState().upsertVirtualTabContent(API_VIRTUAL_PATH, API_VIRTUAL_NAME, apiCode);
    useAppStore
      .getState()
      .upsertVirtualTabContent(API_OPENAPI_VIRTUAL_PATH, API_OPENAPI_VIRTUAL_NAME, openapiCode);

    return {
      tool: call.tool,
      ok: true,
      output: `API builder updated with ${nodes.length} nodes.`
    };
  }

  if (call.tool === 'apply_db_layout') {
    const nodes = parseDbNodes(call.input.nodes);
    const edges = parseDbEdges(call.input.edges);
    if (nodes.length === 0) {
      return {
        tool: call.tool,
        ok: false,
        output: `No valid DB nodes in input.nodes: ${stringifyUnknown(call.input.nodes)}`
      };
    }

    const allowed = await requestToolPermission(
      'apply_db_layout',
      `Apply DB layout with ${nodes.length} nodes and ${edges.length} edges.`
    );
    if (!allowed) {
      return { tool: call.tool, ok: false, output: 'Permission denied by user for apply_db_layout.' };
    }

    useDbStore.getState().setGraphFromSerialized(nodes, edges);
    const dbState = useDbStore.getState();
    const prismaCode = generatePrismaSchema(dbState.nodes, dbState.edges);
    const supabaseSql = generateSupabaseSql(dbState.nodes, dbState.edges);
    useAppStore.getState().ensureDbTabs();
    useAppStore
      .getState()
      .upsertVirtualTabContent(DB_PRISMA_VIRTUAL_PATH, DB_PRISMA_VIRTUAL_NAME, prismaCode);
    useAppStore
      .getState()
      .upsertVirtualTabContent(DB_SUPABASE_VIRTUAL_PATH, DB_SUPABASE_VIRTUAL_NAME, supabaseSql);

    return {
      tool: call.tool,
      ok: true,
      output: `DB builder updated with ${nodes.length} nodes and ${edges.length} edges.`
    };
  }

  if (call.tool === 'generate_backend_code') {
    const allowed = await requestToolPermission(
      'generate_backend_code',
      'Generate backend artifacts from current API and DB visual builders.'
    );
    if (!allowed) {
      return { tool: call.tool, ok: false, output: 'Permission denied by user for generate_backend_code.' };
    }

    const apiCode = generateApiCode(useApiStore.getState().nodes);
    const openapiCode = generateOpenApi(useApiStore.getState().nodes);
    const dbState = useDbStore.getState();
    const prismaCode = generatePrismaSchema(dbState.nodes, dbState.edges);
    const supabaseSql = generateSupabaseSql(dbState.nodes, dbState.edges);

    useAppStore.getState().ensureApiTabs();
    useAppStore.getState().ensureDbTabs();
    useAppStore.getState().upsertVirtualTabContent(API_VIRTUAL_PATH, API_VIRTUAL_NAME, apiCode);
    useAppStore
      .getState()
      .upsertVirtualTabContent(API_OPENAPI_VIRTUAL_PATH, API_OPENAPI_VIRTUAL_NAME, openapiCode);
    useAppStore
      .getState()
      .upsertVirtualTabContent(DB_PRISMA_VIRTUAL_PATH, DB_PRISMA_VIRTUAL_NAME, prismaCode);
    useAppStore
      .getState()
      .upsertVirtualTabContent(DB_SUPABASE_VIRTUAL_PATH, DB_SUPABASE_VIRTUAL_NAME, supabaseSql);

    return {
      tool: call.tool,
      ok: true,
      output:
        'Backend artifacts generated in virtual tabs: routes.ts, openapi.json, schema.prisma, supabase.sql.'
    };
  }

  if (call.tool === 'scaffold_fullstack_project') {
    const projectName = String(call.input.projectName ?? 'aetherforge-fullstack');
    const backend = call.input.backend === 'fastapi' ? 'fastapi' : 'express';
    const database =
      call.input.database === 'prisma' || call.input.database === 'supabase' || call.input.database === 'both'
        ? call.input.database
        : 'both';

    const workspacePath = useAppStore.getState().workspacePath;
    if (!workspacePath) {
      return { tool: call.tool, ok: false, output: 'Open a workspace first to scaffold a project.' };
    }

    const allowed = await requestToolPermission(
      'scaffold_fullstack_project',
      `Scaffold project ${projectName} with backend=${backend}, database=${database}`
    );
    if (!allowed) {
      return {
        tool: call.tool,
        ok: false,
        output: 'Permission denied by user for scaffold_fullstack_project.'
      };
    }

    if (!window.electronAPI?.scaffoldFullstackProject) {
      return { tool: call.tool, ok: false, output: 'Scaffold backend unavailable. Launch in Electron mode.' };
    }

    const result = await window.electronAPI.scaffoldFullstackProject({
      targetRoot: workspacePath,
      projectName,
      backend,
      database,
      overwrite: Boolean(call.input.overwrite),
      generatedArtifacts: {
        openApiJson:
          useAppStore.getState().openTabs.find((tab) => tab.path === API_OPENAPI_VIRTUAL_PATH)?.content ||
          undefined,
        prismaSchema:
          useAppStore.getState().openTabs.find((tab) => tab.path === DB_PRISMA_VIRTUAL_PATH)?.content ||
          undefined,
        supabaseSql:
          useAppStore.getState().openTabs.find((tab) => tab.path === DB_SUPABASE_VIRTUAL_PATH)?.content ||
          undefined
      }
    });

    if (!result.ok || !result.projectPath) {
      return {
        tool: call.tool,
        ok: false,
        output: formatBackendErrorEnvelope({
          source: 'tool:scaffold',
          error: result.error,
          fallback: 'Scaffold failed'
        })
      };
    }

    await useAppStore.getState().refreshWorkspaceTree();

    return {
      tool: call.tool,
      ok: true,
      output: `Full-stack project created at ${result.projectPath} with ${result.createdFiles.length} files.`
    };
  }

  return {
    tool: call.tool,
    ok: false,
    output: `Unknown tool: ${call.tool}`
  };
}
