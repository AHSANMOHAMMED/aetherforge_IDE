export type BackendErrorEnvelopeInput = {
  source: string;
  error?: string;
  stderr?: string;
  exitCode?: number;
  fallback?: string;
};

function clean(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}

export function formatBackendErrorEnvelope(input: BackendErrorEnvelopeInput): string {
  const primary = clean(input.error ?? '');
  const secondary = clean(input.stderr ?? '');
  const details: string[] = [];

  if (primary) {
    details.push(primary);
  }

  if (secondary && secondary.toLowerCase() !== primary.toLowerCase()) {
    details.push(secondary);
  }

  if (typeof input.exitCode === 'number' && Number.isFinite(input.exitCode) && input.exitCode !== 0) {
    details.push(`exitCode=${input.exitCode}`);
  }

  if (details.length === 0) {
    details.push(input.fallback ?? 'Unknown backend error');
  }

  return `[${input.source}] ${details.join(' | ')}`;
}
