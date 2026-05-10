import type { ReactElement } from 'react';
import {
  ChevronDown,
  Heart,
  Home,
  Image as ImageIcon,
  Menu,
  MoreVertical,
  Play,
  Plus,
  Search,
  User
} from 'lucide-react';
import type { CanvasComponentType } from './types';
import type { CodegenTarget } from './codegen/index';

/**
 * Per-target visual preview for a palette item. Each preview is a fixed-height
 * card (56px) approximating the look of the widget on the active target so
 * users see what they're about to drag — Figma / Android Studio style.
 *
 * Themes:
 * - android-xml -> Material 3 (#6750A4 primary, surface #1C1B1F)
 * - react-native -> iOS (system blue #007AFF, rounded-[10px])
 * - flutter -> Material 2 (blue #1976D2)
 * - react -> Tailwind cyan-500 to match canvas defaults
 */
export function renderPalettePreview(type: CanvasComponentType, target: CodegenTarget): ReactElement {
  switch (target) {
    case 'android-xml':
      return renderAndroid(type);
    case 'react-native':
      return renderRN(type);
    case 'flutter':
      return renderFlutter(type);
    case 'react':
    default:
      return renderReact(type);
  }
}

function frame(children: ReactElement, surface = 'bg-[#0F1115]'): ReactElement {
  return (
    <div className={`relative h-14 w-full overflow-hidden ${surface}`} aria-hidden>
      {children}
    </div>
  );
}

const TILE_LAYOUT_SHELL = 'h-full w-full p-1.5 grid place-items-center';
const TILE_FRAME_BORDER = 'border border-dashed border-white/30 rounded';

function layoutPreview(kind: 'frame' | 'row' | 'column' | 'stack' | 'grid' | 'container'): ReactElement {
  if (kind === 'row') {
    return frame(
      <div className="flex h-full items-center gap-1 p-1.5">
        <span className="h-7 w-6 rounded bg-white/15" />
        <span className="h-7 w-9 rounded bg-white/15" />
        <span className="h-7 flex-1 rounded bg-white/10" />
      </div>
    );
  }
  if (kind === 'column') {
    return frame(
      <div className="flex h-full flex-col gap-1 p-1.5">
        <span className="h-2.5 w-full rounded bg-white/15" />
        <span className="h-2.5 w-full rounded bg-white/15" />
        <span className="h-2.5 w-full rounded bg-white/10" />
      </div>
    );
  }
  if (kind === 'stack') {
    return frame(
      <div className="relative h-full w-full">
        <span className="absolute left-3 top-2 h-8 w-12 rounded bg-white/10" />
        <span className="absolute left-7 top-4 h-8 w-12 rounded bg-cyan-400/40" />
        <span className="absolute left-11 top-3 h-8 w-12 rounded bg-cyan-300/60" />
      </div>
    );
  }
  if (kind === 'grid') {
    return frame(
      <div className="grid h-full grid-cols-3 grid-rows-2 gap-1 p-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className="bg-white/12 rounded" />
        ))}
      </div>
    );
  }
  if (kind === 'frame') {
    return frame(
      <div className="grid h-full place-items-center p-1.5">
        <span className={`grid h-10 w-9 place-items-center rounded ${TILE_FRAME_BORDER}`}>
          <span className="h-2 w-4 rounded-sm bg-white/30" />
        </span>
      </div>
    );
  }
  // container
  return frame(
    <div className={TILE_LAYOUT_SHELL}>
      <span className="h-9 w-12 rounded-md border border-slate-400/40 bg-slate-700/60" />
    </div>
  );
}

/* --------------------------- ANDROID (Material 3) -------------------------- */

const M3_PRIMARY = '#6750A4';
const M3_ON_PRIMARY = '#FFFFFF';
const M3_SURFACE = '#1C1B1F';
const M3_ON_SURFACE = '#E6E1E5';
const M3_OUTLINE = '#79747E';
const M3_SURFACE_VARIANT = '#49454F';

function renderAndroid(type: CanvasComponentType): ReactElement {
  const surface = `bg-[${M3_SURFACE}]`;
  switch (type) {
    case 'frame':
    case 'row':
    case 'column':
    case 'stack':
    case 'grid':
    case 'container':
      return layoutPreview(type);
    case 'card':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="h-10 w-24 rounded-md shadow-md"
            style={{ background: M3_SURFACE_VARIANT, color: M3_ON_SURFACE }}
          />
        </div>,
        surface
      );
    case 'button':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="rounded-[20px] px-4 py-1 text-[10px] font-medium uppercase tracking-wider"
            style={{ background: M3_PRIMARY, color: M3_ON_PRIMARY }}
          >
            Button
          </span>
        </div>,
        surface
      );
    case 'fab':
      return frame(
        <div className="flex h-full items-end justify-end p-2">
          <span
            className="grid h-9 w-9 place-items-center rounded-2xl shadow-lg"
            style={{ background: M3_PRIMARY, color: M3_ON_PRIMARY }}
          >
            <Plus className="h-4 w-4" />
          </span>
        </div>,
        surface
      );
    case 'appbar':
      return frame(
        <div
          className="flex h-full items-center px-2"
          style={{ background: M3_PRIMARY, color: M3_ON_PRIMARY }}
        >
          <Menu className="h-3.5 w-3.5" />
          <span className="ml-2 text-[10px] font-medium">Title</span>
          <MoreVertical className="ml-auto h-3.5 w-3.5" />
        </div>,
        surface
      );
    case 'navbar':
      return renderAndroid('appbar');
    case 'bottomnav':
      return frame(
        <div
          className="grid h-full grid-cols-3 items-center"
          style={{ background: '#211F26', borderTop: `1px solid ${M3_SURFACE_VARIANT}` }}
        >
          {[Home, Search, User].map((Icon, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <Icon className="h-3.5 w-3.5" style={{ color: i === 0 ? M3_PRIMARY : M3_OUTLINE }} />
              <span className="text-[8px]" style={{ color: i === 0 ? M3_ON_SURFACE : M3_OUTLINE }}>
                {['Home', 'Search', 'You'][i]}
              </span>
            </div>
          ))}
        </div>,
        surface
      );
    case 'input':
      return frame(
        <div className="grid h-full place-items-center px-3">
          <div
            className="flex h-9 w-full items-center rounded-t border-b-2 px-2"
            style={{ background: '#2B2930', borderColor: M3_PRIMARY, color: M3_ON_SURFACE }}
          >
            <span className="text-[10px] opacity-70">Label</span>
          </div>
        </div>,
        surface
      );
    case 'select':
      return frame(
        <div className="grid h-full place-items-center px-3">
          <div
            className="flex h-9 w-full items-center justify-between rounded-md border px-2"
            style={{ borderColor: M3_OUTLINE, color: M3_ON_SURFACE }}
          >
            <span className="text-[10px]">Option 1</span>
            <ChevronDown className="h-3 w-3" />
          </div>
        </div>,
        surface
      );
    case 'checkbox':
      return frame(
        <div className="flex h-full items-center gap-2 px-3" style={{ color: M3_ON_SURFACE }}>
          <span className="grid h-4 w-4 place-items-center rounded-sm" style={{ background: M3_PRIMARY }}>
            <span className="h-1 w-2 rotate-[-45deg] border-b-2 border-l-2 border-white" />
          </span>
          <span className="text-[10px]">Checkbox</span>
        </div>,
        surface
      );
    case 'switch':
      return frame(
        <div className="flex h-full items-center gap-2 px-3" style={{ color: M3_ON_SURFACE }}>
          <span
            className="relative inline-flex h-4 w-7 items-center rounded-full"
            style={{ background: M3_PRIMARY }}
          >
            <span className="absolute right-0.5 h-3 w-3 rounded-full bg-white" />
          </span>
          <span className="text-[10px]">Switch</span>
        </div>,
        surface
      );
    case 'radio':
      return frame(
        <div className="flex h-full items-center gap-2 px-3" style={{ color: M3_ON_SURFACE }}>
          <span
            className="grid h-4 w-4 place-items-center rounded-full border-2"
            style={{ borderColor: M3_PRIMARY }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: M3_PRIMARY }} />
          </span>
          <span className="text-[10px]">Radio</span>
        </div>,
        surface
      );
    case 'slider':
      return frame(
        <div className="flex h-full items-center px-3">
          <div className="relative h-1 w-full rounded-full" style={{ background: M3_SURFACE_VARIANT }}>
            <span
              className="absolute left-0 top-0 h-1 w-1/2 rounded-full"
              style={{ background: M3_PRIMARY }}
            />
            <span
              className="absolute -top-1.5 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full"
              style={{ background: M3_PRIMARY }}
            />
          </div>
        </div>,
        surface
      );
    case 'progress':
      return frame(
        <div className="flex h-full items-center px-3">
          <div className="relative h-1 w-full rounded-full" style={{ background: M3_SURFACE_VARIANT }}>
            <span
              className="absolute left-0 top-0 h-1 w-3/5 rounded-full"
              style={{ background: M3_PRIMARY }}
            />
          </div>
        </div>,
        surface
      );
    case 'text':
      return frame(
        <div className="grid h-full place-items-center" style={{ color: M3_ON_SURFACE }}>
          <span className="text-base font-semibold tracking-wide">Aa</span>
        </div>,
        surface
      );
    case 'badge':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{ background: '#B3261E', color: '#FFF' }}
          >
            3
          </span>
        </div>,
        surface
      );
    case 'chip':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px]"
            style={{ borderColor: M3_OUTLINE, color: M3_ON_SURFACE }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: M3_PRIMARY }} />
            Filter
          </span>
        </div>,
        surface
      );
    case 'alert':
      return frame(
        <div
          className="flex h-full items-center gap-2 px-3"
          style={{ background: '#322F37', color: M3_ON_SURFACE }}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: '#F2B8B5' }} />
          <span className="text-[10px]">Snackbar message</span>
          <span className="ml-auto text-[10px] uppercase" style={{ color: M3_PRIMARY }}>
            Action
          </span>
        </div>,
        surface
      );
    case 'modal':
      return frame(
        <div className="grid h-full place-items-center">
          <span className="h-9 w-28 rounded-lg shadow-lg" style={{ background: M3_SURFACE_VARIANT }} />
        </div>,
        surface
      );
    case 'image':
    case 'imageview':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="grid h-9 w-12 place-items-center rounded"
            style={{ background: M3_SURFACE_VARIANT, color: M3_ON_SURFACE }}
          >
            <ImageIcon className="h-4 w-4" />
          </span>
        </div>,
        surface
      );
    case 'videoview':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="grid h-9 w-14 place-items-center rounded"
            style={{ background: '#000', color: '#FFF' }}
          >
            <Play className="h-3.5 w-3.5" />
          </span>
        </div>,
        surface
      );
    case 'list':
      return frame(
        <div className="flex h-full flex-col justify-center gap-1 px-2" style={{ color: M3_ON_SURFACE }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: M3_SURFACE_VARIANT }} />
              <span className="h-1.5 flex-1 rounded" style={{ background: M3_SURFACE_VARIANT }} />
            </div>
          ))}
        </div>,
        surface
      );
    default:
      return frame(<div />);
  }
}

/* ----------------------------- REACT NATIVE (iOS) -------------------------- */

const IOS_BLUE = '#007AFF';
const IOS_GREEN = '#34C759';
const IOS_BG = '#0B0B0F';
const IOS_CARD = '#1C1C1E';
const IOS_LABEL = '#F2F2F7';
const IOS_GRAY = '#3A3A3C';

function renderRN(type: CanvasComponentType): ReactElement {
  const surface = `bg-[${IOS_BG}]`;
  switch (type) {
    case 'frame':
    case 'row':
    case 'column':
    case 'stack':
    case 'grid':
    case 'container':
      return layoutPreview(type);
    case 'card':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="h-10 w-24 rounded-[12px]"
            style={{ background: IOS_CARD, boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}
          />
        </div>,
        surface
      );
    case 'button':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="rounded-[10px] px-4 py-1.5 text-[10px] font-semibold"
            style={{ background: IOS_BLUE, color: '#FFF' }}
          >
            Button
          </span>
        </div>,
        surface
      );
    case 'fab':
      return frame(
        <div className="flex h-full items-end justify-end p-2">
          <span
            className="grid h-9 w-9 place-items-center rounded-full shadow-lg"
            style={{ background: IOS_BLUE, color: '#FFF' }}
          >
            <Plus className="h-4 w-4" />
          </span>
        </div>,
        surface
      );
    case 'appbar':
    case 'navbar':
      return frame(
        <div
          className="flex h-full items-center px-2"
          style={{ background: IOS_CARD, color: IOS_LABEL, borderBottom: `1px solid ${IOS_GRAY}` }}
        >
          <span className="text-[10px]" style={{ color: IOS_BLUE }}>
            Back
          </span>
          <span className="mx-auto text-[10px] font-semibold">Title</span>
          <span className="text-[10px]" style={{ color: IOS_BLUE }}>
            Done
          </span>
        </div>,
        surface
      );
    case 'bottomnav':
      return frame(
        <div
          className="grid h-full grid-cols-3 items-center"
          style={{ background: IOS_CARD, borderTop: `1px solid ${IOS_GRAY}` }}
        >
          {[Home, Search, User].map((Icon, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <Icon className="h-3.5 w-3.5" style={{ color: i === 0 ? IOS_BLUE : '#8E8E93' }} />
              <span className="text-[8px]" style={{ color: i === 0 ? IOS_BLUE : '#8E8E93' }}>
                {['Home', 'Search', 'Me'][i]}
              </span>
            </div>
          ))}
        </div>,
        surface
      );
    case 'input':
      return frame(
        <div className="grid h-full place-items-center px-3">
          <div
            className="flex h-8 w-full items-center rounded-[10px] px-2"
            style={{ background: IOS_GRAY, color: IOS_LABEL }}
          >
            <Search className="mr-1 h-3 w-3 opacity-70" />
            <span className="text-[10px] opacity-70">Search</span>
          </div>
        </div>,
        surface
      );
    case 'select':
      return frame(
        <div className="grid h-full place-items-center px-3">
          <div
            className="flex h-8 w-full items-center justify-between rounded-[10px] px-2"
            style={{ background: IOS_CARD, color: IOS_LABEL }}
          >
            <span className="text-[10px]">Option</span>
            <ChevronDown className="h-3 w-3 opacity-70" />
          </div>
        </div>,
        surface
      );
    case 'checkbox':
      return frame(
        <div className="flex h-full items-center gap-2 px-3" style={{ color: IOS_LABEL }}>
          <span
            className="grid h-4 w-4 place-items-center rounded"
            style={{ background: IOS_BLUE, color: '#FFF' }}
          >
            <span className="h-1 w-2 rotate-[-45deg] border-b-2 border-l-2 border-white" />
          </span>
          <span className="text-[10px]">Checkbox</span>
        </div>,
        surface
      );
    case 'switch':
      return frame(
        <div className="flex h-full items-center gap-2 px-3" style={{ color: IOS_LABEL }}>
          <span
            className="relative inline-flex h-4 w-7 items-center rounded-full px-0.5"
            style={{ background: IOS_GREEN }}
          >
            <span className="ml-auto h-3 w-3 rounded-full bg-white" />
          </span>
          <span className="text-[10px]">Switch</span>
        </div>,
        surface
      );
    case 'radio':
      return frame(
        <div className="flex h-full items-center gap-2 px-3" style={{ color: IOS_LABEL }}>
          <span
            className="grid h-4 w-4 place-items-center rounded-full border-2"
            style={{ borderColor: IOS_BLUE }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: IOS_BLUE }} />
          </span>
          <span className="text-[10px]">Radio</span>
        </div>,
        surface
      );
    case 'slider':
      return frame(
        <div className="flex h-full items-center px-3">
          <div className="relative h-1 w-full rounded-full" style={{ background: IOS_GRAY }}>
            <span className="absolute left-0 top-0 h-1 w-1/2 rounded-full" style={{ background: IOS_BLUE }} />
            <span className="absolute -top-1.5 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-white shadow" />
          </div>
        </div>,
        surface
      );
    case 'progress':
      return frame(
        <div className="flex h-full items-center px-3">
          <div className="relative h-1 w-full rounded-full" style={{ background: IOS_GRAY }}>
            <span className="absolute left-0 top-0 h-1 w-3/5 rounded-full" style={{ background: IOS_BLUE }} />
          </div>
        </div>,
        surface
      );
    case 'text':
      return frame(
        <div className="grid h-full place-items-center" style={{ color: IOS_LABEL }}>
          <span className="text-base font-semibold">Aa</span>
        </div>,
        surface
      );
    case 'badge':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
            style={{ background: '#FF3B30', color: '#FFF' }}
          >
            12
          </span>
        </div>,
        surface
      );
    case 'chip':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]"
            style={{ background: IOS_CARD, color: IOS_LABEL, border: `1px solid ${IOS_GRAY}` }}
          >
            <Heart className="h-3 w-3" style={{ color: IOS_BLUE }} />
            Tag
          </span>
        </div>,
        surface
      );
    case 'alert':
      return frame(
        <div
          className="flex h-full items-center gap-2 px-3"
          style={{ background: IOS_CARD, color: IOS_LABEL, border: `1px solid ${IOS_GRAY}` }}
        >
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-[10px]">Notice</span>
        </div>,
        surface
      );
    case 'modal':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="h-9 w-24 rounded-[14px]"
            style={{ background: IOS_CARD, boxShadow: '0 4px 12px rgba(0,0,0,0.45)' }}
          />
        </div>,
        surface
      );
    case 'image':
    case 'imageview':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="grid h-9 w-12 place-items-center rounded-[8px]"
            style={{ background: IOS_GRAY, color: '#FFF' }}
          >
            <ImageIcon className="h-4 w-4" />
          </span>
        </div>,
        surface
      );
    case 'videoview':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="grid h-9 w-14 place-items-center rounded-[8px]"
            style={{ background: '#000', color: '#FFF' }}
          >
            <Play className="h-3.5 w-3.5" />
          </span>
        </div>,
        surface
      );
    case 'list':
      return frame(
        <div className="flex h-full flex-col justify-center gap-1 px-2" style={{ color: IOS_LABEL }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: IOS_GRAY }} />
              <span className="h-1.5 flex-1 rounded" style={{ background: IOS_GRAY }} />
            </div>
          ))}
        </div>,
        surface
      );
    default:
      return frame(<div />);
  }
}

/* ------------------------------ FLUTTER (M2) ------------------------------- */

const FL_BLUE = '#1976D2';
const FL_BG = '#0D1117';
const FL_CARD = '#161B22';
const FL_FG = '#E6EDF3';
const FL_MUTED = '#8B949E';

function renderFlutter(type: CanvasComponentType): ReactElement {
  const surface = `bg-[${FL_BG}]`;
  switch (type) {
    case 'frame':
    case 'row':
    case 'column':
    case 'stack':
    case 'grid':
    case 'container':
      return layoutPreview(type);
    case 'card':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="h-10 w-24 rounded-[4px]"
            style={{ background: FL_CARD, boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          />
        </div>,
        surface
      );
    case 'button':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="rounded-[4px] px-4 py-1 text-[10px] font-medium uppercase tracking-wider shadow"
            style={{ background: FL_BLUE, color: '#FFF' }}
          >
            Button
          </span>
        </div>,
        surface
      );
    case 'fab':
      return frame(
        <div className="flex h-full items-end justify-end p-2">
          <span
            className="grid h-9 w-9 place-items-center rounded-full shadow-lg"
            style={{ background: FL_BLUE, color: '#FFF' }}
          >
            <Plus className="h-4 w-4" />
          </span>
        </div>,
        surface
      );
    case 'appbar':
    case 'navbar':
      return frame(
        <div
          className="flex h-full items-center px-2 shadow-sm"
          style={{ background: FL_BLUE, color: '#FFF' }}
        >
          <Menu className="h-3.5 w-3.5" />
          <span className="ml-2 text-[10px] font-medium">AppBar</span>
          <MoreVertical className="ml-auto h-3.5 w-3.5" />
        </div>,
        surface
      );
    case 'bottomnav':
      return frame(
        <div
          className="grid h-full grid-cols-3 items-center"
          style={{ background: FL_CARD, borderTop: `1px solid ${FL_MUTED}` }}
        >
          {[Home, Search, User].map((Icon, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <Icon className="h-3.5 w-3.5" style={{ color: i === 0 ? FL_BLUE : FL_MUTED }} />
              <span className="text-[8px]" style={{ color: i === 0 ? FL_BLUE : FL_MUTED }}>
                {['Home', 'Search', 'You'][i]}
              </span>
            </div>
          ))}
        </div>,
        surface
      );
    case 'input':
      return frame(
        <div className="grid h-full place-items-center px-3">
          <div
            className="flex h-8 w-full items-center rounded-[4px] border px-2"
            style={{ borderColor: FL_BLUE, color: FL_FG }}
          >
            <span className="text-[10px] opacity-80">Label</span>
          </div>
        </div>,
        surface
      );
    case 'select':
      return frame(
        <div className="grid h-full place-items-center px-3">
          <div
            className="flex h-8 w-full items-center justify-between border-b px-2"
            style={{ borderColor: FL_MUTED, color: FL_FG }}
          >
            <span className="text-[10px]">Dropdown</span>
            <ChevronDown className="h-3 w-3" />
          </div>
        </div>,
        surface
      );
    case 'checkbox':
      return frame(
        <div className="flex h-full items-center gap-2 px-3" style={{ color: FL_FG }}>
          <span className="grid h-4 w-4 place-items-center rounded-sm" style={{ background: FL_BLUE }}>
            <span className="h-1 w-2 rotate-[-45deg] border-b-2 border-l-2 border-white" />
          </span>
          <span className="text-[10px]">Checkbox</span>
        </div>,
        surface
      );
    case 'switch':
      return frame(
        <div className="flex h-full items-center gap-2 px-3" style={{ color: FL_FG }}>
          <span
            className="relative inline-flex h-4 w-7 items-center rounded-full"
            style={{ background: FL_BLUE }}
          >
            <span className="absolute right-0.5 h-3.5 w-3.5 rounded-full bg-white shadow" />
          </span>
          <span className="text-[10px]">Switch</span>
        </div>,
        surface
      );
    case 'radio':
      return frame(
        <div className="flex h-full items-center gap-2 px-3" style={{ color: FL_FG }}>
          <span
            className="grid h-4 w-4 place-items-center rounded-full border-2"
            style={{ borderColor: FL_BLUE }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: FL_BLUE }} />
          </span>
          <span className="text-[10px]">Radio</span>
        </div>,
        surface
      );
    case 'slider':
      return frame(
        <div className="flex h-full items-center px-3">
          <div className="relative h-1 w-full rounded-full" style={{ background: FL_MUTED }}>
            <span className="absolute left-0 top-0 h-1 w-1/2 rounded-full" style={{ background: FL_BLUE }} />
            <span
              className="absolute -top-1.5 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full"
              style={{ background: FL_BLUE }}
            />
          </div>
        </div>,
        surface
      );
    case 'progress':
      return frame(
        <div className="flex h-full items-center px-3">
          <div className="relative h-1 w-full rounded-full" style={{ background: FL_MUTED }}>
            <span className="absolute left-0 top-0 h-1 w-3/5 rounded-full" style={{ background: FL_BLUE }} />
          </div>
        </div>,
        surface
      );
    case 'text':
      return frame(
        <div className="grid h-full place-items-center" style={{ color: FL_FG }}>
          <span className="text-base font-semibold">Aa</span>
        </div>,
        surface
      );
    case 'badge':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-bold"
            style={{ background: '#E53935', color: '#FFF' }}
          >
            7
          </span>
        </div>,
        surface
      );
    case 'chip':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px]"
            style={{ background: FL_CARD, color: FL_FG, border: `1px solid ${FL_MUTED}` }}
          >
            <Heart className="h-3 w-3" style={{ color: FL_BLUE }} />
            Chip
          </span>
        </div>,
        surface
      );
    case 'alert':
      return frame(
        <div
          className="flex h-full items-center gap-2 px-3"
          style={{ background: FL_CARD, color: FL_FG, border: `1px solid ${FL_MUTED}` }}
        >
          <span className="h-2 w-2 rounded-full bg-blue-400" />
          <span className="text-[10px]">SnackBar</span>
        </div>,
        surface
      );
    case 'modal':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="h-9 w-24 rounded-[4px]"
            style={{ background: FL_CARD, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
          />
        </div>,
        surface
      );
    case 'image':
    case 'imageview':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="grid h-9 w-12 place-items-center rounded-[4px]"
            style={{ background: FL_MUTED, color: '#FFF' }}
          >
            <ImageIcon className="h-4 w-4" />
          </span>
        </div>,
        surface
      );
    case 'videoview':
      return frame(
        <div className="grid h-full place-items-center">
          <span
            className="grid h-9 w-14 place-items-center rounded-[4px]"
            style={{ background: '#000', color: '#FFF' }}
          >
            <Play className="h-3.5 w-3.5" />
          </span>
        </div>,
        surface
      );
    case 'list':
      return frame(
        <div className="flex h-full flex-col justify-center gap-1 px-2" style={{ color: FL_FG }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: FL_MUTED }} />
              <span className="h-1.5 flex-1 rounded" style={{ background: FL_MUTED }} />
            </div>
          ))}
        </div>,
        surface
      );
    default:
      return frame(<div />);
  }
}

/* -------------------------------- REACT (web) ------------------------------ */

function renderReact(type: CanvasComponentType): ReactElement {
  switch (type) {
    case 'frame':
    case 'row':
    case 'column':
    case 'stack':
    case 'grid':
    case 'container':
      return layoutPreview(type);
    case 'card':
      return frame(
        <div className="grid h-full place-items-center">
          <span className="h-10 w-24 rounded-lg border border-slate-500/30 bg-slate-900/80 shadow" />
        </div>
      );
    case 'button':
      return frame(
        <div className="grid h-full place-items-center">
          <span className="rounded-md bg-cyan-500 px-3 py-1 text-[10px] font-medium text-white">
            Click Me
          </span>
        </div>
      );
    case 'fab':
      return frame(
        <div className="flex h-full items-end justify-end p-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-cyan-500 text-white shadow-lg">
            <Plus className="h-4 w-4" />
          </span>
        </div>
      );
    case 'appbar':
    case 'navbar':
      return frame(
        <div className="flex h-full items-center justify-between rounded-md border border-white/10 bg-slate-900/80 px-2">
          <span className="text-[10px] font-semibold text-slate-100">My App</span>
          <span className="text-[9px] text-slate-400">Home · Docs · Login</span>
        </div>
      );
    case 'bottomnav':
      return frame(
        <div className="grid h-full grid-cols-3 items-center border-t border-white/10 bg-slate-900/80">
          {['Home', 'Search', 'Me'].map((label, i) => (
            <span
              key={label}
              className={`text-center text-[9px] ${i === 0 ? 'text-cyan-300' : 'text-slate-400'}`}
            >
              {label}
            </span>
          ))}
        </div>
      );
    case 'input':
      return frame(
        <div className="grid h-full place-items-center px-3">
          <div className="flex h-8 w-full items-center rounded-md border border-slate-500/40 bg-slate-800 px-2 text-[10px] text-slate-300">
            Enter text…
          </div>
        </div>
      );
    case 'select':
      return frame(
        <div className="grid h-full place-items-center px-3">
          <div className="flex h-8 w-full items-center justify-between rounded-md border border-slate-500/40 bg-slate-800 px-2 text-[10px] text-slate-200">
            Option 1
            <ChevronDown className="h-3 w-3" />
          </div>
        </div>
      );
    case 'checkbox':
      return frame(
        <div className="flex h-full items-center gap-2 px-3 text-slate-100">
          <span className="grid h-4 w-4 place-items-center rounded-sm bg-cyan-500">
            <span className="h-1 w-2 rotate-[-45deg] border-b-2 border-l-2 border-white" />
          </span>
          <span className="text-[10px]">Check me</span>
        </div>
      );
    case 'switch':
      return frame(
        <div className="flex h-full items-center gap-2 px-3 text-slate-100">
          <span className="relative inline-flex h-4 w-7 items-center rounded-full bg-cyan-500">
            <span className="absolute right-0.5 h-3 w-3 rounded-full bg-white" />
          </span>
          <span className="text-[10px]">Enable</span>
        </div>
      );
    case 'radio':
      return frame(
        <div className="flex h-full items-center gap-2 px-3 text-slate-100">
          <span className="grid h-4 w-4 place-items-center rounded-full border-2 border-cyan-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
          </span>
          <span className="text-[10px]">Option A</span>
        </div>
      );
    case 'slider':
      return frame(
        <div className="flex h-full items-center px-3">
          <div className="relative h-1 w-full rounded-full bg-slate-700">
            <span className="absolute left-0 top-0 h-1 w-1/2 rounded-full bg-cyan-500" />
            <span className="absolute -top-1.5 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-cyan-400" />
          </div>
        </div>
      );
    case 'progress':
      return frame(
        <div className="flex h-full items-center px-3">
          <div className="relative h-1 w-full rounded-full bg-slate-700">
            <span className="absolute left-0 top-0 h-1 w-3/5 rounded-full bg-cyan-500" />
          </div>
        </div>
      );
    case 'text':
      return frame(
        <div className="grid h-full place-items-center text-slate-100">
          <span className="text-base font-semibold">Heading</span>
        </div>
      );
    case 'badge':
      return frame(
        <div className="grid h-full place-items-center">
          <span className="inline-flex items-center rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-medium text-cyan-300">
            Badge
          </span>
        </div>
      );
    case 'chip':
      return frame(
        <div className="grid h-full place-items-center">
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-medium text-cyan-100">
            <Heart className="h-3 w-3" />
            Tag
          </span>
        </div>
      );
    case 'alert':
      return frame(
        <div className="flex h-full items-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 text-[10px] text-blue-200">
          ⓘ Alert message
        </div>
      );
    case 'modal':
      return frame(
        <div className="grid h-full place-items-center">
          <span className="h-9 w-24 rounded-xl border border-white/10 bg-slate-900 shadow-2xl" />
        </div>
      );
    case 'image':
    case 'imageview':
      return frame(
        <div className="grid h-full place-items-center">
          <span className="grid h-9 w-12 place-items-center rounded-md bg-slate-700 text-slate-200">
            <ImageIcon className="h-4 w-4" />
          </span>
        </div>
      );
    case 'videoview':
      return frame(
        <div className="grid h-full place-items-center">
          <span className="grid h-9 w-14 place-items-center rounded-md bg-black text-white">
            <Play className="h-3.5 w-3.5" />
          </span>
        </div>
      );
    case 'list':
      return frame(
        <div className="flex h-full flex-col justify-center gap-1 px-2 text-slate-200">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-600" />
              <span className="h-1.5 flex-1 rounded bg-slate-700" />
            </div>
          ))}
        </div>
      );
    default:
      return frame(<div />);
  }
}
