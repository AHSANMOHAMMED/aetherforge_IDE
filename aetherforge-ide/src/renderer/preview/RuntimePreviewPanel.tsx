/**
 * Unified runtime preview entry — delegates to Web + Live preview (Canvas / App / Side-by side).
 */
import type { ReactElement } from 'react';
import WebPreviewPanel from './WebPreviewPanel';

export default function RuntimePreviewPanel(): ReactElement {
  return <WebPreviewPanel />;
}
