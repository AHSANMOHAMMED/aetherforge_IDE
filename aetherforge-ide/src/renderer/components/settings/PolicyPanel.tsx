import { useState, type ReactElement } from 'react';
import { ShieldAlert } from 'lucide-react';
import { usePolicyStore } from '@/renderer/state/policy-store';

function CommaList({
  label,
  values,
  onChange
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
}): ReactElement {
  const [draft, setDraft] = useState(values.join(', '));
  return (
    <label className="text-muted-foreground block text-xs">
      {label}
      <input
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() =>
          onChange(
            draft
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          )
        }
        className="text-foreground mt-1 w-full rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs focus:border-cyan-400/50 focus:outline-none"
        placeholder="comma,separated,ids"
      />
    </label>
  );
}

export function PolicyPanel(): ReactElement {
  const policy = usePolicyStore((state) => state.policy);
  const setAirGap = usePolicyStore((state) => state.setAirGap);
  const setProviderAllow = usePolicyStore((state) => state.setProviderAllow);
  const setModelAllow = usePolicyStore((state) => state.setModelAllow);
  const setPluginAllow = usePolicyStore((state) => state.setPluginAllow);

  return (
    <div className="space-y-4 rounded-md border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-amber-300" />
        <h3 className="text-foreground text-sm font-semibold">Org / device policy</h3>
      </div>
      <p className="text-muted-foreground text-xs">
        Air-gap disables marketplace, sync, telemetry, and cloud AI. Allowlists are matched against the IDs
        surfaced in provider, model, and plugin settings.
      </p>

      <label className="text-foreground flex items-center justify-between gap-3 rounded-md border border-white/10 bg-slate-900 p-3 text-xs">
        <span className="flex flex-col">
          <span className="font-medium">Air-gap mode</span>
          <span className="text-muted-foreground">Block all outbound network traffic in the renderer.</span>
        </span>
        <input
          type="checkbox"
          checked={policy.airGap}
          onChange={(event) => setAirGap(event.target.checked)}
          className="h-4 w-4"
        />
      </label>

      <CommaList label="Allowed providers" values={policy.providerAllow} onChange={setProviderAllow} />
      <CommaList label="Allowed models" values={policy.modelAllow} onChange={setModelAllow} />
      <CommaList label="Allowed plugins" values={policy.pluginAllow} onChange={setPluginAllow} />
    </div>
  );
}
