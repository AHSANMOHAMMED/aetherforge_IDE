import type { CanvasComponentType, CanvasNodeProps } from './types';
import type { CodegenTarget } from './codegen/index';

export type TargetTag = {
  /** Element / widget tag emitted by codegen. */
  tag: string;
  /** Optional import / package source. */
  import?: string;
  /** Optional fixed attributes appended verbatim. */
  attrs?: Record<string, string>;
  /** Whether this component compiles cleanly to the target. Default true. */
  supported?: boolean;
};

export type TargetMapping = {
  react?: TargetTag;
  rn?: TargetTag;
  flutter?: TargetTag;
  androidXml?: TargetTag;
};

export type CanvasPaletteItem = {
  type: CanvasComponentType;
  label: string;
  description: string;
  category: 'layout' | 'forms' | 'data' | 'navigation' | 'media' | 'mobile';
  defaultProps: CanvasNodeProps;
  mappings: TargetMapping;
};

export const CANVAS_PALETTE: CanvasPaletteItem[] = [
  {
    type: 'frame',
    label: 'Frame',
    description: 'Root / region container (children snap inside)',
    category: 'layout',
    defaultProps: {
      className: 'rounded-lg border border-dashed border-white/25 bg-slate-900/40',
      width: 360,
      height: 640,
      padding: 12
    },
    mappings: {
      react: { tag: 'div' },
      rn: { tag: 'View', import: 'react-native' },
      flutter: { tag: 'Container' },
      androidXml: { tag: 'androidx.constraintlayout.widget.ConstraintLayout' }
    }
  },
  {
    type: 'row',
    label: 'Row',
    description: 'Horizontal stack',
    category: 'layout',
    defaultProps: {
      className: 'flex flex-row gap-2 items-start',
      width: 320,
      height: 80,
      padding: 8
    },
    mappings: {
      react: { tag: 'div' },
      rn: { tag: 'View' },
      flutter: { tag: 'Row' },
      androidXml: { tag: 'LinearLayout', attrs: { 'android:orientation': 'horizontal' } }
    }
  },
  {
    type: 'column',
    label: 'Column',
    description: 'Vertical stack',
    category: 'layout',
    defaultProps: {
      className: 'flex flex-col gap-2 items-stretch',
      width: 200,
      height: 200,
      padding: 8
    },
    mappings: {
      react: { tag: 'div' },
      rn: { tag: 'View' },
      flutter: { tag: 'Column' },
      androidXml: { tag: 'LinearLayout', attrs: { 'android:orientation': 'vertical' } }
    }
  },
  {
    type: 'stack',
    label: 'Stack',
    description: 'Overlapping layers',
    category: 'layout',
    defaultProps: {
      className: 'relative grid place-items-center',
      width: 200,
      height: 120,
      padding: 0
    },
    mappings: {
      react: { tag: 'div' },
      rn: { tag: 'View' },
      flutter: { tag: 'Stack' },
      androidXml: { tag: 'FrameLayout' }
    }
  },
  {
    type: 'grid',
    label: 'Grid',
    description: 'CSS / GridView region',
    category: 'layout',
    defaultProps: {
      className: 'grid grid-cols-2 gap-2',
      width: 280,
      height: 160,
      padding: 8
    },
    mappings: {
      react: { tag: 'div' },
      rn: { tag: 'View' },
      flutter: { tag: 'GridView' },
      androidXml: { tag: 'androidx.gridlayout.widget.GridLayout' }
    }
  },
  {
    type: 'container',
    label: 'Container',
    description: 'Generic layout block',
    category: 'layout',
    defaultProps: {
      className: 'rounded-lg border border-slate-500/40 bg-slate-800/70',
      width: 240,
      height: 140,
      padding: 12
    },
    mappings: {
      react: { tag: 'div' },
      rn: { tag: 'View' },
      flutter: { tag: 'Container' },
      androidXml: { tag: 'FrameLayout' }
    }
  },
  {
    type: 'card',
    label: 'Card',
    description: 'Card style component',
    category: 'layout',
    defaultProps: {
      text: 'Card Title',
      className: 'rounded-lg border border-slate-500/30 bg-slate-900/90 p-4'
    },
    mappings: {
      react: { tag: 'article' },
      rn: { tag: 'View' },
      flutter: { tag: 'Card' },
      androidXml: { tag: 'com.google.android.material.card.MaterialCardView' }
    }
  },
  {
    type: 'button',
    label: 'Button',
    description: 'Clickable action button',
    category: 'forms',
    defaultProps: {
      text: 'Click Me',
      className: 'rounded-md bg-cyan-500 px-3 py-2 text-white'
    },
    mappings: {
      react: { tag: 'button' },
      rn: { tag: 'Pressable' },
      flutter: { tag: 'ElevatedButton' },
      androidXml: { tag: 'com.google.android.material.button.MaterialButton' }
    }
  },
  {
    type: 'input',
    label: 'Input',
    description: 'Text input field',
    category: 'forms',
    defaultProps: {
      placeholder: 'Enter text…',
      className: 'rounded-md border border-slate-500/40 bg-slate-800 px-3 py-2 text-sm text-slate-100',
      width: 200,
      height: 38
    },
    mappings: {
      react: { tag: 'input' },
      rn: { tag: 'TextInput' },
      flutter: { tag: 'TextField' },
      androidXml: { tag: 'com.google.android.material.textfield.TextInputEditText' }
    }
  },
  {
    type: 'select',
    label: 'Select',
    description: 'Dropdown select',
    category: 'forms',
    defaultProps: {
      text: 'Option 1',
      className: 'rounded-md border border-slate-500/40 bg-slate-800 px-3 py-2 text-sm text-slate-100',
      width: 180,
      height: 38,
      items: ['Option 1', 'Option 2', 'Option 3']
    },
    mappings: {
      react: { tag: 'select' },
      rn: { tag: 'Picker' },
      flutter: { tag: 'DropdownButton' },
      androidXml: { tag: 'Spinner' }
    }
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    description: 'Toggle checkbox',
    category: 'forms',
    defaultProps: {
      text: 'Check me',
      checked: false,
      className: 'flex items-center gap-2 text-sm text-slate-100'
    },
    mappings: {
      react: { tag: 'input' },
      rn: { tag: 'Switch' },
      flutter: { tag: 'Checkbox' },
      androidXml: { tag: 'com.google.android.material.checkbox.MaterialCheckBox' }
    }
  },
  {
    type: 'switch',
    label: 'Switch',
    description: 'Toggle switch',
    category: 'forms',
    defaultProps: {
      text: 'Enable',
      checked: false,
      className: 'flex items-center gap-2 text-sm text-slate-100'
    },
    mappings: {
      react: { tag: 'label' },
      rn: { tag: 'Switch' },
      flutter: { tag: 'Switch' },
      androidXml: { tag: 'com.google.android.material.materialswitch.MaterialSwitch' }
    }
  },
  {
    type: 'radio',
    label: 'Radio',
    description: 'Single-choice radio button',
    category: 'forms',
    defaultProps: {
      text: 'Option A',
      checked: false,
      className: 'flex items-center gap-2 text-sm text-slate-100'
    },
    mappings: {
      react: { tag: 'input' },
      rn: { tag: 'View' },
      flutter: { tag: 'Radio' },
      androidXml: { tag: 'com.google.android.material.radiobutton.MaterialRadioButton' }
    }
  },
  {
    type: 'slider',
    label: 'Slider',
    description: 'Horizontal value slider',
    category: 'forms',
    defaultProps: {
      min: 0,
      max: 100,
      value: 40,
      width: 220,
      height: 32,
      className: ''
    },
    mappings: {
      react: { tag: 'input' },
      rn: { tag: 'Slider' },
      flutter: { tag: 'Slider' },
      androidXml: { tag: 'com.google.android.material.slider.Slider' }
    }
  },
  {
    type: 'progress',
    label: 'Progress',
    description: 'Linear progress indicator',
    category: 'data',
    defaultProps: {
      min: 0,
      max: 100,
      value: 65,
      width: 220,
      height: 8,
      className: ''
    },
    mappings: {
      react: { tag: 'progress' },
      rn: { tag: 'View' },
      flutter: { tag: 'LinearProgressIndicator' },
      androidXml: { tag: 'com.google.android.material.progressindicator.LinearProgressIndicator' }
    }
  },
  {
    type: 'text',
    label: 'Text',
    description: 'Typography element',
    category: 'data',
    defaultProps: {
      text: 'Heading Text',
      className: 'text-base font-medium text-slate-100'
    },
    mappings: {
      react: { tag: 'p' },
      rn: { tag: 'Text' },
      flutter: { tag: 'Text' },
      androidXml: { tag: 'TextView' }
    }
  },
  {
    type: 'badge',
    label: 'Badge',
    description: 'Small status badge',
    category: 'data',
    defaultProps: {
      text: 'Badge',
      variant: 'default',
      className:
        'inline-flex items-center rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-medium text-cyan-300'
    },
    mappings: {
      react: { tag: 'span' },
      rn: { tag: 'View' },
      flutter: { tag: 'Badge' },
      androidXml: { tag: 'com.google.android.material.badge.BadgeDrawable' }
    }
  },
  {
    type: 'chip',
    label: 'Chip',
    description: 'Compact filter / action chip',
    category: 'data',
    defaultProps: {
      text: 'Tag',
      className:
        'inline-flex items-center rounded-full border border-cyan-400/40 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-100'
    },
    mappings: {
      react: { tag: 'span' },
      rn: { tag: 'View' },
      flutter: { tag: 'Chip' },
      androidXml: { tag: 'com.google.android.material.chip.Chip' }
    }
  },
  {
    type: 'alert',
    label: 'Alert',
    description: 'Notification alert box',
    category: 'data',
    defaultProps: {
      text: 'Alert message here',
      variant: 'info',
      className: 'rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200',
      width: 280,
      height: 60
    },
    mappings: {
      react: { tag: 'div' },
      rn: { tag: 'View' },
      flutter: { tag: 'SnackBar' },
      androidXml: { tag: 'com.google.android.material.snackbar.Snackbar' }
    }
  },
  {
    type: 'modal',
    label: 'Modal',
    description: 'Dialog / modal overlay',
    category: 'navigation',
    defaultProps: {
      text: 'Modal Title',
      className: 'rounded-xl border border-white/10 bg-slate-900 shadow-2xl',
      width: 380,
      height: 220,
      padding: 24
    },
    mappings: {
      react: { tag: 'div' },
      rn: { tag: 'Modal' },
      flutter: { tag: 'AlertDialog' },
      androidXml: { tag: 'com.google.android.material.dialog.MaterialAlertDialogBuilder' }
    }
  },
  {
    type: 'navbar',
    label: 'Navbar',
    description: 'Top navigation bar',
    category: 'navigation',
    defaultProps: {
      text: 'My App',
      className:
        'flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/90 px-4 py-3',
      width: 480,
      height: 56
    },
    mappings: {
      react: { tag: 'nav' },
      rn: { tag: 'View' },
      flutter: { tag: 'AppBar' },
      androidXml: { tag: 'com.google.android.material.appbar.AppBarLayout' }
    }
  },
  {
    type: 'appbar',
    label: 'AppBar',
    description: 'Material toolbar (mobile)',
    category: 'mobile',
    defaultProps: {
      text: 'Title',
      width: 360,
      height: 56,
      iconName: 'menu',
      className: ''
    },
    mappings: {
      react: { tag: 'header' },
      rn: { tag: 'View' },
      flutter: { tag: 'AppBar' },
      androidXml: { tag: 'com.google.android.material.appbar.MaterialToolbar' }
    }
  },
  {
    type: 'bottomnav',
    label: 'Bottom Nav',
    description: 'Bottom navigation bar',
    category: 'mobile',
    defaultProps: {
      width: 360,
      height: 64,
      items: ['Home', 'Search', 'Profile'],
      className: ''
    },
    mappings: {
      react: { tag: 'nav' },
      rn: { tag: 'View' },
      flutter: { tag: 'BottomNavigationBar' },
      androidXml: { tag: 'com.google.android.material.bottomnavigation.BottomNavigationView' }
    }
  },
  {
    type: 'fab',
    label: 'FAB',
    description: 'Floating action button',
    category: 'mobile',
    defaultProps: {
      iconName: 'plus',
      width: 56,
      height: 56,
      className: ''
    },
    mappings: {
      react: { tag: 'button' },
      rn: { tag: 'Pressable' },
      flutter: { tag: 'FloatingActionButton' },
      androidXml: { tag: 'com.google.android.material.floatingactionbutton.FloatingActionButton' }
    }
  },
  {
    type: 'imageview',
    label: 'ImageView',
    description: 'Native image / drawable',
    category: 'media',
    defaultProps: {
      src: 'https://picsum.photos/420/240',
      width: 220,
      height: 140,
      className: ''
    },
    mappings: {
      react: { tag: 'img' },
      rn: { tag: 'Image' },
      flutter: { tag: 'Image' },
      androidXml: { tag: 'com.google.android.material.imageview.ShapeableImageView' }
    }
  },
  {
    type: 'image',
    label: 'Image (web)',
    description: 'Plain HTML image element',
    category: 'media',
    defaultProps: {
      src: 'https://picsum.photos/420/240',
      width: 220,
      height: 120,
      className: 'rounded-md object-cover'
    },
    mappings: {
      react: { tag: 'img' },
      rn: { tag: 'Image' },
      flutter: { tag: 'Image' },
      androidXml: { tag: 'ImageView' }
    }
  },
  {
    type: 'videoview',
    label: 'VideoView',
    description: 'Native video / player',
    category: 'media',
    defaultProps: {
      width: 240,
      height: 140,
      className: ''
    },
    mappings: {
      react: { tag: 'video' },
      rn: { tag: 'Video' },
      flutter: { tag: 'VideoPlayer' },
      androidXml: { tag: 'VideoView' }
    }
  },
  {
    type: 'list',
    label: 'List',
    description: 'Vertical scrollable list',
    category: 'mobile',
    defaultProps: {
      width: 320,
      height: 240,
      items: ['List item 1', 'List item 2', 'List item 3'],
      className: ''
    },
    mappings: {
      react: { tag: 'ul' },
      rn: { tag: 'FlatList' },
      flutter: { tag: 'ListView' },
      androidXml: { tag: 'androidx.recyclerview.widget.RecyclerView' }
    }
  }
];

export function getPaletteItem(type: CanvasComponentType): CanvasPaletteItem {
  const item = CANVAS_PALETTE.find((candidate) => candidate.type === type);
  if (!item) {
    throw new Error(`Unknown canvas component type: ${type}`);
  }
  return item;
}

export function mappingFor(item: CanvasPaletteItem, target: CodegenTarget): TargetTag | undefined {
  switch (target) {
    case 'react':
      return item.mappings.react;
    case 'react-native':
      return item.mappings.rn;
    case 'flutter':
      return item.mappings.flutter;
    case 'android-xml':
      return item.mappings.androidXml;
    default:
      return item.mappings.react;
  }
}

export function isSupportedFor(item: CanvasPaletteItem, target: CodegenTarget): boolean {
  const m = mappingFor(item, target);
  if (!m) return false;
  return m.supported !== false;
}
