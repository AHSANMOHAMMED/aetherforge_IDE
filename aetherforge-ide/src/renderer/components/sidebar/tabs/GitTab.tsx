import { type ReactElement } from 'react';
import { SourceControlPanel } from '@/renderer/git/SourceControlPanel';

export function GitTab(): ReactElement {
  return <SourceControlPanel />;
}
