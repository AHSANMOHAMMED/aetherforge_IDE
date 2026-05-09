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

export function CanvasPropertiesPanel(): ReactElement {
  const nodes = useCanvasStore((state) => state.nodes);
  const selectedNodeIds = useCanvasStore((state) => state.selectedNodeIds);
  const updateSelectedNode = useCanvasStore((state) => state.updateSelectedNode);
  const pages = usePagesStore((state) => state.pages);
  const aiSettings = useAIStore((state) => state.settings);
  const [isGeneratingHandler, setIsGeneratingHandler] = useState(false);

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

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div>
        <p className="text-foreground text-sm font-semibold">Properties</p>
        <p className="text-muted-foreground text-xs">
          {selectedNode.data.componentType} · {selectedNode.id}
        </p>
      </div>

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

      <label className="text-muted-foreground text-xs">
        Background Color
        <input
          className="text-foreground mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm"
          value={selectedNode.data.props.backgroundColor ?? ''}
          onChange={(event) => updateSelectedNode({ backgroundColor: event.target.value })}
          placeholder="#0f172a"
        />
      </label>
    </div>
  );
}
