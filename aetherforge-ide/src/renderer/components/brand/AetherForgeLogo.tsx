import type { ReactElement } from 'react';

type AetherForgeLogoProps = {
  compact?: boolean;
};

export function AetherForgeLogo({ compact = false }: AetherForgeLogoProps): ReactElement {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-9 w-9 shrink-0">
        <svg viewBox="0 0 40 40" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="af-core" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="55%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
            <radialGradient id="af-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="20" cy="20" r="18" fill="url(#af-glow)" />
          <path
            d="M20 4L33 11.5V28.5L20 36L7 28.5V11.5L20 4Z"
            fill="rgba(8,12,30,0.9)"
            stroke="url(#af-core)"
            strokeWidth="1.6"
          />
          <path
            d="M13 24L20 10L27 24"
            stroke="url(#af-core)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path d="M16 18H24" stroke="#e0f2fe" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>

      {!compact ? (
        <div>
          <p className="bg-gradient-to-r from-cyan-200 via-blue-200 to-fuchsia-200 bg-clip-text text-sm font-semibold tracking-wide text-transparent">
            AetherForge IDE
          </p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100/70">
            Hybrid Engineering Studio
          </p>
        </div>
      ) : null}
    </div>
  );
}
