export function escapeBashString(value: string): string {
  if (!value) {
    return "''";
  }
  if (!/[^a-zA-Z0-9_\-./]/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export function escapeBashPath(value: string): string {
  if (!value) {
    return "''";
  }
  if (!/[^a-zA-Z0-9_\-./]/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export type SafeCommandInput = {
  command: string;
  args: (string | null | undefined)[];
};

export function buildSafeCommand(input: SafeCommandInput): string {
  const args = input.args.filter((arg): arg is string => arg != null).map((arg) => escapeBashString(arg));

  return [input.command, ...args].join(' ');
}

export function validateCommand(command: string): boolean {
  const allowedCommands = [
    'npm',
    'node',
    'python',
    'pip',
    'git',
    'uvicorn',
    'test',
    'echo',
    'curl',
    'timeout',
    'sleep'
  ];

  const baseCommand = command.trim().split(/\s+/)[0];
  if (!baseCommand) {
    return false;
  }

  const normalized = baseCommand.toLowerCase().replace(/^.*\//, '');
  return allowedCommands.some((cmd) => normalized === cmd || normalized === `${cmd}.exe`);
}

export function sanitizeCommandOutput(output: string): string {
  return output
    .split('\n')
    .slice(0, 1000)
    .map((line) => line.slice(0, 500))
    .join('\n');
}
