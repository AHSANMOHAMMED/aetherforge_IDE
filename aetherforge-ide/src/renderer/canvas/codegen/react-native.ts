import type { CanvasComponentType, CanvasNode } from '../types';

const ALWAYS_IMPORT = ['View', 'Text', 'StyleSheet'];

const RN_TAG: Record<CanvasComponentType, string> = {
  frame: 'View',
  row: 'View',
  column: 'View',
  stack: 'View',
  grid: 'View',
  container: 'View',
  card: 'View',
  button: 'Pressable',
  input: 'TextInput',
  select: 'Pressable',
  checkbox: 'Switch',
  switch: 'Switch',
  radio: 'Pressable',
  slider: 'View',
  progress: 'View',
  text: 'Text',
  badge: 'View',
  chip: 'View',
  alert: 'View',
  modal: 'Modal',
  navbar: 'View',
  appbar: 'View',
  bottomnav: 'View',
  fab: 'Pressable',
  imageview: 'Image',
  image: 'Image',
  videoview: 'Video',
  list: 'FlatList'
};

function escape(text: string): string {
  return text.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}

function emitNode(node: CanvasNode): string {
  const tag = RN_TAG[node.data.componentType] ?? 'View';
  const props = node.data.props;
  const text = escape(props.text ?? node.data.label ?? '');
  const accessibilityLabel = props.ariaLabel ? ` accessibilityLabel="${escape(props.ariaLabel)}"` : '';
  const styleAttr = ` style={{ position: 'absolute', left: ${Math.round(node.position.x)}, top: ${Math.round(node.position.y)}, width: ${props.width ?? 'undefined'}, height: ${props.height ?? 'undefined'} }}`;
  switch (node.data.componentType) {
    case 'text':
      return `      <Text${styleAttr}${accessibilityLabel}>${text}</Text>`;
    case 'button':
    case 'fab':
      return `      <Pressable${styleAttr}${accessibilityLabel}><Text>${text || (node.data.componentType === 'fab' ? '+' : 'Button')}</Text></Pressable>`;
    case 'input':
      return `      <TextInput${styleAttr} placeholder=${JSON.stringify(props.placeholder ?? '')} />`;
    case 'switch':
    case 'checkbox':
      return `      <Switch${styleAttr} value={${Boolean(props.checked)}} />`;
    case 'image':
    case 'imageview':
      return `      <Image${styleAttr} source={{ uri: ${JSON.stringify(props.src ?? 'https://picsum.photos/420/240')} }} />`;
    case 'videoview':
      return `      {/* Video requires expo-av or react-native-video */}\n      <View${styleAttr}><Text>VideoView</Text></View>`;
    case 'list':
      return `      <FlatList${styleAttr} data={${JSON.stringify(props.items ?? [])}} keyExtractor={(item, i) => String(i)} renderItem={({ item }) => <Text>{String(item)}</Text>} />`;
    case 'slider':
      return `      {/* Slider requires @react-native-community/slider */}\n      <View${styleAttr}><Text>Slider ${props.value ?? 0}</Text></View>`;
    case 'progress':
      return `      <View${styleAttr}><Text>Progress ${props.value ?? 0}/${props.max ?? 100}</Text></View>`;
    case 'appbar':
    case 'navbar':
      return `      <View${styleAttr}><Text style={{ fontWeight: '600' }}>${text || 'Title'}</Text></View>`;
    case 'bottomnav':
      return `      <View${styleAttr}><Text>BottomNavigation</Text></View>`;
    case 'modal':
      return `      <Modal visible transparent>${'\n'}        <View><Text>${text || 'Modal'}</Text></View>${'\n'}      </Modal>`;
    case 'chip':
      return `      <View${styleAttr}><Text>${text || 'Chip'}</Text></View>`;
    case 'badge':
      return `      <View${styleAttr}><Text>${text || 'Badge'}</Text></View>`;
    case 'alert':
      return `      <View${styleAttr}><Text>${text || 'Alert'}</Text></View>`;
    case 'card':
      return `      <View${styleAttr}><Text>${text || 'Card'}</Text></View>`;
    case 'select':
      return `      <Pressable${styleAttr}><Text>${text || 'Select'}</Text></Pressable>`;
    case 'radio':
      return `      <Pressable${styleAttr}><Text>${text || 'Radio'}</Text></Pressable>`;
    default:
      return `      <${tag}${styleAttr}><Text>${text || node.data.componentType}</Text></${tag}>`;
  }
}

function importsFor(nodes: CanvasNode[]): string[] {
  const seen = new Set<string>(ALWAYS_IMPORT);
  for (const n of nodes) {
    const tag = RN_TAG[n.data.componentType] ?? 'View';
    if (tag === 'Video') continue; // requires external dep, comment-only above
    seen.add(tag);
    if (n.data.componentType === 'list') seen.add('FlatList');
    if (n.data.componentType === 'modal') seen.add('Modal');
  }
  // Sort for stable output
  return Array.from(seen).sort();
}

export function emitReactNativeScreen(nodes: CanvasNode[]): string {
  const ids = nodes.map((n) => n.id).join(', ');
  const imports = importsFor(nodes).join(', ');
  const body = nodes.map((n) => emitNode(n)).join('\n');
  return `import React from 'react';
import { ${imports} } from 'react-native';

// Generated from AetherForge Visual Canvas (${nodes.length} nodes${ids ? `: ${ids}` : ''})
export default function CanvasScreen() {
  return (
    <View style={styles.root}>
${body || `      <Text style={styles.hint}>React Native target — drop components onto the canvas to scaffold this screen</Text>`}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: '#0b1220' },
  hint: { color: '#94a3b8', fontSize: 12 }
});
`;
}
