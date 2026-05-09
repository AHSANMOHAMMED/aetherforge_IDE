import { useState, type ReactElement } from 'react';
import { CheckCircle2, Layers3 } from 'lucide-react';
import { useAppStore } from '@/renderer/state/app-store';
import { useModalStore } from '@/renderer/state/modal-store';
import { useToastStore } from '@/renderer/state/toast-store';
import { API_OPENAPI_VIRTUAL_PATH } from '@/renderer/backend/api/sync';
import { DB_PRISMA_VIRTUAL_PATH, DB_SUPABASE_VIRTUAL_PATH } from '@/renderer/backend/db/sync';
import { formatBackendErrorEnvelope } from '@/renderer/backend/error-envelope';
import { attemptHealthProbe } from '@/renderer/backend/health-probe';

type BackendFramework = 'express' | 'fastapi';
type DatabaseTarget = 'prisma' | 'supabase' | 'both';

type LastGeneratedSnapshot = {
  projectPath: string;
  backend: BackendFramework;
  database: DatabaseTarget;
};

export function FullStackGeneratorPanel(): ReactElement {
  const workspacePath = useAppStore((state) => state.workspacePath);
  const refreshWorkspaceTree = useAppStore((state) => state.refreshWorkspaceTree);
  const openFile = useAppStore((state) => state.openFile);
  const openTabs = useAppStore((state) => state.openTabs);
  const requestConfirm = useModalStore((state) => state.requestConfirm);
  const pushToast = useToastStore((state) => state.pushToast);

  const [projectName, setProjectName] = useState('aetherforge-fullstack');
  const [backend, setBackend] = useState<BackendFramework>('express');
  const [database, setDatabase] = useState<DatabaseTarget>('both');
  const [overwrite, setOverwrite] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<LastGeneratedSnapshot | null>(null);

  const canGenerate = Boolean(workspacePath) && projectName.trim().length > 1 && !isGenerating;
  const canVerify = Boolean(lastGenerated) && !isGenerating && !isVerifying;

  const generatedArtifacts = {
    openApiJson: openTabs.find((tab) => tab.path === API_OPENAPI_VIRTUAL_PATH)?.content || undefined,
    prismaSchema: openTabs.find((tab) => tab.path === DB_PRISMA_VIRTUAL_PATH)?.content || undefined,
    supabaseSql: openTabs.find((tab) => tab.path === DB_SUPABASE_VIRTUAL_PATH)?.content || undefined
  };

  const onGenerate = async (): Promise<void> => {
    if (!workspacePath || !canGenerate) {
      return;
    }

    if (!window.electronAPI?.scaffoldFullstackProject) {
      pushToast({
        level: 'error',
        title: 'Electron runtime unavailable',
        description: 'Open AetherForge in desktop mode to run full-stack generation.',
        durationMs: 3200
      });
      return;
    }

    setIsGenerating(true);
    try {
      const execute = async (forceOverwrite: boolean) =>
        window.electronAPI.scaffoldFullstackProject({
          targetRoot: workspacePath,
          projectName: projectName.trim(),
          backend,
          database,
          overwrite: forceOverwrite,
          generatedArtifacts
        });

      let result = await execute(overwrite);

      if (!result.ok && (result.error ?? '').toLowerCase().includes('already exists') && !overwrite) {
        const shouldOverwrite = await requestConfirm({
          title: 'Project already exists',
          description: `A folder named ${projectName.trim()} already exists. Overwrite existing generated files?`,
          confirmLabel: 'Overwrite',
          destructive: true
        });

        if (!shouldOverwrite) {
          pushToast({
            level: 'info',
            title: 'Generation canceled',
            description: 'Project overwrite was declined.',
            durationMs: 2400
          });
          return;
        }

        result = await execute(true);
      }

      if (!result.ok || !result.projectPath) {
        pushToast({
          level: 'error',
          title: 'Generation failed',
          description: formatBackendErrorEnvelope({
            source: 'scaffold',
            error: result.error,
            fallback: 'Unknown generation error'
          }),
          durationMs: 3600
        });
        return;
      }

      await refreshWorkspaceTree();

      const firstFile = result.createdFiles[0];
      if (firstFile) {
        await openFile(firstFile);
      }

      pushToast({
        level: 'success',
        title: 'Full-stack project generated',
        description: `${result.createdFiles.length} file(s) created in ${result.projectPath}`,
        durationMs: 3200
      });

      setLastGenerated({
        projectPath: result.projectPath,
        backend,
        database
      });

      const backendRunCommand =
        backend === 'express'
          ? `npm i --prefix ${projectName.trim()}/backend && npm run dev --prefix ${projectName.trim()}/backend`
          : `python -m pip install -r ${projectName.trim()}/backend/requirements.txt && uvicorn app.main:app --reload --app-dir ${projectName.trim()}/backend`;

      pushToast({
        level: 'info',
        title: 'Next step: run backend',
        description: backendRunCommand,
        durationMs: 5200
      });
    } catch (error) {
      pushToast({
        level: 'error',
        title: 'Generation failed',
        description: formatBackendErrorEnvelope({
          source: 'scaffold',
          error: error instanceof Error ? error.message : 'Unknown error',
          fallback: 'Unknown generation error'
        }),
        durationMs: 3600
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const onVerifyBackend = async (): Promise<void> => {
    if (!lastGenerated || !window.electronAPI?.runTerminalCommand) {
      pushToast({
        level: 'error',
        title: 'Verification unavailable',
        description: 'Launch AetherForge in desktop runtime to verify scaffold output.',
        durationMs: 3200
      });
      return;
    }

    setIsVerifying(true);
    try {
      const backendPath = `${lastGenerated.projectPath}/backend`;
      const baseChecks =
        lastGenerated.backend === 'express'
          ? [
              'test -f package.json',
              'test -f src/server.js',
              'test -f src/routes/index.js',
              'node --check src/server.js',
              'node --check src/routes/index.js'
            ]
          : [
              'test -f requirements.txt',
              'test -f app/main.py',
              'test -f app/routers/users.py',
              'test -f app/services/users.py'
            ];

      if (lastGenerated.database === 'prisma' || lastGenerated.database === 'both') {
        baseChecks.push('test -f prisma/schema.prisma');
      }
      if (lastGenerated.database === 'supabase' || lastGenerated.database === 'both') {
        baseChecks.push('test -f supabase/migrations/001_initial.sql');
      }

      const command = `${baseChecks.join(' && ')} && echo "AETHERFORGE_VERIFY_OK"`;
      const verification = await window.electronAPI.runTerminalCommand({
        command,
        cwd: backendPath,
        timeoutMs: 40_000
      });

      if (!verification.ok || !verification.stdout.includes('AETHERFORGE_VERIFY_OK')) {
        pushToast({
          level: 'error',
          title: 'Backend verification failed',
          description: formatBackendErrorEnvelope({
            source: 'verify',
            error: verification.error || verification.stdout,
            stderr: verification.stderr,
            exitCode: verification.exitCode,
            fallback: 'Unknown verification failure'
          }).slice(0, 220),
          durationMs: 4200
        });
        return;
      }

      const healthProbe = await attemptHealthProbe(
        {
          backendPath,
          backend: lastGenerated.backend,
          timeoutMs: 15_000
        },
        async (command: string, cwd: string) => {
          const result = await window.electronAPI.runTerminalCommand({
            command,
            cwd,
            timeoutMs: 20_000
          });
          return {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            ok: result.ok,
            error: result.error
          };
        }
      );

      if (healthProbe.probeRan) {
        if (healthProbe.ok) {
          pushToast({
            level: 'success',
            title: 'Backend verification passed',
            description: `${lastGenerated.backend.toUpperCase()} scaffold structure, artifacts, and executable health check successful.`,
            durationMs: 3600
          });
        } else {
          pushToast({
            level: 'info',
            title: 'Backend verification passed (health probe degraded)',
            description: `Structure and artifacts valid. Health probe: ${healthProbe.message}. You can still run the backend manually.`,
            durationMs: 4800
          });
        }
      } else {
        pushToast({
          level: 'info',
          title: 'Backend verification passed (executable probe skipped)',
          description:
            `Structure and artifacts valid. Runtime environment unavailable for health check. ${healthProbe.reason ?? ''}`.trim(),
          durationMs: 4000
        });
      }
    } catch (error) {
      pushToast({
        level: 'error',
        title: 'Backend verification failed',
        description: formatBackendErrorEnvelope({
          source: 'verify',
          error: error instanceof Error ? error.message : 'Unknown verification error',
          fallback: 'Unknown verification error'
        }),
        durationMs: 4200
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3">
      <div className="mb-2">
        <p className="text-foreground text-sm font-semibold">
          <Layers3 className="mr-1 inline h-4 w-4" />
          One-Click Full-Stack
        </p>
        <p className="text-muted-foreground text-xs">
          Generate frontend + backend + database project scaffold.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-muted-foreground block text-xs">
          Project Name
          <input
            className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
          />
        </label>

        <label className="text-muted-foreground block text-xs">
          Backend Framework
          <select
            className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
            value={backend}
            onChange={(event) => setBackend(event.target.value as BackendFramework)}
          >
            <option value="express">Node.js + Express</option>
            <option value="fastapi">Python + FastAPI</option>
          </select>
        </label>

        <label className="text-muted-foreground block text-xs">
          Database Output
          <select
            className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
            value={database}
            onChange={(event) => setDatabase(event.target.value as DatabaseTarget)}
          >
            <option value="both">Prisma + Supabase</option>
            <option value="prisma">Prisma only</option>
            <option value="supabase">Supabase only</option>
          </select>
        </label>

        <label className="text-muted-foreground inline-flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(event) => setOverwrite(event.target.checked)}
          />
          Overwrite if project folder already exists
        </label>

        <button
          type="button"
          className="w-full rounded-md bg-cyan-500/25 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canGenerate}
          onClick={() => {
            void onGenerate();
          }}
        >
          {isGenerating ? 'Generating...' : 'Generate Full-Stack Project'}
        </button>

        <button
          type="button"
          className="w-full rounded-md bg-emerald-500/20 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canVerify}
          onClick={() => {
            void onVerifyBackend();
          }}
        >
          <CheckCircle2 className="mr-1 inline h-4 w-4" />
          {isVerifying ? 'Verifying backend...' : 'Verify Generated Backend'}
        </button>
      </div>
    </div>
  );
}
