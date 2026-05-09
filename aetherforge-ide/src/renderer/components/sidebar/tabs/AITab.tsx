import { type ReactElement } from 'react';
import { AIAgentsPanel } from '@/renderer/ai/AIAgentsPanel';

export function AITab(): ReactElement {
  return (
    <div className="h-full overflow-hidden">
      <AIAgentsPanel />
    </div>
  );
}
