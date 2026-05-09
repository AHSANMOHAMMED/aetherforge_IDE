import { create } from 'zustand';

export type AppPage = {
  id: string;
  name: string;
  path: string;
};

type PagesState = {
  pages: AppPage[];
  activePageId: string;
  setActivePage: (pageId: string) => void;
  addPage: (name: string) => void;
  removePage: (pageId: string) => void;
};

function slugifyPageName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
  return slug || 'page';
}

function nextPageId(): string {
  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const defaultPage: AppPage = {
  id: 'page-home',
  name: 'Home',
  path: '/'
};

export const usePagesStore = create<PagesState>((set, get) => ({
  pages: [defaultPage],
  activePageId: defaultPage.id,

  setActivePage: (pageId) => {
    const exists = get().pages.some((page) => page.id === pageId);
    if (!exists) {
      return;
    }
    set({ activePageId: pageId });
  },

  addPage: (name) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    const slug = slugifyPageName(trimmedName);
    const existingPaths = new Set(get().pages.map((page) => page.path));
    let path = `/${slug}`;
    if (slug === 'home' && !existingPaths.has('/')) {
      path = '/';
    }

    if (existingPaths.has(path)) {
      let index = 2;
      while (existingPaths.has(`/${slug}-${index}`)) {
        index += 1;
      }
      path = `/${slug}-${index}`;
    }

    const newPage: AppPage = {
      id: nextPageId(),
      name: trimmedName,
      path
    };

    set((state) => ({
      pages: [...state.pages, newPage],
      activePageId: newPage.id
    }));
  },

  removePage: (pageId) => {
    set((state) => {
      if (state.pages.length <= 1) {
        return state;
      }

      const remaining = state.pages.filter((page) => page.id !== pageId);
      if (remaining.length === state.pages.length) {
        return state;
      }

      const activeStillExists = remaining.some((page) => page.id === state.activePageId);
      return {
        pages: remaining,
        activePageId: activeStillExists ? state.activePageId : remaining[0]!.id
      };
    });
  }
}));
