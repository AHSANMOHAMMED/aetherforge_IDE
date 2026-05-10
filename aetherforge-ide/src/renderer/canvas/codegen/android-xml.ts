import type { CanvasComponentType, CanvasNode } from '../types';

const ANDROID_TAG: Record<CanvasComponentType, string> = {
  frame: 'androidx.constraintlayout.widget.ConstraintLayout',
  row: 'LinearLayout',
  column: 'LinearLayout',
  stack: 'FrameLayout',
  grid: 'androidx.gridlayout.widget.GridLayout',
  container: 'FrameLayout',
  card: 'com.google.android.material.card.MaterialCardView',
  button: 'com.google.android.material.button.MaterialButton',
  input: 'com.google.android.material.textfield.TextInputEditText',
  select: 'Spinner',
  checkbox: 'com.google.android.material.checkbox.MaterialCheckBox',
  switch: 'com.google.android.material.materialswitch.MaterialSwitch',
  radio: 'com.google.android.material.radiobutton.MaterialRadioButton',
  slider: 'com.google.android.material.slider.Slider',
  progress: 'com.google.android.material.progressindicator.LinearProgressIndicator',
  text: 'TextView',
  badge: 'com.google.android.material.badge.BadgeDrawable',
  chip: 'com.google.android.material.chip.Chip',
  alert: 'com.google.android.material.snackbar.Snackbar',
  modal: 'com.google.android.material.dialog.MaterialAlertDialogBuilder',
  navbar: 'com.google.android.material.appbar.AppBarLayout',
  appbar: 'com.google.android.material.appbar.MaterialToolbar',
  bottomnav: 'com.google.android.material.bottomnavigation.BottomNavigationView',
  fab: 'com.google.android.material.floatingactionbutton.FloatingActionButton',
  imageview: 'com.google.android.material.imageview.ShapeableImageView',
  image: 'ImageView',
  videoview: 'VideoView',
  list: 'androidx.recyclerview.widget.RecyclerView'
};

function xmlAttr(value: string | undefined): string {
  return (value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function emitNode(node: CanvasNode): string {
  const tag = ANDROID_TAG[node.data.componentType] ?? 'View';
  const props = node.data.props;
  const idHint = node.id.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  const id = `@+id/${idHint}`;
  const x = Math.round(node.position.x);
  const y = Math.round(node.position.y);
  const w = props.width ? `${props.width}dp` : 'wrap_content';
  const h = props.height ? `${props.height}dp` : 'wrap_content';
  const text = xmlAttr(props.text ?? node.data.label ?? '');
  const baseAttrs = [
    `        android:id="${id}"`,
    `        android:layout_width="${w}"`,
    `        android:layout_height="${h}"`,
    `        android:translationX="${x}dp"`,
    `        android:translationY="${y}dp"`
  ];
  if (text && /text|button|chip|appbar|navbar|alert|modal|card/.test(node.data.componentType)) {
    baseAttrs.push(`        android:text="${text}"`);
  }
  if (node.data.componentType === 'input' && props.placeholder) {
    baseAttrs.push(`        android:hint="${xmlAttr(props.placeholder)}"`);
  }
  if (node.data.componentType === 'slider' || node.data.componentType === 'progress') {
    baseAttrs.push(`        android:valueFrom="${props.min ?? 0}"`);
    baseAttrs.push(`        android:valueTo="${props.max ?? 100}"`);
    baseAttrs.push(`        android:value="${props.value ?? 0}"`);
  }
  if (node.data.componentType === 'fab') {
    baseAttrs.push(`        app:srcCompat="@android:drawable/ic_input_add"`);
  }
  if (node.data.componentType === 'image' || node.data.componentType === 'imageview') {
    baseAttrs.push(`        android:scaleType="centerCrop"`);
  }
  if (node.data.componentType === 'row') {
    baseAttrs.push(`        android:orientation="horizontal"`);
  }
  if (node.data.componentType === 'column') {
    baseAttrs.push(`        android:orientation="vertical"`);
  }
  if (props.ariaLabel) {
    baseAttrs.push(`        android:contentDescription="${xmlAttr(props.ariaLabel)}"`);
  }
  return `    <${tag}\n${baseAttrs.join('\n')} />`;
}

export function emitAndroidXmlLayout(nodes: CanvasNode[]): string {
  const body = nodes.map((n) => emitNode(n)).join('\n\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- AetherForge canvas → ConstraintLayout (${nodes.length} nodes) -->
<androidx.constraintlayout.widget.ConstraintLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#0B1220">

${
  body ||
  `    <TextView
        android:id="@+id/hint"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Android XML target — drop components onto the canvas"
        android:textColor="#94A3B8"
        android:textSize="12sp"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintBottom_toBottomOf="parent" />`
}

</androidx.constraintlayout.widget.ConstraintLayout>
`;
}
