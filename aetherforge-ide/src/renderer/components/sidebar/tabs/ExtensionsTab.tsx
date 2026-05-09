import { lazy, Suspense, type ReactElement } from 'react';

const MarketplacePanel = lazy(() => import('@/renderer/plugins/marketplace/MarketplacePanel'));

export function ExtensionsTab(): ReactElement {
  return (
    <div className="h-full overflow-hidden">
      <Suspense fallback={<div className="text-muted-foreground p-3 text-sm">Loading extensions...</div>}>
        <MarketplacePanel />
      </Suspense>
    </div>
  );
}
