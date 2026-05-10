import { useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { useCanvasStore } from './store';
import { usePagesStore } from '@/renderer/state/pages-store';

function styleFromNode(
  x: number,
  y: number,
  width?: number,
  height?: number,
  backgroundColor?: string,
  padding?: number
): CSSProperties {
  return {
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
    backgroundColor,
    padding
  };
}

export function CanvasPreview(): ReactElement {
  const nodes = useCanvasStore((state) => state.nodes);
  const pages = usePagesStore((state) => state.pages);
  const activePageId = usePagesStore((state) => state.activePageId);
  const [runtimePageId, setRuntimePageId] = useState<string>(activePageId);

  const currentPageId = runtimePageId || activePageId;
  const visibleNodes = useMemo(
    () => nodes.filter((node) => (node.data.props.pageId ?? activePageId) === currentPageId),
    [activePageId, currentPageId, nodes]
  );

  return (
    <div className="relative h-full overflow-auto rounded-lg border border-white/10 bg-slate-950 p-3">
      <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wide">Live Preview</p>
      <div className="relative min-h-[560px] rounded-md border border-slate-500/30 bg-slate-900">
        {pages.length > 1 ? (
          <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1.5">
            {pages.map((page) => (
              <button
                key={page.id}
                type="button"
                className={
                  page.id === currentPageId
                    ? 'rounded bg-cyan-500/30 px-2 py-0.5 text-[10px] text-cyan-100'
                    : 'rounded bg-white/10 px-2 py-0.5 text-[10px] text-slate-300'
                }
                onClick={() => setRuntimePageId(page.id)}
              >
                {page.name}
              </button>
            ))}
          </div>
        ) : null}

        {visibleNodes.map((node) => {
          const props = node.data.props;
          const style = styleFromNode(
            node.position.x,
            node.position.y,
            props.width,
            props.height,
            props.backgroundColor,
            props.padding
          );

          if (node.data.componentType === 'button') {
            return (
              <button
                key={node.id}
                type="button"
                style={style}
                aria-label={props.ariaLabel ?? node.data.label}
                className={props.className ?? 'rounded-md bg-cyan-500 px-3 py-2 text-white'}
                onClick={() => {
                  if (props.onClickAction === 'navigate' && props.targetPageId) {
                    setRuntimePageId(props.targetPageId);
                    return;
                  }
                  if (props.onClickAction === 'custom' && props.onClickHandlerCode) {
                    try {
                      const fn = new Function('state', props.onClickHandlerCode);
                      fn({ currentPageId, setCurrentPageId: setRuntimePageId });
                    } catch {
                      // Keep preview resilient even when custom code fails.
                    }
                  }
                }}
              >
                {props.text ?? node.data.label}
              </button>
            );
          }

          if (node.data.componentType === 'container') {
            return (
              <div
                key={node.id}
                style={style}
                className={props.className ?? 'rounded-lg border border-slate-500/40 bg-slate-800/70'}
              >
                <span className="text-sm text-slate-300">{node.data.label}</span>
              </div>
            );
          }

          if (node.data.componentType === 'text') {
            return (
              <p
                key={node.id}
                style={style}
                className={props.className ?? 'text-base font-medium text-slate-100'}
              >
                {props.text ?? node.data.label}
              </p>
            );
          }

          if (node.data.componentType === 'image' || node.data.componentType === 'imageview') {
            return (
              <img
                key={node.id}
                style={style}
                className={props.className ?? 'rounded-md object-cover'}
                src={props.src ?? 'https://picsum.photos/420/240'}
                alt={props.ariaLabel ?? node.data.label}
              />
            );
          }

          if (node.data.componentType === 'videoview') {
            return (
              <video
                key={node.id}
                style={style}
                className={props.className ?? 'rounded-md bg-black'}
                aria-label={props.ariaLabel ?? node.data.label}
                controls
              />
            );
          }

          if (node.data.componentType === 'fab') {
            return (
              <button
                key={node.id}
                type="button"
                style={style}
                aria-label={props.ariaLabel ?? node.data.label}
                className={
                  props.className ??
                  'grid h-14 w-14 place-items-center rounded-full bg-cyan-500 text-white shadow-lg'
                }
              >
                +
              </button>
            );
          }

          if (node.data.componentType === 'appbar' || node.data.componentType === 'navbar') {
            return (
              <nav
                key={node.id}
                style={style}
                aria-label={props.ariaLabel ?? node.data.label}
                className={
                  props.className ??
                  'flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/90 px-4 py-3 text-slate-100'
                }
              >
                <span className="font-semibold">{props.text ?? node.data.label}</span>
              </nav>
            );
          }

          if (node.data.componentType === 'bottomnav') {
            const items = props.items ?? ['Home', 'Search', 'Profile'];
            return (
              <nav
                key={node.id}
                style={style}
                aria-label={props.ariaLabel ?? node.data.label}
                className={
                  props.className ??
                  'grid grid-cols-3 items-center rounded-lg border-t border-white/10 bg-slate-900/90 py-2 text-slate-100'
                }
              >
                {items.map((label, i) => (
                  <span
                    key={label + i}
                    className={
                      i === 0 ? 'text-center text-xs text-cyan-300' : 'text-center text-xs text-slate-400'
                    }
                  >
                    {label}
                  </span>
                ))}
              </nav>
            );
          }

          if (node.data.componentType === 'chip') {
            return (
              <span
                key={node.id}
                style={style}
                aria-label={props.ariaLabel ?? node.data.label}
                className={
                  props.className ??
                  'inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-100'
                }
              >
                {props.text ?? node.data.label}
              </span>
            );
          }

          if (node.data.componentType === 'radio') {
            return (
              <label
                key={node.id}
                style={style}
                className={props.className ?? 'flex items-center gap-2 text-sm text-slate-100'}
              >
                <input type="radio" defaultChecked={props.checked} readOnly />
                {props.text ?? node.data.label}
              </label>
            );
          }

          if (node.data.componentType === 'slider') {
            return (
              <input
                key={node.id}
                type="range"
                style={style}
                aria-label={props.ariaLabel ?? node.data.label}
                className={props.className ?? 'w-full accent-cyan-500'}
                min={props.min ?? 0}
                max={props.max ?? 100}
                defaultValue={props.value ?? 0}
                readOnly
              />
            );
          }

          if (node.data.componentType === 'progress') {
            return (
              <progress
                key={node.id}
                style={style}
                aria-label={props.ariaLabel ?? node.data.label}
                className={props.className ?? 'w-full'}
                max={props.max ?? 100}
                value={props.value ?? 0}
              />
            );
          }

          if (node.data.componentType === 'list') {
            const items = props.items ?? ['List item 1', 'List item 2', 'List item 3'];
            return (
              <ul
                key={node.id}
                style={style}
                aria-label={props.ariaLabel ?? node.data.label}
                className={
                  props.className ??
                  'divide-y divide-white/10 rounded border border-white/10 bg-slate-900/70 text-sm text-slate-100'
                }
              >
                {items.map((label, i) => (
                  <li key={label + i} className="px-3 py-2">
                    {label}
                  </li>
                ))}
              </ul>
            );
          }

          return (
            <article
              key={node.id}
              style={style}
              className={props.className ?? 'rounded-lg border border-slate-500/30 bg-slate-900/90 p-4'}
            >
              <h3 className="text-sm font-semibold text-slate-100">{props.text ?? node.data.label}</h3>
              <p className="mt-1 text-xs text-slate-400">Generated from Visual Canvas</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
