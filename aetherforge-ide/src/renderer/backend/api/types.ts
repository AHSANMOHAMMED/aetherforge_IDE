import type { Edge, Node } from '@xyflow/react';

export type APIComponentType = 'endpoint' | 'middleware' | 'service' | 'database';

export type APIHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type APINodeProps = {
  method?: APIHttpMethod;
  path?: string;
  auth?: boolean;
  requestModel?: string;
  responseModel?: string;
  description?: string;
};

export type APINodeData = {
  label: string;
  componentType: APIComponentType;
  props: APINodeProps;
};

export type APINode = Node<APINodeData>;
export type APIEdge = Edge;

export type APISerializableNode = {
  id: string;
  componentType: APIComponentType;
  label: string;
  x: number;
  y: number;
  props: APINodeProps;
};
