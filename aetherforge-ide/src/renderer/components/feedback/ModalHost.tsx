import { lazy, Suspense, useEffect, useRef, type ReactElement } from 'react';
import { useModalStore } from '@/renderer/state/modal-store';

const DiffEditor = lazy(() => import('@monaco-editor/react').then((m) => ({ default: m.DiffEditor })));

export function ModalHost(): ReactElement | null {
  const modal = useModalStore((state) => state.modal);
  const inputValue = useModalStore((state) => state.inputValue);
  const inputError = useModalStore((state) => state.inputError);
  const setInputValue = useModalStore((state) => state.setInputValue);
  const submit = useModalStore((state) => state.submit);
  const cancel = useModalStore((state) => state.cancel);
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!modal) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
    );
    focusable?.[0]?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [modal]);

  useEffect(() => {
    if (!modal) {
      return;
    }

    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        cancel();
      }
      if (event.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const activeElement = document.activeElement as HTMLElement | null;

        if (event.shiftKey && activeElement === first) {
          event.preventDefault();
          last.focus();
          return;
        }
        if (!event.shiftKey && activeElement === last) {
          event.preventDefault();
          first.focus();
          return;
        }
      }
      if (event.key === 'Enter') {
        submit();
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [cancel, modal, submit]);

  if (!modal) {
    return null;
  }

  const isDiff = modal.kind === 'diff';
  const isDestructive =
    (modal.kind === 'confirm' && modal.destructive) || (modal.kind === 'diff' && modal.destructive);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className={`w-full ${isDiff ? 'max-w-5xl' : 'max-w-md'} rounded-xl border border-white/15 bg-[#0a1120] p-4 shadow-2xl`}
      >
        <h2 className="text-foreground text-base font-semibold">{modal.title}</h2>
        {modal.description ? <p className="text-muted-foreground mt-1 text-sm">{modal.description}</p> : null}

        {modal.kind === 'input' ? (
          <div className="mt-4">
            <input
              autoFocus
              className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none ring-cyan-400/40 focus:ring"
              value={inputValue}
              placeholder={modal.placeholder ?? ''}
              onChange={(event) => setInputValue(event.target.value)}
            />
            {inputError ? <p className="mt-1 text-xs text-red-300">{inputError}</p> : null}
          </div>
        ) : null}

        {modal.kind === 'diff' ? (
          <div className="mt-3 flex flex-col gap-2">
            <p className="font-mono text-xs text-cyan-200">{modal.path}</p>
            <div className="h-[60vh] overflow-hidden rounded-md border border-white/10">
              <Suspense
                fallback={
                  <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
                    Loading diff…
                  </div>
                }
              >
                <DiffEditor
                  height="100%"
                  language={modal.language ?? 'plaintext'}
                  original={modal.beforeText}
                  modified={modal.afterText}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true
                  }}
                />
              </Suspense>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm hover:bg-white/10"
            onClick={() => cancel()}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${
              isDestructive
                ? 'bg-red-500/20 text-red-100 hover:bg-red-500/30'
                : 'bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30'
            }`}
            onClick={() => submit()}
          >
            {modal.confirmLabel ?? (isDiff ? 'Apply' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
