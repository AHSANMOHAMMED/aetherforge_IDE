import { useState } from 'react';
import type { ReactElement } from 'react';
import { awaitDeviceFlow, startDeviceFlow, type DeviceFlowStart } from './device-flow';
import { useAccountStore } from './account-store';

export function AccountPanel(): ReactElement {
  const session = useAccountStore((s) => s.session);
  const setSession = useAccountStore((s) => s.setSession);
  const signOut = useAccountStore((s) => s.signOut);

  const [status, setStatus] = useState<'idle' | 'starting' | 'awaiting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<DeviceFlowStart | null>(null);

  const beginSignIn = async (): Promise<void> => {
    setStatus('starting');
    setError(null);
    try {
      const start = await startDeviceFlow();
      setPending(start);
      setStatus('awaiting');
      const result = await awaitDeviceFlow(start);
      setPending(null);
      if (result.ok) {
        setSession({ token: result.token, userId: result.userId, signedInAt: Date.now() });
        setStatus('idle');
      } else {
        setStatus('error');
        setError(result.error);
      }
    } catch (err) {
      setStatus('error');
      setError((err as Error).message);
    }
  };

  if (session) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-white/5 p-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-400">Signed in</p>
          <p className="font-mono text-slate-100">{session.userId}</p>
        </div>
        <button
          onClick={signOut}
          className="self-start rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-white/5 p-4 text-sm">
      <p className="text-slate-300">Sign in to enable cloud sync, hosted AI proxy, and team policies.</p>
      {status === 'awaiting' && pending ? (
        <div className="flex flex-col gap-1 rounded border border-cyan-500/40 bg-cyan-500/10 p-3 text-xs text-cyan-200">
          <p>Open the verification URL and enter your code:</p>
          <p className="font-mono text-base text-cyan-100">{pending.userCode}</p>
          <a
            href={pending.verificationUrlComplete}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-300 underline hover:text-cyan-200"
          >
            {pending.verificationUrl}
          </a>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-300">Error: {error}</p> : null}
      <button
        onClick={beginSignIn}
        disabled={status === 'starting' || status === 'awaiting'}
        className="self-start rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-500/20 disabled:opacity-50"
      >
        {status === 'starting' || status === 'awaiting' ? 'Waiting for browser…' : 'Sign in with browser'}
      </button>
    </div>
  );
}
