import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Breakpoint = {
  /** Absolute file path. */
  file: string;
  /** 1-indexed line number. */
  line: number;
  enabled: boolean;
  /** Optional verified flag returned by the adapter once attached. */
  verified?: boolean;
};

export type StackFrame = {
  id: number;
  name: string;
  source?: { path?: string };
  line: number;
  column?: number;
};

export type Scope = {
  name: string;
  variablesReference: number;
  expensive?: boolean;
};

export type Variable = {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
};

export type DebugStatus = 'idle' | 'launching' | 'running' | 'paused' | 'terminated' | 'error';

interface DebugState {
  sessionId: string | null;
  status: DebugStatus;
  message?: string;
  breakpoints: Breakpoint[];
  threadId?: number;
  stack: StackFrame[];
  selectedFrameId?: number;
  scopes: Scope[];
  variables: Record<number, Variable[]>;

  toggleBreakpoint: (file: string, line: number) => void;
  setBreakpointsForFile: (file: string, lines: number[]) => void;
  clearBreakpointsForFile: (file: string) => void;
  setSession: (id: string | null) => void;
  setStatus: (status: DebugStatus, message?: string) => void;
  setStack: (frames: StackFrame[], threadId?: number) => void;
  setScopes: (scopes: Scope[]) => void;
  setVariables: (ref: number, variables: Variable[]) => void;
  selectFrame: (frameId: number | undefined) => void;
  reset: () => void;
}

const INITIAL: Pick<DebugState, 'sessionId' | 'status' | 'breakpoints' | 'stack' | 'scopes' | 'variables'> = {
  sessionId: null,
  status: 'idle',
  breakpoints: [],
  stack: [],
  scopes: [],
  variables: {}
};

export const useDebugStore = create<DebugState>()(
  persist(
    (set) => ({
      ...INITIAL,
      toggleBreakpoint: (file, line) =>
        set((state) => {
          const idx = state.breakpoints.findIndex((bp) => bp.file === file && bp.line === line);
          if (idx >= 0) {
            const next = state.breakpoints.slice();
            next.splice(idx, 1);
            return { breakpoints: next };
          }
          return {
            breakpoints: [...state.breakpoints, { file, line, enabled: true }]
          };
        }),
      setBreakpointsForFile: (file, lines) =>
        set((state) => ({
          breakpoints: [
            ...state.breakpoints.filter((bp) => bp.file !== file),
            ...lines.map((line) => ({ file, line, enabled: true }))
          ]
        })),
      clearBreakpointsForFile: (file) =>
        set((state) => ({ breakpoints: state.breakpoints.filter((bp) => bp.file !== file) })),
      setSession: (id) => set({ sessionId: id }),
      setStatus: (status, message) => set({ status, message }),
      setStack: (frames, threadId) =>
        set((state) => ({
          stack: frames,
          threadId,
          selectedFrameId: frames[0]?.id ?? state.selectedFrameId
        })),
      setScopes: (scopes) => set({ scopes }),
      setVariables: (ref, variables) =>
        set((state) => ({ variables: { ...state.variables, [ref]: variables } })),
      selectFrame: (frameId) => set({ selectedFrameId: frameId }),
      reset: () => set({ ...INITIAL })
    }),
    {
      name: 'aetherforge.debug.v1',
      partialize: (state) => ({ breakpoints: state.breakpoints })
    }
  )
);
