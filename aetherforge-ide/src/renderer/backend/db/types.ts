import type { Edge, Node } from '@xyflow/react';

export type DBComponentType = 'table' | 'view';

export type DBNodeProps = {
  tableName?: string;
  columns?: string;
  primaryKey?: string;
  indexes?: string;
};

export type DBNodeData = {
  label: string;
  componentType: DBComponentType;
  props: DBNodeProps;
};

export type DBNode = Node<DBNodeData>;

export type DBEdgeData = {
  relationName?: string;
  sourceField?: string;
  targetField?: string;
  cardinality?: 'one-to-one' | 'one-to-many';
  required?: boolean;
  onDelete?: 'Cascade' | 'Restrict' | 'NoAction' | 'SetNull' | 'SetDefault';
  onUpdate?: 'Cascade' | 'Restrict' | 'NoAction' | 'SetNull' | 'SetDefault';
};

export type DBEdge = Edge<DBEdgeData>;

export type DBSerializableNode = {
  id: string;
  componentType: DBComponentType;
  label: string;
  x: number;
  y: number;
  props: DBNodeProps;
};

export type DBSerializableEdge = {
  id: string;
  source: string;
  target: string;
  relationName?: string;
  sourceField?: string;
  targetField?: string;
  cardinality?: 'one-to-one' | 'one-to-many';
  required?: boolean;
  onDelete?: 'Cascade' | 'Restrict' | 'NoAction' | 'SetNull' | 'SetDefault';
  onUpdate?: 'Cascade' | 'Restrict' | 'NoAction' | 'SetNull' | 'SetDefault';
};
