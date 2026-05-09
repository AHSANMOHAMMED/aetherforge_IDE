import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[AppErrorBoundary] renderer crash caught', error, errorInfo);
  }

  reset = (): void => {
    this.setState({ hasError: false, message: undefined });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex h-screen items-center justify-center bg-[radial-gradient(1200px_500px_at_0%_0%,rgba(34,211,238,0.16),transparent),radial-gradient(1100px_500px_at_100%_0%,rgba(168,85,247,0.14),transparent),#070b14] px-6 text-slate-100">
        <div className="max-w-xl rounded-2xl border border-cyan-400/25 bg-slate-950/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
          <p className="text-lg font-semibold">AetherForge hit an unexpected error</p>
          <p className="mt-2 text-sm text-slate-300">{this.state.message ?? 'Unknown renderer error'}</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="rounded-md bg-cyan-500/30 px-3 py-1.5 text-sm text-cyan-100 hover:bg-cyan-500/40"
              onClick={this.reset}
            >
              Try Recover
            </button>
            <button
              type="button"
              className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/15"
              onClick={() => window.location.reload()}
            >
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }
}
