import type { APINode, APISerializableNode } from './types';

export const API_VIRTUAL_PATH = 'virtual://backend/api/routes.ts';
export const API_VIRTUAL_NAME = 'routes.ts';
export const API_OPENAPI_VIRTUAL_PATH = 'virtual://backend/api/openapi.json';
export const API_OPENAPI_VIRTUAL_NAME = 'openapi.json';

const API_MARKER = 'aetherforgeApiNodes';

type NormalizedEndpoint = {
  nodeId: string;
  label: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  auth: boolean;
  description: string;
  requestModel: string;
  responseModel: string;
};

export type ApiValidationResult = {
  endpoints: NormalizedEndpoint[];
  warnings: string[];
  errors: string[];
};

type SchemaObject = {
  type: 'object';
  properties: Record<string, { type: string }>;
  required?: string[];
};

function toSerializable(nodes: APINode[]): APISerializableNode[] {
  return nodes.map((node) => ({
    id: node.id,
    componentType: node.data.componentType,
    label: node.data.label,
    x: Math.round(node.position.x),
    y: Math.round(node.position.y),
    props: node.data.props
  }));
}

function pickEndpoints(nodes: APISerializableNode[]): APISerializableNode[] {
  return nodes.filter((node) => node.componentType === 'endpoint');
}

function escapePathName(pathValue: string): string {
  return (
    pathValue
      .replace(/^\/+/, '')
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, character: string) => character.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, '') || 'root'
  );
}

function methodExpr(value: string | undefined): string {
  const method = (value ?? 'GET').toLowerCase();
  const allowed = ['get', 'post', 'put', 'patch', 'delete'];
  return allowed.includes(method) ? method : 'get';
}

function mapScalarToOpenApi(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return 'string';
  }

  if (['int', 'integer', 'number', 'float', 'double', 'decimal'].includes(normalized)) {
    return 'number';
  }
  if (['bool', 'boolean'].includes(normalized)) {
    return 'boolean';
  }
  if (['array', 'list'].includes(normalized)) {
    return 'array';
  }
  if (['object', 'json', 'map'].includes(normalized)) {
    return 'object';
  }
  return 'string';
}

function parseModelSchema(modelName: string): SchemaObject {
  const trimmed = modelName.trim();
  if (!trimmed) {
    return { type: 'object', properties: {} };
  }

  const inlineMatch = trimmed.match(/^[^{}]+\{([\s\S]+)\}$/);
  const content = inlineMatch?.[1]?.trim() ?? trimmed;

  if (content.startsWith('{') && content.endsWith('}')) {
    try {
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const properties = Object.entries(parsed).reduce<Record<string, { type: string }>>(
        (acc, [key, value]) => {
          const inferredType = typeof value;
          acc[key] = {
            type: inferredType === 'number' ? 'number' : inferredType === 'boolean' ? 'boolean' : 'string'
          };
          return acc;
        },
        {}
      );
      return {
        type: 'object',
        properties,
        required: Object.keys(properties)
      };
    } catch {
      // Fall through to token parsing.
    }
  }

  const tokens = content
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [nameRaw, typeRaw] = token.split(':').map((part) => part.trim());
      if (!nameRaw) {
        return null;
      }
      return {
        name: nameRaw,
        type: mapScalarToOpenApi(typeRaw ?? 'string')
      };
    })
    .filter((item): item is { name: string; type: string } => Boolean(item));

  const properties = tokens.reduce<Record<string, { type: string }>>((acc, token) => {
    acc[token.name] = { type: token.type };
    return acc;
  }, {});

  return {
    type: 'object',
    properties,
    required: Object.keys(properties)
  };
}

function normalizeRoutePath(value: string | undefined): string {
  const raw = (value ?? '/api/resource').trim();
  if (!raw) {
    return '/api/resource';
  }

  const normalized = raw.replace(/\s+/g, '-').replace(/\/+/g, '/');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function toHandlerName(method: string, pathValue: string): string {
  const safePath = escapePathName(pathValue);
  return `${method}${safePath.charAt(0).toUpperCase()}${safePath.slice(1)}`;
}

export function validateApiNodes(nodes: APINode[]): ApiValidationResult {
  const serializable = toSerializable(nodes);
  const endpoints = pickEndpoints(serializable);
  const warnings: string[] = [];
  const errors: string[] = [];

  const normalized: NormalizedEndpoint[] = [];
  const seenRouteKey = new Set<string>();

  for (const endpoint of endpoints) {
    const rawMethod = endpoint.props.method?.toString().toUpperCase();
    const method = methodExpr(endpoint.props.method) as NormalizedEndpoint['method'];
    const path = normalizeRoutePath(endpoint.props.path);
    const routeKey = `${method.toUpperCase()} ${path}`;

    if (rawMethod && !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(rawMethod)) {
      warnings.push(`Endpoint "${endpoint.label}" has unknown method "${rawMethod}". Falling back to GET.`);
    }

    if (!path.startsWith('/')) {
      errors.push(`Endpoint "${endpoint.label}" has invalid path "${endpoint.props.path ?? ''}".`);
      continue;
    }

    if (/\s/.test(path)) {
      errors.push(`Endpoint "${endpoint.label}" path cannot contain spaces: ${path}`);
      continue;
    }

    if (!path.startsWith('/api') && path !== '/health') {
      warnings.push(`Endpoint "${endpoint.label}" path ${path} is outside /api namespace.`);
    }

    if (seenRouteKey.has(routeKey)) {
      errors.push(`Duplicate endpoint ${routeKey} detected.`);
      continue;
    }
    seenRouteKey.add(routeKey);

    normalized.push({
      nodeId: endpoint.id,
      label: endpoint.label,
      method,
      path,
      auth: Boolean(endpoint.props.auth),
      description: endpoint.props.description?.trim() ?? '',
      requestModel: endpoint.props.requestModel?.trim() ?? '',
      responseModel: endpoint.props.responseModel?.trim() ?? ''
    });
  }

  return {
    endpoints: normalized,
    warnings,
    errors
  };
}

export function generateApiCode(nodes: APINode[]): string {
  const serializable = toSerializable(nodes);
  const validation = validateApiNodes(nodes);

  const middlewareBlock = validation.endpoints.some((endpoint) => endpoint.auth)
    ? "function requireAuth(req: Request, res: Response, next: NextFunction): void {\n  if (!req.headers.authorization) {\n    res.status(401).json({ error: 'Unauthorized' });\n    return;\n  }\n  next();\n}\n"
    : '';

  const services = validation.endpoints
    .map((endpoint) => {
      const handlerName = toHandlerName(endpoint.method, endpoint.path);
      const reqModel = endpoint.requestModel || 'unknown';
      const resModel = endpoint.responseModel || 'unknown';
      const description = endpoint.description ? `  // ${endpoint.description}\n` : '';
      return `async function ${handlerName}Service(input: unknown): Promise<unknown> {\n${description}  // TODO: Implement domain logic for ${endpoint.method.toUpperCase()} ${endpoint.path}\n  return { ok: true, route: '${endpoint.path}', method: '${endpoint.method.toUpperCase()}', requestModel: '${reqModel}', responseModel: '${resModel}', input };\n}`;
    })
    .join('\n\n');

  const controllers = validation.endpoints
    .map((endpoint) => {
      const handlerName = toHandlerName(endpoint.method, endpoint.path);
      const description = endpoint.description ? `/** ${endpoint.description} */\n` : '';
      return `${description}async function ${handlerName}Controller(req: Request, res: Response): Promise<void> {\n  const payload = req.method === 'GET' ? req.query : req.body;\n  const data = await ${handlerName}Service(payload);\n  res.status(200).json(data);\n}`;
    })
    .join('\n\n');

  const routes = validation.endpoints
    .map((endpoint) => {
      const handlerName = toHandlerName(endpoint.method, endpoint.path);
      const middleware = endpoint.auth ? ', requireAuth' : '';
      return `router.${endpoint.method}('${endpoint.path}'${middleware}, ${handlerName}Controller);`;
    })
    .join('\n');

  const serializedJson = JSON.stringify(serializable, null, 2);
  const diagnosticComment = [
    ...validation.errors.map((message) => `- ERROR: ${message}`),
    ...validation.warnings.map((message) => `- WARN: ${message}`)
  ].join('\n');

  return `import { Router, type NextFunction, type Request, type Response } from 'express';\n\nexport const router = Router();\n\nconst ${API_MARKER} = ${serializedJson};\n\n${diagnosticComment ? `/*\n${diagnosticComment}\n*/\n\n` : ''}${middlewareBlock}${services || ''}${services ? '\n\n' : ''}${controllers || ''}${controllers ? '\n\n' : ''}${routes || "router.get('/health', (_, res) => res.status(200).json({ ok: true }));"}\n\nexport default router;\n`;
}

export function generateOpenApi(nodes: APINode[]): string {
  const serializable = toSerializable(nodes);
  const validation = validateApiNodes(nodes);
  const schemas: Record<string, SchemaObject> = {};

  const paths = validation.endpoints.reduce<Record<string, Record<string, unknown>>>(
    (accumulator, endpoint) => {
      const endpointPath = endpoint.path;
      const method = endpoint.method;
      const requestSchemaName = endpoint.requestModel || '';
      const responseSchemaName = endpoint.responseModel || '';

      if (requestSchemaName && !schemas[requestSchemaName]) {
        schemas[requestSchemaName] = parseModelSchema(requestSchemaName);
      }
      if (responseSchemaName && !schemas[responseSchemaName]) {
        schemas[responseSchemaName] = parseModelSchema(responseSchemaName);
      }

      accumulator[endpointPath] = accumulator[endpointPath] ?? {};
      accumulator[endpointPath][method] = {
        summary: endpoint.label,
        description: endpoint.description,
        operationId: toHandlerName(method, endpointPath),
        requestBody: endpoint.requestModel
          ? {
              required: method !== 'get',
              content: {
                'application/json': {
                  schema: {
                    $ref: `#/components/schemas/${endpoint.requestModel}`
                  }
                }
              }
            }
          : undefined,
        security: endpoint.auth ? [{ bearerAuth: [] }] : undefined,
        responses: {
          200: {
            description: endpoint.responseModel
              ? `Success response (${endpoint.responseModel})`
              : 'Success response',
            content: endpoint.responseModel
              ? {
                  'application/json': {
                    schema: {
                      $ref: `#/components/schemas/${endpoint.responseModel}`
                    }
                  }
                }
              : undefined
          }
        }
      };
      return accumulator;
    },
    {}
  );

  return JSON.stringify(
    {
      openapi: '3.0.3',
      info: {
        title: 'AetherForge Generated API',
        version: '1.0.0'
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        },
        schemas
      },
      paths,
      xAetherforgeValidation: {
        errors: validation.errors,
        warnings: validation.warnings
      },
      xAetherforgeNodes: serializable
    },
    null,
    2
  );
}

export function parseApiCode(code: string): APISerializableNode[] | null {
  const marker = `const ${API_MARKER} = `;
  const markerIndex = code.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const arrayStart = code.indexOf('[', markerIndex);
  if (arrayStart === -1) {
    return null;
  }

  const arrayEnd = code.indexOf('];', arrayStart);
  if (arrayEnd === -1) {
    return null;
  }

  try {
    const json = code.slice(arrayStart, arrayEnd + 1);
    const parsed = JSON.parse(json) as APISerializableNode[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
