/// <reference types="vite/client" />

import type { ElectronAPI } from '@/common/ipc';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
