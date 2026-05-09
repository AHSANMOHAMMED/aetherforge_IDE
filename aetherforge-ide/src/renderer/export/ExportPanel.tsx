import { useState } from 'react';
import type { ExportTarget } from '../../common/ipc';
import { useCanvasStore } from '../canvas/store';
import type { CanvasSerializableNode } from '../canvas/types';
import { useToastStore } from '../state/toast-store';
import { formatBackendErrorEnvelope } from '../backend/error-envelope';

const TARGETS: { value: ExportTarget; label: string; icon: string; description: string }[] = [
  { value: 'react', label: 'React (Vite)', icon: '⚛', description: 'React 18 + Vite + TypeScript' },
  { value: 'nextjs', label: 'Next.js', icon: '▲', description: 'Next.js 14 App Router + TypeScript' },
  { value: 'flutter', label: 'Flutter', icon: '◉', description: 'Flutter / Dart — iOS & Android' },
  { value: 'react-native', label: 'React Native', icon: '📱', description: 'React Native 0.74 + Expo metro' }
];

export default function ExportPanel() {
  const nodes = useCanvasStore((s) => s.nodes);
  const pushToast = useToastStore((s) => s.pushToast);

  const [target, setTarget] = useState<ExportTarget>('react');
  const [projectName, setProjectName] = useState('my-app');
  const [overwrite, setOverwrite] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!projectName.trim()) {
      pushToast({ level: 'error', title: 'Project name is required.' });
      return;
    }

    const result = await window.electronAPI.openWorkspaceDialog();
    if (result.canceled || !result.path) return;

    const serialized: CanvasSerializableNode[] = nodes.map((n) => ({
      id: n.id,
      componentType: n.data.componentType,
      label: n.data.label,
      x: n.position.x,
      y: n.position.y,
      props: n.data.props
    }));

    setExporting(true);
    try {
      const res = await window.electronAPI.exportCanvas({
        targetRoot: result.path,
        projectName: projectName.trim(),
        target,
        nodes: serialized,
        overwrite
      });

      if (res.ok) {
        pushToast({
          level: 'success',
          title: `Exported ${res.createdFiles.length} files`,
          description: res.projectPath ?? ''
        });
      } else {
        pushToast({
          level: 'error',
          title: 'Export failed',
          description: formatBackendErrorEnvelope({
            source: 'export',
            error: res.error,
            fallback: 'Unknown export failure'
          })
        });
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6 text-slate-200">
      <div>
        <h2 className="mb-1 text-xl font-semibold text-slate-100">Export Canvas</h2>
        <p className="text-sm text-slate-400">
          Generate production-ready project code from your visual canvas.
        </p>
      </div>

      {/* Target selector */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">Target framework</p>
        <div className="grid grid-cols-2 gap-2">
          {TARGETS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTarget(t.value)}
              className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                target === t.value
                  ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              <span className="text-sm font-medium">{t.label}</span>
              <span className="text-xs text-slate-400">{t.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Project name */}
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
          Project name
        </label>
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '-'))}
          placeholder="my-app"
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/60"
        />
      </div>

      {/* Options */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="overwrite"
          checked={overwrite}
          onChange={(e) => setOverwrite(e.target.checked)}
          className="accent-cyan-500"
        />
        <label htmlFor="overwrite" className="cursor-pointer text-sm text-slate-300">
          Overwrite existing files
        </label>
      </div>

      {/* Summary */}
      <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
        <span className="font-medium text-slate-300">{nodes.length}</span> node{nodes.length !== 1 ? 's' : ''}{' '}
        on canvas will be exported.
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={exporting || nodes.length === 0}
        className="rounded-lg bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-40"
      >
        {exporting ? 'Exporting…' : 'Choose Destination & Export'}
      </button>
    </div>
  );
}
