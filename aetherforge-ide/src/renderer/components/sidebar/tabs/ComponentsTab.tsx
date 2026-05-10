import type { ReactElement } from 'react';
import { ComponentPalette } from '@/renderer/canvas/ComponentPalette';

/**
 * Sidebar host for the unified canvas palette. The actual catalog lives in
 * `aetherforge-ide/src/renderer/canvas/library.ts`. This tab is intentionally a
 * thin wrapper so the side rail and the visual canvas always show the same items.
 */
export function ComponentsTab(): ReactElement {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ComponentPalette showCategories showRecent />
    </div>
  );
}
