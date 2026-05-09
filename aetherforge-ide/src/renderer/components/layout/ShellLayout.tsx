import { type ReactElement, type ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

type ShellLayoutProps = {
  headerLeft: ReactNode;
  headerCenter: ReactNode;
  headerRight: ReactNode;
  leftRail: ReactNode;
  mainPane: ReactNode;
  rightPane: ReactNode;
  bottomPane: ReactNode;
  bottomRightPane: ReactNode;
  statusBar: ReactNode;
};

const PANEL_STORAGE_KEY = 'aetherforge.layout.v2';

const horizontalHandle = (
  <PanelResizeHandle className="group flex w-1 shrink-0 cursor-col-resize items-center justify-center transition">
    <span className="bg-border group-hover:bg-primary/60 group-data-[resize-handle-state='drag']:bg-primary h-12 w-0.5 rounded-full" />
  </PanelResizeHandle>
);

const verticalHandle = (
  <PanelResizeHandle className="group flex h-1 shrink-0 cursor-row-resize items-center justify-center transition">
    <span className="bg-border group-hover:bg-primary/60 group-data-[resize-handle-state='drag']:bg-primary h-0.5 w-12 rounded-full" />
  </PanelResizeHandle>
);

export function ShellLayout(props: ShellLayoutProps): ReactElement {
  return (
    <div className="bg-background text-foreground relative flex h-screen flex-col overflow-hidden">
      <header
        className="border-border/50 grid h-14 shrink-0 grid-cols-[minmax(220px,1fr)_auto_minmax(220px,1fr)] items-center border-b px-4 backdrop-blur-xl"
        role="banner"
      >
        <div className="relative z-10 min-w-0">{props.headerLeft}</div>
        <div className="relative z-0 min-w-0">{props.headerCenter}</div>
        <div className="relative z-10 min-w-0 justify-self-end">{props.headerRight}</div>
      </header>

      <main className="flex min-h-0 flex-1 p-2 pb-1" role="main">
        <PanelGroup direction="horizontal" autoSaveId={`${PANEL_STORAGE_KEY}.h`}>
          <Panel
            defaultSize={18}
            minSize={10}
            maxSize={30}
            className="border-border/50 bg-card/40 overflow-hidden rounded-xl border"
          >
            <div className="h-full p-2" aria-label="Sidebar">
              {props.leftRail}
            </div>
          </Panel>

          {horizontalHandle}

          <Panel defaultSize={56} minSize={30}>
            <PanelGroup direction="vertical" autoSaveId={`${PANEL_STORAGE_KEY}.center`}>
              <Panel
                defaultSize={70}
                minSize={20}
                className="border-border/50 bg-card/40 overflow-hidden rounded-xl border"
              >
                <div className="h-full">{props.mainPane}</div>
              </Panel>
              {verticalHandle}
              <Panel
                defaultSize={30}
                minSize={10}
                maxSize={70}
                className="border-border/50 bg-card/40 overflow-hidden rounded-xl border"
              >
                <div className="h-full">{props.bottomPane}</div>
              </Panel>
            </PanelGroup>
          </Panel>

          {horizontalHandle}

          <Panel defaultSize={26} minSize={14} maxSize={42}>
            <PanelGroup direction="vertical" autoSaveId={`${PANEL_STORAGE_KEY}.right`}>
              <Panel
                defaultSize={70}
                minSize={20}
                className="border-border/50 bg-card/40 overflow-hidden rounded-xl border"
              >
                <div className="h-full">{props.rightPane}</div>
              </Panel>
              {verticalHandle}
              <Panel
                defaultSize={30}
                minSize={10}
                maxSize={70}
                className="border-border/50 bg-card/40 overflow-hidden rounded-xl border"
              >
                <div className="h-full">{props.bottomRightPane}</div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </main>

      {props.statusBar}
    </div>
  );
}
