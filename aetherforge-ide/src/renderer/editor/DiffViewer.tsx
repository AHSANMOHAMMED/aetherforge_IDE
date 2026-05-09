import { useEffect, useRef, type ReactElement } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useSettingsStore } from '@/renderer/state/settings-store';

type DiffViewerProps = {
  language?: string;
  original: string;
  modified: string;
  fileName?: string;
};

export function DiffViewer(props: DiffViewerProps): ReactElement {
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const editorTheme = useSettingsStore((s) => s.editorTheme);
  const diffRef = useRef<Monaco.editor.IStandaloneDiffEditor | null>(null);

  useEffect(() => {
    return () => {
      diffRef.current?.dispose();
    };
  }, []);

  return (
    <div className="h-full w-full" data-monaco-editor>
      <DiffEditor
        original={props.original}
        modified={props.modified}
        language={props.language ?? 'plaintext'}
        theme={editorTheme}
        onMount={(editor) => {
          diffRef.current = editor;
        }}
        options={{
          fontSize,
          fontFamily,
          renderSideBySide: true,
          readOnly: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderWhitespace: 'selection',
          lineNumbers: 'on'
        }}
      />
    </div>
  );
}
