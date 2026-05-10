import type { ReactElement } from 'react';
import { AICostDashboard } from '@/renderer/ai/AICostDashboard';

export function AICostTab(): ReactElement {
  return (
    <div className="h-full min-h-0 overflow-hidden" id="sidebar-panel-ai-cost">
      <AICostDashboard />
    </div>
  );
}
