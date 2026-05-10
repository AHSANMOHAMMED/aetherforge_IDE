import { describe, expect, it } from 'vitest';
import { emitForTarget, CODEGEN_TARGETS, type CodegenTarget } from '@/renderer/canvas/codegen/index';
import type { CanvasComponentType, CanvasNode } from '@/renderer/canvas/types';
import { getPaletteItem } from '@/renderer/canvas/library';

const emptyNodes: CanvasNode[] = [];
const pages = [{ id: 'p1', name: 'Home', path: '/home' }];

function nodeFor(type: CanvasComponentType, x = 16, y = 24): CanvasNode {
  const item = getPaletteItem(type);
  return {
    id: `n-${type}`,
    type: 'default',
    position: { x, y },
    selected: false,
    data: {
      label: item.label,
      componentType: type,
      props: item.defaultProps
    }
  };
}

describe('canvas multi-target codegen', () => {
  it('lists four targets', () => {
    expect(CODEGEN_TARGETS).toEqual(['react', 'react-native', 'flutter', 'android-xml']);
  });

  for (const target of CODEGEN_TARGETS) {
    it(`emitForTarget(${target}) returns path + non-empty content`, () => {
      const art = emitForTarget(target, emptyNodes, pages);
      expect(art.path).toContain('virtual://canvas');
      expect(art.name.length).toBeGreaterThan(2);
      expect(typeof art.content).toBe('string');
      expect(art.content.length).toBeGreaterThan(0);
    });
  }
});

type TargetExpectations = Partial<Record<CodegenTarget, string>>;

const NEW_TYPE_EXPECTATIONS: Array<{ type: CanvasComponentType; per: TargetExpectations }> = [
  {
    type: 'fab',
    per: {
      'android-xml': 'FloatingActionButton',
      flutter: 'FloatingActionButton',
      'react-native': 'Pressable'
    }
  },
  {
    type: 'appbar',
    per: {
      'android-xml': 'MaterialToolbar',
      flutter: 'AppBar(title:'
    }
  },
  {
    type: 'bottomnav',
    per: {
      'android-xml': 'BottomNavigationView',
      flutter: 'BottomNavigationBar'
    }
  },
  {
    type: 'chip',
    per: {
      'android-xml': 'com.google.android.material.chip.Chip',
      flutter: 'Chip(label:'
    }
  },
  {
    type: 'radio',
    per: {
      'android-xml': 'MaterialRadioButton',
      flutter: 'Radio<int>'
    }
  },
  {
    type: 'slider',
    per: {
      'android-xml': 'com.google.android.material.slider.Slider',
      flutter: 'Slider(value:'
    }
  },
  {
    type: 'progress',
    per: {
      'android-xml': 'LinearProgressIndicator',
      flutter: 'LinearProgressIndicator'
    }
  },
  {
    type: 'imageview',
    per: {
      'android-xml': 'ShapeableImageView',
      flutter: 'Image.network(',
      'react-native': 'Image'
    }
  },
  {
    type: 'videoview',
    per: {
      'android-xml': 'VideoView',
      flutter: 'VideoPlayer'
    }
  },
  {
    type: 'list',
    per: {
      'android-xml': 'androidx.recyclerview.widget.RecyclerView',
      flutter: 'ListView',
      'react-native': 'FlatList'
    }
  }
];

describe('per-target tags for new mobile components', () => {
  for (const { type, per } of NEW_TYPE_EXPECTATIONS) {
    for (const [target, expected] of Object.entries(per)) {
      it(`${type} → ${target} contains "${expected}"`, () => {
        const art = emitForTarget(target as CodegenTarget, [nodeFor(type)], pages);
        expect(art.content).toContain(expected);
      });
    }
  }
});

describe('react sync union covers new types', () => {
  it('emits the extended componentType union', () => {
    const art = emitForTarget('react', [nodeFor('fab'), nodeFor('chip'), nodeFor('list')], pages);
    expect(art.content).toContain("'fab'");
    expect(art.content).toContain("'chip'");
    expect(art.content).toContain("'list'");
  });
});
