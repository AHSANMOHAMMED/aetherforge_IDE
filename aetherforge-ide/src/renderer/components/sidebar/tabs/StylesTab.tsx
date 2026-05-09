import { Check, Sun, Moon, Contrast, Sparkles, Monitor } from 'lucide-react';
import { type ReactElement } from 'react';
import { useSettingsStore, type ThemeVariant } from '@/renderer/state/settings-store';

const THEMES: { id: ThemeVariant; label: string; icon: ReactElement; tokens: string[] }[] = [
  { id: 'dark', label: 'Dark', icon: <Moon size={12} />, tokens: ['#0b1220', '#0e1729', '#22d3ee'] },
  {
    id: 'midnight',
    label: 'Midnight',
    icon: <Sparkles size={12} />,
    tokens: ['#070710', '#0d0d1a', '#38bdf8']
  },
  { id: 'light', label: 'Light', icon: <Sun size={12} />, tokens: ['#ffffff', '#f1f5f9', '#0284c7'] },
  {
    id: 'hc-dark',
    label: 'High contrast',
    icon: <Contrast size={12} />,
    tokens: ['#000000', '#1a1a1a', '#ffff00']
  },
  { id: 'system', label: 'System', icon: <Monitor size={12} />, tokens: ['#0b1220', '#ffffff', '#22d3ee'] }
];

const FONT_OPTIONS = [
  { id: "'JetBrains Mono', monospace", label: 'JetBrains Mono' },
  { id: "'Fira Code', monospace", label: 'Fira Code' },
  { id: 'Consolas, monospace', label: 'Consolas' },
  { id: 'Menlo, monospace', label: 'Menlo' },
  { id: 'system-ui, sans-serif', label: 'System' }
];

export function StylesTab(): ReactElement {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const tabSize = useSettingsStore((s) => s.tabSize);
  const setTabSize = useSettingsStore((s) => s.setTabSize);
  const wordWrap = useSettingsStore((s) => s.wordWrap);
  const setWordWrap = useSettingsStore((s) => s.setWordWrap);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-3 text-xs">
      <div className="mb-4">
        <h3 className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
          Theme
        </h3>
        <div className="space-y-1">
          {THEMES.map((t) => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 transition ${
                  active
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border/40 bg-background/40 hover:bg-secondary/40'
                }`}
              >
                <span>{t.icon}</span>
                <span className="flex-1 text-left">{t.label}</span>
                <span className="flex gap-0.5">
                  {t.tokens.map((c) => (
                    <span
                      key={c}
                      className="border-border h-3 w-3 rounded-sm border"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </span>
                {active && <Check size={12} className="text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
          Editor
        </h3>
        <div className="space-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Font family</span>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="border-border/40 bg-background/40 rounded-md border px-2 py-1.5"
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Font size: {fontSize}px</span>
            <input
              type="range"
              min={10}
              max={28}
              step={1}
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              aria-valuemin={10}
              aria-valuemax={28}
              aria-valuenow={fontSize}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">Tab size: {tabSize}</span>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={tabSize}
              onChange={(e) => setTabSize(parseInt(e.target.value, 10))}
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Word wrap</span>
            <input
              type="checkbox"
              checked={wordWrap}
              onChange={(e) => setWordWrap(e.target.checked)}
              aria-label="Word wrap"
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wider">
          Spacing
        </h3>
        <div className="text-muted-foreground space-y-1">
          <div>xs: 4px</div>
          <div>sm: 8px</div>
          <div>md: 16px</div>
          <div>lg: 24px</div>
          <div>xl: 32px</div>
        </div>
      </div>
    </div>
  );
}
