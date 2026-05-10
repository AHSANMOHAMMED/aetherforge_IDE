import type { CanvasComponentType, CanvasNode } from '../types';

const FL_WIDGET: Record<CanvasComponentType, string> = {
  frame: 'Container',
  row: 'Row',
  column: 'Column',
  stack: 'Stack',
  grid: 'GridView',
  container: 'Container',
  card: 'Card',
  button: 'ElevatedButton',
  input: 'TextField',
  select: 'DropdownButton',
  checkbox: 'Checkbox',
  switch: 'Switch',
  radio: 'Radio',
  slider: 'Slider',
  progress: 'LinearProgressIndicator',
  text: 'Text',
  badge: 'Badge',
  chip: 'Chip',
  alert: 'SnackBar',
  modal: 'AlertDialog',
  navbar: 'AppBar',
  appbar: 'AppBar',
  bottomnav: 'BottomNavigationBar',
  fab: 'FloatingActionButton',
  imageview: 'Image',
  image: 'Image',
  videoview: 'VideoPlayer',
  list: 'ListView'
};

function dartString(text: string): string {
  return JSON.stringify(text ?? '');
}

function emitWidget(node: CanvasNode): string {
  const widget = FL_WIDGET[node.data.componentType] ?? 'Container';
  const props = node.data.props;
  const text = dartString(props.text ?? node.data.label ?? '');
  switch (node.data.componentType) {
    case 'text':
      return `Text(${text})`;
    case 'button':
      return `ElevatedButton(onPressed: () {}, child: Text(${text}))`;
    case 'fab':
      return `FloatingActionButton(onPressed: () {}, child: const Icon(Icons.add))`;
    case 'input':
      return `TextField(decoration: InputDecoration(hintText: ${dartString(props.placeholder ?? '')}))`;
    case 'switch':
      return `Switch(value: ${Boolean(props.checked)}, onChanged: (_) {})`;
    case 'checkbox':
      return `Checkbox(value: ${Boolean(props.checked)}, onChanged: (_) {})`;
    case 'radio':
      return `Radio<int>(value: 0, groupValue: 0, onChanged: (_) {})`;
    case 'slider':
      return `Slider(value: ${(props.value ?? 0).toFixed(1)}, min: ${(props.min ?? 0).toFixed(1)}, max: ${(props.max ?? 100).toFixed(1)}, onChanged: (_) {})`;
    case 'progress':
      return `LinearProgressIndicator(value: ${((props.value ?? 0) / (props.max ?? 100) || 0).toFixed(2)})`;
    case 'image':
    case 'imageview':
      return `Image.network(${dartString(props.src ?? 'https://picsum.photos/420/240')})`;
    case 'videoview':
      return `// VideoPlayer requires the video_player package\nVideoPlayer(VideoPlayerController.network(''))`;
    case 'list':
      return `ListView(children: const [Text('List item 1'), Text('List item 2')])`;
    case 'card':
      return `Card(child: Padding(padding: const EdgeInsets.all(12), child: Text(${text})))`;
    case 'badge':
      return `Badge(label: Text(${text}))`;
    case 'chip':
      return `Chip(label: Text(${text}))`;
    case 'alert':
      return `SnackBar(content: Text(${text}))`;
    case 'modal':
      return `AlertDialog(title: Text(${text}))`;
    case 'navbar':
    case 'appbar':
      return `AppBar(title: Text(${text}))`;
    case 'bottomnav':
      return `BottomNavigationBar(items: const [BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'), BottomNavigationBarItem(icon: Icon(Icons.search), label: 'Search')])`;
    case 'select':
      return `DropdownButton<String>(items: const [DropdownMenuItem(value: 'a', child: Text('Option'))], onChanged: (_) {})`;
    case 'frame':
    case 'container':
      return `Container(width: ${props.width ?? 'null'}, height: ${props.height ?? 'null'})`;
    case 'row':
      return `Row(children: const [])`;
    case 'column':
      return `Column(children: const [])`;
    case 'stack':
      return `Stack(children: const [])`;
    case 'grid':
      return `GridView.count(crossAxisCount: 2, children: const [])`;
    default:
      return `${widget}()`;
  }
}

function emitPositioned(node: CanvasNode): string {
  return `        Positioned(\n          left: ${Math.round(node.position.x)},\n          top: ${Math.round(node.position.y)},\n          child: ${emitWidget(node)},\n        )`;
}

export function emitFlutterMain(nodes: CanvasNode[]): string {
  const positioned = nodes.map((n) => emitPositioned(n)).join(',\n');
  return `import 'package:flutter/material.dart';

// AetherForge canvas → Flutter (${nodes.length} nodes)
void main() => runApp(const CanvasApp());

class CanvasApp extends StatelessWidget {
  const CanvasApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        backgroundColor: const Color(0xFF0B1220),
        body: Stack(
          children: [
${positioned || `            Center(child: Text('Flutter target — generated scaffold', style: TextStyle(color: Colors.blueGrey.shade200, fontSize: 12)))`}
          ],
        ),
      ),
    );
  }
}
`;
}
