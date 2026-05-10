import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderPalettePreview } from '@/renderer/canvas/PalettePreview';
import type { CanvasComponentType } from '@/renderer/canvas/types';
import type { CodegenTarget } from '@/renderer/canvas/codegen/index';

function html(type: CanvasComponentType, target: CodegenTarget): string {
  return renderToStaticMarkup(renderPalettePreview(type, target));
}

describe('renderPalettePreview', () => {
  it('renders a non-empty preview for every type / target combo', () => {
    const types: CanvasComponentType[] = [
      'frame',
      'row',
      'column',
      'stack',
      'grid',
      'container',
      'card',
      'button',
      'fab',
      'appbar',
      'navbar',
      'bottomnav',
      'input',
      'select',
      'checkbox',
      'switch',
      'radio',
      'slider',
      'progress',
      'text',
      'badge',
      'chip',
      'alert',
      'modal',
      'image',
      'imageview',
      'videoview',
      'list'
    ];
    const targets: CodegenTarget[] = ['react', 'react-native', 'flutter', 'android-xml'];
    for (const type of types) {
      for (const target of targets) {
        const out = html(type, target);
        expect(out.length).toBeGreaterThan(8);
        expect(out).toContain('<div');
      }
    }
  });

  it('button preview is target-themed', () => {
    expect(html('button', 'react')).toContain('bg-cyan-500');

    const android = html('button', 'android-xml');
    expect(android).toContain('uppercase');
    expect(android).toContain('#6750A4');

    const flutter = html('button', 'flutter');
    expect(flutter).toContain('uppercase');
    expect(flutter).toContain('#1976D2');

    const rn = html('button', 'react-native');
    expect(rn).toContain('#007AFF');
    expect(rn).not.toContain('uppercase');
  });

  it('FAB renders a + glyph for every target', () => {
    for (const target of ['react', 'react-native', 'flutter', 'android-xml'] as const) {
      const out = html('fab', target);
      // Lucide Plus icon renders with `lucide-plus` class
      expect(out).toMatch(/lucide-plus|>\+</);
    }
  });

  it('AppBar reflects iOS Back/Title/Done on react-native', () => {
    const ios = html('appbar', 'react-native');
    expect(ios).toContain('Back');
    expect(ios).toContain('Title');
    expect(ios).toContain('Done');
  });

  it('AppBar uses Material primary on android-xml', () => {
    const android = html('appbar', 'android-xml');
    expect(android).toContain('#6750A4');
  });

  it('list preview renders multiple rows', () => {
    for (const target of ['react', 'react-native', 'flutter', 'android-xml'] as const) {
      const matches = html('list', target).match(/h-2\.5/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('switch preview reflects iOS green on react-native', () => {
    expect(html('switch', 'react-native')).toContain('#34C759');
  });
});
