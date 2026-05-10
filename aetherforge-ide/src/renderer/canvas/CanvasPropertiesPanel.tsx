import { Sparkles } from 'lucide-react';
import { useState, type ChangeEvent, type ReactElement } from 'react';
import { requestLLM } from '@/renderer/ai/providers';
import { useAIStore } from '@/renderer/ai/store';
import { usePagesStore } from '@/renderer/state/pages-store';
import { useCanvasStore } from './store';

function numberValue(event: ChangeEvent<HTMLInputElement>): number | undefined {
  const value = Number(event.target.value);
  return Number.isFinite(value) ? value : undefined;
}

type PropTab = 'all' | 'layout' | 'style' | 'behavior' | 'a11y';

function tabShows(tab: PropTab, ...sections: PropTab[]): boolean {
  if (tab === 'all') {
    return true;
  }
  return sections.includes(tab);
}

export function CanvasPropertiesPanel(): ReactElement {
  const nodes = useCanvasStore((state) => state.nodes);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const updateSelectedNode = useCanvasStore((state) => state.updateSelectedNode);
  const pages = usePagesStore((state) => state.pages);
  const aiSettings = useAIStore((state) => state.settings);
  const [isGeneratingHandler, setIsGeneratingHandler] = useState(false);
  const [propTab, setPropTab] = useState<PropTab>('all');

  const selectedNode = nodes.find((node) => node.id === selectedNodeIds[0]);

  const generateOnClickHandler = async () => {
    if (!selectedNode || selectedNode.data.componentType !== 'button') {
      return;
    }

    const prompt = selectedNode.data.props.onClickPrompt?.trim();
    if (!prompt) {
      return;
    }

    setIsGeneratingHandler(true);
    try {
      const controller = new AbortController();
      const response = await requestLLM({
        settings: aiSettings,
        signal: controller.signal,
        systemPrompt: [
          'You generate JavaScript event handler code for UI buttons.',
          'Return ONLY JavaScript statements for a function body.',
          'Use only browser-safe APIs and avoid imports.',
          'Prefer concise code.'
        ].join('\n'),
        userPrompt: prompt
      });

      const cleaned = response
        .replace(/^```(?:javascript|js)?/i, '')
        .replace(/```$/i, '')
        .trim();

      updateSelectedNode({
        onClickAction: 'custom',
        onClickHandlerCode: cleaned
      });
    } catch {
      // No-op. The provider layer already supports safe fallback text.
    } finally {
      setIsGeneratingHandler(false);
    }
  };

  if (!selectedNode) {
    return (
      <div className="text-muted-foreground p-3 text-sm">
        <p className="text-foreground mb-1 font-medium">Properties</p>
        <p>Select a component on the canvas to edit its properties.</p>
      </div>
    );
  }

  const bgRaw = selectedNode.data.props.backgroundColor ?? '';
  const colorPickerValue = /^#[0-9A-Fa-f]{6}$/.test(bgRaw) ? bgRaw : '#0f172a';

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div>
        <p className="text-foreground text-sm font-semibold">Properties</p>
        <p className="text-muted-foreground text-xs">
          {selectedNode.data.componentType} · {selectedNode.id}
        </p>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-white/10 pb-2">
        {(['all', 'layout', 'style', 'behavior', 'a11y'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={`rounded px-2 py-0.5 text-[10px] uppercase ${propTab === t ? 'bg-cyan-500/20 text-cyan-100' : 'text-muted-foreground hover:bg-white/10'}`}
            onClick={() => setPropTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {tabShows(propTab, 'style') ? (
          <>
            <label className="text-muted-foreground text-xs">
              CSS Classes
              <input
                className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                value={selectedNode.data.props.className ?? ''}
                onChange={(event) => updateSelectedNode({ className: event.target.value })}
              />
            </label>

            {selectedNode.data.componentType === 'image' ? (
              <label className="text-muted-foreground text-xs">
                Image Source
                <input
                  className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                  value={selectedNode.data.props.src ?? ''}
                  onChange={(event) => updateSelectedNode({ src: event.target.value })}
                />
              </label>
            ) : null}

            <label className="text-muted-foreground text-xs">
              Background Color
              <div className="mt-1 flex gap-2">
                <input
                  type="color"
                  aria-label="Pick background color"
                  className="h-9 w-12 cursor-pointer rounded border border-white/15 bg-transparent p-0.5"
                  value={colorPickerValue}
                  onChange={(event) => updateSelectedNode({ backgroundColor: event.target.value })}
                />
                <input
                  className="text-foreground min-w-0 flex-1 rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                  value={bgRaw}
                  onChange={(event) => updateSelectedNode({ backgroundColor: event.target.value })}
                  placeholder="#0f172a or transparent"
                />
              </div>
            </label>
          </>
        ) : null}

        {tabShows(propTab, 'behavior') ? (
          <>
            <label className="text-muted-foreground text-xs">
              Label
              <input
                className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                value={selectedNode.data.label}
                onChange={(event) => updateSelectedNode({}, event.target.value)}
              />
            </label>

            <label className="text-muted-foreground text-xs">
              Text
              <input
                className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                value={selectedNode.data.props.text ?? ''}
                onChange={(event) => updateSelectedNode({ text: event.target.value })}
              />
            </label>

            <label className="text-muted-foreground text-xs">
              Page
              <select
                className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                value={selectedNode.data.props.pageId ?? pages[0]?.id ?? ''}
                onChange={(event) => updateSelectedNode({ pageId: event.target.value })}
              >
                {pages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedNode.data.componentType === 'button' ? (
              <>
                <label className="text-muted-foreground text-xs">
                  On Click Action
                  <select
                    className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                    value={selectedNode.data.props.onClickAction ?? 'none'}
                    onChange={(event) =>
                      updateSelectedNode({
                        onClickAction: event.target.value as 'none' | 'navigate' | 'custom'
                      })
                    }
                  >
                    <option value="none">None</option>
                    <option value="navigate">Navigate To Page</option>
                    <option value="custom">Custom Handler</option>
                  </select>
                </label>

                {(selectedNode.data.props.onClickAction ?? 'none') === 'navigate' ? (
                  <label className="text-muted-foreground text-xs">
                    Target Page
                    <select
                      className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                      value={selectedNode.data.props.targetPageId ?? pages[0]?.id ?? ''}
                      onChange={(event) => updateSelectedNode({ targetPageId: event.target.value })}
                    >
                      {pages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {(selectedNode.data.props.onClickAction ?? 'none') === 'custom' ? (
                  <>
                    <label className="text-muted-foreground text-xs">
                      Handler Prompt
                      <textarea
                        className="text-foreground mt-1 min-h-[70px] w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                        value={selectedNode.data.props.onClickPrompt ?? ''}
                        onChange={(event) => updateSelectedNode({ onClickPrompt: event.target.value })}
                        placeholder="Example: validate input, show success toast, and log analytics event"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={isGeneratingHandler || !(selectedNode.data.props.onClickPrompt ?? '').trim()}
                      className="inline-flex items-center gap-1.5 self-start rounded-md bg-cyan-500/20 px-2.5 py-1.5 text-xs text-cyan-200 disabled:opacity-60"
                      onClick={() => {
                        void generateOnClickHandler();
                      }}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {isGeneratingHandler ? 'Generating...' : 'Generate Handler'}
                    </button>

                    <label className="text-muted-foreground text-xs">
                      Generated Handler Code
                      <textarea
                        className="text-foreground mt-1 min-h-[90px] w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 font-mono text-xs"
                        value={selectedNode.data.props.onClickHandlerCode ?? ''}
                        onChange={(event) => updateSelectedNode({ onClickHandlerCode: event.target.value })}
                        placeholder="console.log('clicked');"
                      />
                    </label>
                  </>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {tabShows(propTab, 'layout') ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="text-muted-foreground text-xs">
              Width
              <input
                type="number"
                className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                value={selectedNode.data.props.width ?? ''}
                onChange={(event) => updateSelectedNode({ width: numberValue(event) })}
              />
            </label>

            <label className="text-muted-foreground text-xs">
              Height
              <input
                type="number"
                className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
                value={selectedNode.data.props.height ?? ''}
                onChange={(event) => updateSelectedNode({ height: numberValue(event) })}
              />
            </label>
          </div>
        ) : null}

        {tabShows(propTab, 'a11y') ? (
          <label className="text-muted-foreground text-xs">
            Accessible name (aria-label)
            <input
              className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
              value={selectedNode.data.props.ariaLabel ?? ''}
              onChange={(event) => updateSelectedNode({ ariaLabel: event.target.value })}
              placeholder="Describe this control for screen readers"
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
