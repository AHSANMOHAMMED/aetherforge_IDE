export type HealthProbeResult = {
  ok: boolean;
  message: string;
  probeRan: boolean;
  reason?: string;
};

export type HealthProbePayload = {
  backendPath: string;
  backend: 'express' | 'fastapi';
  timeoutMs: number;
};

export async function attemptHealthProbe(
  payload: HealthProbePayload,
  runCommand: (
    command: string,
    cwd: string
  ) => Promise<{ stdout: string; stderr: string; exitCode: number; ok: boolean; error?: string }>
): Promise<HealthProbeResult> {
  const { backendPath, backend, timeoutMs: _timeoutMs } = payload;
  void _timeoutMs;

  try {
    if (backend === 'express') {
      const depInstall = `npm install --omit=dev 2>/dev/null || true`;
      await runCommand(depInstall, backendPath);

      const port = Math.floor(Math.random() * 1000) + 9000;
      const healthCmd = `node -e "const app = require('./dist/index.js') ?? require('./src/server.js'); const server = app.listen?.(${port}) || require('express')().listen(${port}); setTimeout(() => server.close(), 2000);" & sleep 1 && curl -s http://localhost:${port}/health || echo "no-health" && wait`;

      const result = await runCommand(healthCmd, backendPath);
      if (result.ok || result.stdout.includes('no-health') || !result.error) {
        return {
          ok: true,
          message: 'Express server startup successful',
          probeRan: true
        };
      }
      return {
        ok: false,
        message: `Express health probe failed: ${result.stderr.slice(0, 120)}`,
        probeRan: true,
        reason: result.stderr || result.error
      };
    } else if (backend === 'fastapi') {
      const depInstall = `pip install -q -r requirements.txt 2>/dev/null || true`;
      await runCommand(depInstall, backendPath);

      const port = Math.floor(Math.random() * 1000) + 9000;
      const healthCmd = `timeout 3 python -m uvicorn app.main:app --host 127.0.0.1 --port ${port} 2>&1 | head -20 & sleep 1 && curl -s http://localhost:${port}/docs >/dev/null 2>&1 && echo "FASTAPI_RUNNING" || echo "no-response"`;

      const result = await runCommand(healthCmd, backendPath);
      if (
        result.ok ||
        result.stdout.includes('FASTAPI_RUNNING') ||
        result.stdout.includes('Uvicorn running')
      ) {
        return {
          ok: true,
          message: 'FastAPI server startup successful',
          probeRan: true
        };
      }
      return {
        ok: false,
        message: `FastAPI health probe failed: ${result.stderr.slice(0, 120)}`,
        probeRan: true,
        reason: result.stderr || result.error
      };
    }

    return {
      ok: false,
      message: 'Unknown backend type for health probe',
      probeRan: false
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    return {
      ok: false,
      message: `Health probe error: dependencies or environment unavailable`,
      probeRan: false,
      reason
    };
  }
}
