export type LaunchConfiguration = {
  name: string;
  type: string;
  request: 'launch' | 'attach';
  program?: string;
  cwd?: string;
  args?: string[];
  env?: Record<string, string>;
  port?: number;
  [key: string]: unknown;
};

export type LaunchConfigFile = {
  version: '0.2.0';
  configurations: LaunchConfiguration[];
};

const DEFAULT_PATH = '.aetherforge/launch.json';

function isLaunchConfig(value: unknown): value is LaunchConfiguration {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<LaunchConfiguration>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.type === 'string' &&
    (candidate.request === 'launch' || candidate.request === 'attach')
  );
}

/**
 * Read the workspace `.aetherforge/launch.json`, returning an empty list when missing or malformed.
 * Errors do not throw — debugging is opt-in and we want the surface to fail soft.
 */
export async function loadLaunchConfigurations(workspacePath: string): Promise<LaunchConfiguration[]> {
  if (typeof window === 'undefined' || !window.electronAPI?.readFile) {
    return [];
  }
  const fullPath = `${workspacePath.replace(/\/+$/, '')}/${DEFAULT_PATH}`;
  try {
    const result = await window.electronAPI.readFile(fullPath);
    if (typeof result.content !== 'string' || result.content.length === 0) {
      return [];
    }
    const parsed = JSON.parse(result.content) as Partial<LaunchConfigFile>;
    return Array.isArray(parsed.configurations) ? parsed.configurations.filter(isLaunchConfig) : [];
  } catch {
    return [];
  }
}

/** Default launch.json template offered when none exists. */
export function defaultLaunchConfigFile(): LaunchConfigFile {
  return {
    version: '0.2.0',
    configurations: [
      {
        name: 'Run current Node file',
        type: 'node',
        request: 'launch',
        program: '${file}',
        cwd: '${workspaceFolder}'
      }
    ]
  };
}
