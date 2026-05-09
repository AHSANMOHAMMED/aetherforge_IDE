import { create } from 'zustand';

export type ProblemSeverity = 'error' | 'warning' | 'info' | 'hint';

export type ProblemEntry = {
  id: string;
  file: string;
  line: number;
  column: number;
  message: string;
  severity: ProblemSeverity;
  source?: string;
};

interface ProblemsState {
  problems: ProblemEntry[];
  set: (entries: ProblemEntry[]) => void;
  add: (entry: ProblemEntry) => void;
  removeForFile: (file: string) => void;
  replaceForFile: (file: string, entries: ProblemEntry[]) => void;
  clear: () => void;
}

export const useProblemsStore = create<ProblemsState>((set) => ({
  problems: [],
  set: (entries) => set({ problems: entries }),
  add: (entry) => set((state) => ({ problems: [...state.problems, entry] })),
  removeForFile: (file) => set((state) => ({ problems: state.problems.filter((p) => p.file !== file) })),
  replaceForFile: (file, entries) =>
    set((state) => ({
      problems: [...state.problems.filter((p) => p.file !== file), ...entries]
    })),
  clear: () => set({ problems: [] })
}));
