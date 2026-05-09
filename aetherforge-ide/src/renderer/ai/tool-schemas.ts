import type { AgentToolName } from './types';

export type JsonSchema = {
  type: 'object';
  properties: Record<string, { type: string; description?: string; enum?: string[]; default?: unknown }>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ToolDescriptor = {
  name: AgentToolName;
  description: string;
  schema: JsonSchema;
};

export const AGENT_TOOL_DESCRIPTORS: ToolDescriptor[] = [
  {
    name: 'read_file',
    description: 'Read a file from the active workspace and return its UTF-8 contents.',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Workspace-relative or absolute path inside the workspace.' }
      },
      required: ['path'],
      additionalProperties: false
    }
  },
  {
    name: 'write_file',
    description: 'Atomically write a file in the active workspace. Requires user approval before applying.',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Workspace-relative path of the file to write.' },
        content: { type: 'string', description: 'Full file contents to write.' }
      },
      required: ['path', 'content'],
      additionalProperties: false
    }
  },
  {
    name: 'run_terminal',
    description: 'Run a shell command in the workspace cwd and return stdout/stderr. Requires user approval.',
    schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Exact command line to execute.' },
        cwd: { type: 'string', description: 'Optional override for working directory.' },
        timeoutMs: { type: 'number', description: 'Max time in milliseconds; default 120000.' }
      },
      required: ['command'],
      additionalProperties: false
    }
  },
  {
    name: 'analyze_url_replicate_ui',
    description:
      'Fetch a URL with Playwright and infer a UI summary. Replaces the visual canvas with a generated layout. Requires approval.',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Public URL to analyze.' }
      },
      required: ['url'],
      additionalProperties: false
    }
  },
  {
    name: 'apply_canvas_layout',
    description: 'Replace the visual canvas nodes with a layout proposed by the agent. Requires approval.',
    schema: {
      type: 'object',
      properties: {
        nodes: { type: 'array', description: 'Serializable canvas nodes.' }
      },
      required: ['nodes'],
      additionalProperties: false
    }
  },
  {
    name: 'apply_api_layout',
    description: 'Replace the API visual graph nodes. Requires approval.',
    schema: {
      type: 'object',
      properties: {
        nodes: { type: 'array', description: 'Serializable API graph nodes.' }
      },
      required: ['nodes'],
      additionalProperties: false
    }
  },
  {
    name: 'apply_db_layout',
    description: 'Replace the DB visual graph nodes/edges. Requires approval.',
    schema: {
      type: 'object',
      properties: {
        nodes: { type: 'array', description: 'Serializable DB graph nodes.' },
        edges: { type: 'array', description: 'Serializable DB graph edges.' }
      },
      required: ['nodes'],
      additionalProperties: false
    }
  },
  {
    name: 'generate_backend_code',
    description: 'Regenerate backend code from the current API/DB visual graphs.',
    schema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: 'scaffold_fullstack_project',
    description:
      'Scaffold a full-stack project (Express|FastAPI + Prisma|Supabase) on disk. Requires approval.',
    schema: {
      type: 'object',
      properties: {
        projectName: { type: 'string' },
        backend: { type: 'string', enum: ['express', 'fastapi'] },
        database: { type: 'string', enum: ['prisma', 'supabase', 'both'] },
        overwrite: { type: 'boolean' }
      },
      required: ['projectName', 'backend', 'database'],
      additionalProperties: false
    }
  }
];

export const ALLOWED_AGENT_TOOLS: ReadonlySet<AgentToolName> = new Set(
  AGENT_TOOL_DESCRIPTORS.map((descriptor) => descriptor.name)
);

/** OpenAI / Grok / OpenRouter / Mistral / Groq tool format. */
export function toOpenAITools(): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: JsonSchema };
}> {
  return AGENT_TOOL_DESCRIPTORS.map((descriptor) => ({
    type: 'function',
    function: {
      name: descriptor.name,
      description: descriptor.description,
      parameters: descriptor.schema
    }
  }));
}

/** Anthropic Claude tool format. */
export function toAnthropicTools(): Array<{
  name: string;
  description: string;
  input_schema: JsonSchema;
}> {
  return AGENT_TOOL_DESCRIPTORS.map((descriptor) => ({
    name: descriptor.name,
    description: descriptor.description,
    input_schema: descriptor.schema
  }));
}

/** Google Gemini function-declarations format. */
export function toGeminiTools(): Array<{
  functionDeclarations: Array<{ name: string; description: string; parameters: JsonSchema }>;
}> {
  return [
    {
      functionDeclarations: AGENT_TOOL_DESCRIPTORS.map((descriptor) => ({
        name: descriptor.name,
        description: descriptor.description,
        parameters: descriptor.schema
      }))
    }
  ];
}
