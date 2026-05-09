import { useEffect, useMemo, type ReactElement } from 'react';
import { useAIStore } from './store';
import { estimateCostUsdRough } from './usage';
import type { AIProviderId } from './types';

const formatUsd = (value: number | undefined): string => {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }
  if (value < 0.0001) {
    return '< $0.0001';
  }
  return `$${value.toFixed(4)}`;
};

export function AICostDashboard(): ReactElement {
  const runs = useAIStore((s) => s.runs);
  const initialize = useAIStore((s) => s.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const stats = useMemo(() => {
    const byProvider = new Map<AIProviderId, { runs: number; tokens: number; cost: number }>();
    let totalRuns = 0;
    let totalTokens = 0;
    let totalCost = 0;

    for (const run of runs) {
      totalRuns += 1;
      const usage = run.usageEstimate;
      const tokens = usage
        ? usage.plannerInput + usage.plannerOutput + usage.reviewerInput + usage.reviewerOutput
        : 0;
      const cost = usage?.costUsdRough ?? estimateCostUsdRough(run.provider, tokens, 0) ?? 0;
      totalTokens += tokens;
      totalCost += cost;

      const bucket = byProvider.get(run.provider) ?? { runs: 0, tokens: 0, cost: 0 };
      bucket.runs += 1;
      bucket.tokens += tokens;
      bucket.cost += cost;
      byProvider.set(run.provider, bucket);
    }

    return {
      totalRuns,
      totalTokens,
      totalCost,
      perProvider: Array.from(byProvider.entries())
        .map(([provider, value]) => ({ provider, ...value }))
        .sort((a, b) => b.cost - a.cost)
    };
  }, [runs]);

  return (
    <div className="text-foreground flex h-full flex-col bg-slate-950/40 p-4">
      <h2 className="text-base font-semibold">Project AI cost (estimated)</h2>
      <p className="text-muted-foreground mt-1 text-xs">
        Token counts use a rough 4 chars/token heuristic. Cost figures are indicative only — verify against
        provider invoices.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <p className="text-muted-foreground text-xs">Runs</p>
          <p className="mt-1 text-lg font-semibold">{stats.totalRuns}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <p className="text-muted-foreground text-xs">Tokens (≈)</p>
          <p className="mt-1 text-lg font-semibold">{stats.totalTokens.toLocaleString()}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-white/5 p-3">
          <p className="text-muted-foreground text-xs">Cost (≈)</p>
          <p className="mt-1 text-lg font-semibold">{formatUsd(stats.totalCost)}</p>
        </div>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto rounded-md border border-white/10 bg-white/5">
        <table className="w-full text-left text-xs">
          <thead className="text-muted-foreground bg-white/5">
            <tr>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2 text-right">Runs</th>
              <th className="px-3 py-2 text-right">Tokens</th>
              <th className="px-3 py-2 text-right">Est. cost</th>
            </tr>
          </thead>
          <tbody>
            {stats.perProvider.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-muted-foreground px-3 py-4 text-center">
                  No runs yet.
                </td>
              </tr>
            ) : (
              stats.perProvider.map((entry) => (
                <tr key={entry.provider} className="border-t border-white/5">
                  <td className="px-3 py-2 capitalize">{entry.provider}</td>
                  <td className="px-3 py-2 text-right">{entry.runs}</td>
                  <td className="px-3 py-2 text-right">{entry.tokens.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{formatUsd(entry.cost)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
