import type { CanvasNode } from '../types';
import type { AppPage } from '@/renderer/state/pages-store';
import { generateCanvasCode } from '../sync';
import { emitReactNativeScreen } from './react-native';
import { emitFlutterMain } from './flutter';
import { emitAndroidXmlLayout } from './android-xml';

export type CodegenTarget = 'react' | 'react-native' | 'flutter' | 'android-xml';

export function emitForTarget(
  target: CodegenTarget,
  nodes: CanvasNode[],
  pages: AppPage[]
): { path: string; name: string; content: string } {
  switch (target) {
    case 'react':
      return {
        path: 'virtual://canvas/react/visual-builder.tsx',
        name: 'visual-builder.tsx',
        content: generateCanvasCode(nodes, pages)
      };
    case 'react-native':
      return {
        path: 'virtual://canvas/react-native/AppScreen.tsx',
        name: 'AppScreen.tsx',
        content: emitReactNativeScreen(nodes)
      };
    case 'flutter':
      return {
        path: 'virtual://canvas/flutter/main.dart',
        name: 'main.dart',
        content: emitFlutterMain(nodes)
      };
    case 'android-xml':
      return {
        path: 'virtual://canvas/android/layout_canvas.xml',
        name: 'layout_canvas.xml',
        content: emitAndroidXmlLayout(nodes)
      };
    default:
      return {
        path: 'virtual://canvas/react/visual-builder.tsx',
        name: 'visual-builder.tsx',
        content: generateCanvasCode(nodes, pages)
      };
  }
}

export const CODEGEN_TARGETS: CodegenTarget[] = ['react', 'react-native', 'flutter', 'android-xml'];
