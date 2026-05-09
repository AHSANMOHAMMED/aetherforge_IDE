import type { CanvasNode, CanvasSerializableNode } from './types';
import type { AppPage } from '@/renderer/state/pages-store';

export const CANVAS_VIRTUAL_PATH = 'virtual://canvas/visual-builder.tsx';
export const CANVAS_VIRTUAL_NAME = 'visual-builder.tsx';

const COMPONENTS_VAR_NAME = 'canvasComponents';

function toSerializable(nodes: CanvasNode[]): CanvasSerializableNode[] {
  return nodes.map((node) => ({
    id: node.id,
    componentType: node.data.componentType,
    label: node.data.label,
    x: Math.round(node.position.x),
    y: Math.round(node.position.y),
    props: node.data.props
  }));
}

export function generateCanvasCode(nodes: CanvasNode[], pages: AppPage[] = []): string {
  const components = JSON.stringify(toSerializable(nodes), null, 2);
  const serializedPages = JSON.stringify(pages, null, 2);

  return `import { useMemo, useState, type CSSProperties } from 'react';

type CanvasComponent = {
  id: string;
  componentType: 'button' | 'container' | 'text' | 'image' | 'card' | 'input' | 'select' | 'checkbox' | 'switch' | 'badge' | 'alert' | 'modal' | 'navbar';
  label: string;
  x: number;
  y: number;
  props: {
    text?: string;
    src?: string;
    className?: string;
    backgroundColor?: string;
    padding?: number;
    width?: number;
    height?: number;
    placeholder?: string;
    checked?: boolean;
    variant?: string;
    href?: string;
    pageId?: string;
    onClickAction?: 'none' | 'navigate' | 'custom';
    targetPageId?: string;
    onClickPrompt?: string;
    onClickHandlerCode?: string;
  };
};

type CanvasPage = {
  id: string;
  name: string;
  path: string;
};

const ${COMPONENTS_VAR_NAME}: CanvasComponent[] = ${components};
const canvasPages: CanvasPage[] = ${serializedPages};

function itemStyle(item: CanvasComponent): CSSProperties {
  return {
    position: 'absolute',
    left: item.x,
    top: item.y,
    width: item.props.width,
    height: item.props.height,
    backgroundColor: item.props.backgroundColor,
    padding: item.props.padding
  };
}

function runCustomHandler(code: string, state: { currentPageId: string; setCurrentPageId: (value: string) => void }): void {
  try {
    const fn = new Function('state', code);
    fn(state);
  } catch (error) {
    console.error('Canvas handler execution failed', error);
  }
}

export default function VisualBuilderGenerated(): JSX.Element {
  const initialPageId = canvasPages[0]?.id ?? 'page-home';
  const [currentPageId, setCurrentPageId] = useState(initialPageId);
  const visibleComponents = useMemo(
    () => ${COMPONENTS_VAR_NAME}.filter((item) => (item.props.pageId ?? initialPageId) === currentPageId),
    [currentPageId, initialPageId]
  );

  return (
    <div className="relative min-h-[720px] rounded-lg border border-slate-500/40 bg-slate-950 p-6">
      {canvasPages.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {canvasPages.map((page) => (
            <button
              key={page.id}
              type="button"
              className={
                page.id === currentPageId
                  ? 'rounded-md bg-cyan-500/20 px-2.5 py-1 text-xs text-cyan-100'
                  : 'rounded-md bg-white/10 px-2.5 py-1 text-xs text-slate-300'
              }
              onClick={() => setCurrentPageId(page.id)}
            >
              {page.name}
            </button>
          ))}
        </div>
      ) : null}

      {visibleComponents.map((item) => {
        const cls = item.props.className ?? '';

        if (item.componentType === 'button') {
          const onClick = () => {
            const action = item.props.onClickAction ?? 'none';
            if (action === 'navigate' && item.props.targetPageId) {
              setCurrentPageId(item.props.targetPageId);
              return;
            }
            if (action === 'custom' && item.props.onClickHandlerCode) {
              runCustomHandler(item.props.onClickHandlerCode, { currentPageId, setCurrentPageId });
            }
          };

          return (
            <button key={item.id} style={itemStyle(item)} className={cls || 'rounded-md bg-cyan-500 px-3 py-2 text-white'} onClick={onClick}>
              {item.props.text ?? item.label}
            </button>
          );
        }
        if (item.componentType === 'container') {
          return (
            <div key={item.id} style={itemStyle(item)} className={cls || 'rounded-lg border border-slate-500/40 bg-slate-800/70'}>
              <span className="text-sm text-slate-300">{item.label}</span>
            </div>
          );
        }
        if (item.componentType === 'text') {
          return (
            <p key={item.id} style={itemStyle(item)} className={cls || 'text-base font-medium text-slate-100'}>
              {item.props.text ?? item.label}
            </p>
          );
        }
        if (item.componentType === 'image') {
          return (
            <img key={item.id} style={itemStyle(item)} className={cls || 'rounded-md object-cover'} src={item.props.src ?? 'https://picsum.photos/420/240'} alt={item.label} />
          );
        }
        if (item.componentType === 'card') {
          return (
            <article key={item.id} style={itemStyle(item)} className={cls || 'rounded-lg border border-slate-500/30 bg-slate-900/90 p-4'}>
              <h3 className="text-sm font-semibold text-slate-100">{item.props.text ?? item.label}</h3>
              <p className="mt-1 text-xs text-slate-400">Generated from Visual Canvas</p>
            </article>
          );
        }
        if (item.componentType === 'input') {
          return (
            <input key={item.id} style={itemStyle(item)} className={cls || 'rounded-md border border-slate-500/40 bg-slate-800 px-3 py-2 text-sm text-slate-100'} placeholder={item.props.placeholder ?? item.label} readOnly />
          );
        }
        if (item.componentType === 'select') {
          return (
            <select key={item.id} style={itemStyle(item)} className={cls || 'rounded-md border border-slate-500/40 bg-slate-800 px-3 py-2 text-sm text-slate-100'}>
              <option>{item.props.text ?? item.label}</option>
            </select>
          );
        }
        if (item.componentType === 'checkbox') {
          return (
            <label key={item.id} style={itemStyle(item)} className={cls || 'flex cursor-pointer items-center gap-2 text-sm text-slate-100'}>
              <input type="checkbox" defaultChecked={item.props.checked} readOnly />
              {item.props.text ?? item.label}
            </label>
          );
        }
        if (item.componentType === 'switch') {
          return (
            <label key={item.id} style={itemStyle(item)} className={cls || 'flex cursor-pointer items-center gap-2 text-sm text-slate-100'}>
              <span className="relative inline-flex h-5 w-9 rounded-full bg-slate-600">
                <span className={\`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition \${item.props.checked ? 'translate-x-4' : ''}\`} />
              </span>
              {item.props.text ?? item.label}
            </label>
          );
        }
        if (item.componentType === 'badge') {
          return (
            <span key={item.id} style={itemStyle(item)} className={cls || 'inline-flex items-center rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-medium text-cyan-300'}>
              {item.props.text ?? item.label}
            </span>
          );
        }
        if (item.componentType === 'alert') {
          return (
            <div key={item.id} style={itemStyle(item)} className={cls || 'rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200'}>
              ℹ {item.props.text ?? item.label}
            </div>
          );
        }
        if (item.componentType === 'modal') {
          return (
            <div key={item.id} style={itemStyle(item)} className={cls || 'rounded-xl border border-white/10 bg-slate-900 shadow-2xl'}>
              <div className="border-b border-white/10 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-100">{item.props.text ?? item.label}</h2>
              </div>
              <div className="p-4 text-xs text-slate-400">Modal content area</div>
            </div>
          );
        }
        if (item.componentType === 'navbar') {
          return (
            <nav key={item.id} style={itemStyle(item)} className={cls || 'flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/90 px-4 py-3'}>
              <span className="font-semibold text-slate-100">{item.props.text ?? item.label}</span>
              <div className="flex gap-4 text-xs text-slate-400">
                <a href="#">Home</a><a href="#">About</a><a href="#">Contact</a>
              </div>
            </nav>
          );
        }
        return <div key={item.id} style={itemStyle(item)} className="rounded border border-dashed border-slate-500/40 p-2 text-xs text-slate-400">{item.label}</div>;
      })}
    </div>
  );
}
`;
}

export function parseCanvasCode(code: string): CanvasSerializableNode[] | null {
  const marker = `const ${COMPONENTS_VAR_NAME}: CanvasComponent[] = `;
  const markerIndex = code.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const arrayStart = code.indexOf('[', markerIndex);
  if (arrayStart === -1) {
    return null;
  }

  const arrayEnd = code.indexOf('];', arrayStart);
  if (arrayEnd === -1) {
    return null;
  }

  try {
    const json = code.slice(arrayStart, arrayEnd + 1);
    const parsed = JSON.parse(json) as CanvasSerializableNode[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
