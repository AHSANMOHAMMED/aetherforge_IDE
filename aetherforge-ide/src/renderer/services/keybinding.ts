import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Central keybinding service.
 *
 * - Commands are registered with a default key and an optional `when` clause.
 * - User overrides persist in localStorage.
 * - Listens at the window level and respects input/textarea/contenteditable
 *   focus contexts so shortcuts never eat the user's typing.
 * - Knows which keys are the "always available" Cursor-style global shortcuts
 *   (e.g. Cmd+P palette) vs editor-only ones.
 */

export type KeybindingScope =
  | 'global' // active everywhere
  | 'editor' // only when an editor pane is focused
  | 'canvas' // only when a canvas pane is focused
  | 'terminal'; // only when terminal is focused

export type CommandHandler = (event: KeyboardEvent) => void | Promise<void>;

export type CommandDefinition = {
  id: string;
  title: string;
  category?: string;
  defaultKey?: string;
  scope?: KeybindingScope;
  handler: CommandHandler;
};

type Override = { id: string; key: string | null };

interface KeybindingState {
  overrides: Override[];
  setOverride: (id: string, key: string | null) => void;
  clearOverrides: () => void;
}

export const useKeybindingStore = create<KeybindingState>()(
  persist(
    (set) => ({
      overrides: [],
      setOverride: (id, key) =>
        set((state) => ({
          overrides: [...state.overrides.filter((o) => o.id !== id), { id, key }]
        })),
      clearOverrides: () => set({ overrides: [] })
    }),
    { name: 'aetherforge-keybindings' }
  )
);

const commands = new Map<string, CommandDefinition>();

export function registerCommand(def: CommandDefinition): () => void {
  commands.set(def.id, def);
  return () => {
    commands.delete(def.id);
  };
}

export function getCommands(): CommandDefinition[] {
  return Array.from(commands.values());
}

export function executeCommand(id: string, event?: KeyboardEvent): boolean {
  const cmd = commands.get(id);
  if (!cmd) return false;
  void cmd.handler(event ?? new KeyboardEvent('keydown'));
  return true;
}

function normalizeKey(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.metaKey) parts.push('cmd');
  if (event.ctrlKey) parts.push('ctrl');
  if (event.altKey) parts.push('alt');
  if (event.shiftKey) parts.push('shift');
  const key = event.key.toLowerCase();
  if (key !== 'meta' && key !== 'control' && key !== 'alt' && key !== 'shift') {
    parts.push(key);
  }
  return parts.join('+');
}

function inputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.closest('[data-monaco-editor]')) return true;
  return false;
}

function isTerminalFocused(): boolean {
  return !!document.activeElement?.closest('[data-aetherforge-terminal="true"]');
}

function isCanvasFocused(): boolean {
  return !!document.activeElement?.closest('[data-aetherforge-canvas="true"]');
}

function isEditorFocused(): boolean {
  return !!document.activeElement?.closest('[data-monaco-editor]');
}

function inScope(scope: KeybindingScope | undefined): boolean {
  if (!scope || scope === 'global') return true;
  if (scope === 'editor') return isEditorFocused();
  if (scope === 'canvas') return isCanvasFocused();
  if (scope === 'terminal') return isTerminalFocused();
  return false;
}

export function startKeybindingDispatcher(): () => void {
  const handler = (event: KeyboardEvent) => {
    const overrides = useKeybindingStore.getState().overrides;
    const normalized = normalizeKey(event);
    if (!normalized || normalized === 'shift' || normalized === 'cmd' || normalized === 'ctrl') return;

    for (const cmd of commands.values()) {
      const override = overrides.find((o) => o.id === cmd.id);
      const effectiveKey = override?.key === null ? null : (override?.key ?? cmd.defaultKey);
      if (!effectiveKey) continue;
      if (effectiveKey.toLowerCase() !== normalized) continue;
      if (cmd.scope === 'global' || cmd.scope === undefined) {
        // Global commands skip when user is typing in an input UNLESS the binding has a modifier.
        const hasModifier = /(cmd|ctrl|alt)/.test(normalized);
        if (!hasModifier && inputFocused()) continue;
      } else if (!inScope(cmd.scope)) {
        continue;
      }
      event.preventDefault();
      void cmd.handler(event);
      return;
    }
  };
  window.addEventListener('keydown', handler, { capture: true });
  return () => {
    window.removeEventListener('keydown', handler, { capture: true });
  };
}
