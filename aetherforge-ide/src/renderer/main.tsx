import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/feedback/AppErrorBoundary';
import { bindThemeToDocument } from './state/settings-store';
import { startKeybindingDispatcher } from './services/keybinding';
import { setupMonaco } from './editor/monaco-setup';
import { registerLspDiagnosticsBridge } from './lsp/lsp-diagnostics-bridge';
import { initRendererSentry } from './observability/sentry';
import './styles/globals.css';

initRendererSentry();
setupMonaco();
bindThemeToDocument();
startKeybindingDispatcher();
registerLspDiagnosticsBridge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
