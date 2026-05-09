import { z } from 'zod';

/**
 * Minimal zod helpers for OpenAPI-ish request/response bodies generated from
 * the API canvas. Full `zod-to-openapi` integration is wired at build-time in
 * V2 CI; here we validate payloads before emitting JSON Schema fragments.
 */

export const HttpMethodSchema = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export const ApiRouteBodySchema = z.object({
  name: z.string().min(1),
  fields: z.array(
    z.object({
      name: z.string(),
      type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
      required: z.boolean().optional()
    })
  )
});

export type ApiRouteBody = z.infer<typeof ApiRouteBodySchema>;

export function bodyToJsonSchema(body: ApiRouteBody): Record<string, unknown> {
  const parsed = ApiRouteBodySchema.safeParse(body);
  if (!parsed.success) {
    return { type: 'object', additionalProperties: true };
  }
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const f of parsed.data.fields) {
    properties[f.name] = { type: f.type === 'array' ? 'array' : f.type };
    if (f.required) required.push(f.name);
  }
  return {
    type: 'object',
    properties,
    ...(required.length ? { required } : {})
  };
}
