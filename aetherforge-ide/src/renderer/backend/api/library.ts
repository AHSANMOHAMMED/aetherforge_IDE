import type { APIComponentType, APINodeProps } from './types';

export type APIPaletteItem = {
  type: APIComponentType;
  label: string;
  description: string;
  defaultProps: APINodeProps;
};

export const API_PALETTE: APIPaletteItem[] = [
  {
    type: 'endpoint',
    label: 'Endpoint',
    description: 'HTTP route definition',
    defaultProps: {
      method: 'GET',
      path: '/api/resource',
      auth: false,
      requestModel: 'RequestDto',
      responseModel: 'ResponseDto'
    }
  },
  {
    type: 'middleware',
    label: 'Middleware',
    description: 'Reusable middleware function',
    defaultProps: {
      description: 'Auth or validation middleware'
    }
  },
  {
    type: 'service',
    label: 'Service',
    description: 'Business logic service',
    defaultProps: {
      description: 'Service class/function'
    }
  },
  {
    type: 'database',
    label: 'Database',
    description: 'Data access layer',
    defaultProps: {
      description: 'Repository or ORM integration'
    }
  }
];

export function getApiPaletteItem(type: APIComponentType): APIPaletteItem {
  const item = API_PALETTE.find((candidate) => candidate.type === type);
  if (!item) {
    throw new Error(`Unknown API component type: ${type}`);
  }
  return item;
}
