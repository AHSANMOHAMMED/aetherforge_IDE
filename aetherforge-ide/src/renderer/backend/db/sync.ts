import type { DBEdge, DBNode, DBSerializableEdge, DBSerializableNode } from './types';

export const DB_PRISMA_VIRTUAL_PATH = 'virtual://backend/db/schema.prisma';
export const DB_PRISMA_VIRTUAL_NAME = 'schema.prisma';
export const DB_SUPABASE_VIRTUAL_PATH = 'virtual://backend/db/supabase.sql';
export const DB_SUPABASE_VIRTUAL_NAME = 'supabase.sql';

const DB_MARKER = 'aetherforgeDbNodes';
const DB_EDGE_MARKER = 'aetherforgeDbEdges';

function toSerializable(nodes: DBNode[]): DBSerializableNode[] {
  return nodes.map((node) => ({
    id: node.id,
    componentType: node.data.componentType,
    label: node.data.label,
    x: Math.round(node.position.x),
    y: Math.round(node.position.y),
    props: node.data.props
  }));
}

function toSerializableEdges(edges: DBEdge[]): DBSerializableEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    relationName: edge.data?.relationName,
    sourceField: edge.data?.sourceField,
    targetField: edge.data?.targetField,
    cardinality: edge.data?.cardinality,
    required: edge.data?.required,
    onDelete: edge.data?.onDelete,
    onUpdate: edge.data?.onUpdate
  }));
}

function normalizeModelName(value: string): string {
  return (
    value
      .split(/[^a-zA-Z0-9]/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('') || 'Model'
  );
}

function normalizeTableName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_') || 'generated_table'
  );
}

function mapColumnLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return '';
  }

  if (/\s/.test(trimmed)) {
    return trimmed;
  }

  return `${trimmed} String`;
}

type ParsedPrismaColumn = {
  name: string;
  type: string;
  attributes: string;
};

function parsePrismaColumn(line: string): ParsedPrismaColumn | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split(/\s+/);
  const [name, type, ...rest] = parts;
  if (!name) {
    return null;
  }

  const safeType = type || 'String';
  return {
    name,
    type: safeType,
    attributes: rest.join(' ')
  };
}

function sanitizePrismaIdentifier(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '');

  return normalized || fallback;
}

function ensureUniqueIdentifier(base: string, used: Set<string>): string {
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${base}_${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function toSqlType(prismaType: string, columnName: string): string {
  const normalized = prismaType.toLowerCase().replace(/\?/g, '').replace(/\[\]/g, '');
  if (columnName.toLowerCase() === 'id' || normalized === 'uuid') {
    return 'uuid';
  }
  if (normalized === 'int' || normalized === 'bigint') {
    return 'bigint';
  }
  if (normalized === 'float' || normalized === 'decimal') {
    return 'numeric';
  }
  if (normalized === 'boolean' || normalized === 'bool') {
    return 'boolean';
  }
  if (normalized === 'datetime') {
    return 'timestamptz';
  }

  return 'text';
}

type TableModel = {
  id: string;
  modelName: string;
  tableName: string;
  columns: ParsedPrismaColumn[];
};

function getOrDefaultColumnType(columns: ParsedPrismaColumn[], columnName: string): string {
  const found = columns.find((column) => column.name === columnName);
  if (found) {
    return found.type;
  }

  if (columnName.toLowerCase() === 'id') {
    return 'String';
  }

  return 'String';
}

function normalizePrismaScalarType(type: string): string {
  const normalized = type.trim();
  if (!normalized) {
    return 'String';
  }
  return normalized.replace(/\?/g, '').replace(/\[\]$/g, '') || 'String';
}

function mapRelationActionToSql(action: DBSerializableEdge['onDelete']): string {
  switch (action) {
    case 'Cascade':
      return 'CASCADE';
    case 'Restrict':
      return 'RESTRICT';
    case 'SetNull':
      return 'SET NULL';
    case 'SetDefault':
      return 'SET DEFAULT';
    case 'NoAction':
    default:
      return 'NO ACTION';
  }
}

function buildTableModels(nodes: DBSerializableNode[]): TableModel[] {
  return nodes
    .filter((node) => node.componentType === 'table')
    .map((table) => {
      const modelName = normalizeModelName(table.props.tableName ?? table.label);
      const tableName = normalizeTableName(table.props.tableName ?? table.label);
      const columns = (table.props.columns ?? '')
        .split('\n')
        .map(mapColumnLine)
        .filter(Boolean)
        .map(parsePrismaColumn)
        .filter((column): column is ParsedPrismaColumn => Boolean(column));

      return {
        id: table.id,
        modelName,
        tableName,
        columns
      };
    });
}

export type DbValidationResult = {
  warnings: string[];
  errors: string[];
};

export function validateDbGraphState(nodes: DBNode[], edges: DBEdge[]): DbValidationResult {
  const serializable = toSerializable(nodes);
  const tableModels = buildTableModels(serializable);
  const warnings: string[] = [];
  const errors: string[] = [];

  const tableById = new Map(tableModels.map((table) => [table.id, table]));
  const seenTableNames = new Set<string>();
  const seenRouteKeys = new Map<string, number>();
  const cascadeDeletesByTarget = new Map<string, string[]>();

  for (const table of tableModels) {
    const normalizedName = table.tableName;
    if (seenTableNames.has(normalizedName)) {
      errors.push(`Duplicate table name detected: ${normalizedName}`);
    }
    seenTableNames.add(normalizedName);

    const seenColumns = new Set<string>();
    for (const column of table.columns) {
      if (seenColumns.has(column.name)) {
        errors.push(`Duplicate column ${table.tableName}.${column.name}`);
      }
      seenColumns.add(column.name);
    }

    const primaryKey = table.columns.find((column) => /@id\b/.test(column.attributes));
    if (!primaryKey) {
      warnings.push(`Table ${table.tableName} has no explicit @id column.`);
    }
  }

  edges.forEach((edge, index) => {
    const source = tableById.get(edge.source);
    const target = tableById.get(edge.target);
    if (!source || !target) {
      errors.push(`Relation ${edge.id || index + 1} references missing table node.`);
      return;
    }

    const sourceField = sanitizePrismaIdentifier(
      edge.data?.sourceField ?? `${target.tableName}_id`,
      'source_id'
    );
    const targetField = sanitizePrismaIdentifier(edge.data?.targetField ?? 'id', 'id');
    const cardinality = edge.data?.cardinality ?? 'one-to-many';
    const onDelete = edge.data?.onDelete ?? 'NoAction';
    const required = Boolean(edge.data?.required);

    const routeKey = `${source.tableName}→${target.tableName}:${sourceField}`;
    const existingCount = seenRouteKeys.get(routeKey) ?? 0;
    if (existingCount > 0) {
      errors.push(
        `Duplicate FK relationship ${source.tableName}.${sourceField} → ${target.tableName}: use different field or relation.`
      );
    }
    seenRouteKeys.set(routeKey, existingCount + 1);

    if (source.id === target.id) {
      warnings.push(
        `Self-relation on ${source.tableName}: ensure ${sourceField} doesn't create ambiguity with back-reference.`
      );
    }

    const sourceHasField = source.columns.some((column) => column.name === sourceField);
    const targetHasField =
      target.columns.some((column) => column.name === targetField) || targetField === 'id';

    if (!targetHasField) {
      errors.push(
        `Relation ${source.tableName} → ${target.tableName} references missing target field ${targetField}.`
      );
    }

    if (!sourceHasField) {
      warnings.push(
        `Relation ${source.tableName} → ${target.tableName} will auto-add source field ${sourceField}.`
      );
    }

    if (cardinality === 'one-to-one' && !sourceField.toLowerCase().includes('id')) {
      warnings.push(
        `One-to-one relation ${source.tableName}.${sourceField}: consider using a more descriptive field name.`
      );
    }

    if (onDelete === 'Cascade') {
      const targetKey = `${target.tableName}`;
      const existing = cascadeDeletesByTarget.get(targetKey) ?? [];
      existing.push(`${source.tableName}.${sourceField}`);
      cascadeDeletesByTarget.set(targetKey, existing);
    }

    if (onDelete === 'SetNull' && required) {
      errors.push(
        `Relation ${source.tableName} → ${target.tableName}: cannot use SET NULL on required FK field ${sourceField}.`
      );
    }

    if ((onDelete === 'SetNull' || onDelete === 'SetDefault') && cardinality === 'one-to-one') {
      warnings.push(`One-to-one relation with ${onDelete} action may cause unintended data loss.`);
    }
  });

  for (const [targetTable, sources] of cascadeDeletesByTarget.entries()) {
    if (sources.length > 2) {
      warnings.push(
        `Table ${targetTable} has ${sources.length} incoming CASCADE DELETE relations: ${sources.join(', ')}. Consider implications.`
      );
    }
  }

  return { warnings, errors };
}

export function generatePrismaSchema(nodes: DBNode[], edges: DBEdge[] = []): string {
  const serializable = toSerializable(nodes);
  const serializableEdges = toSerializableEdges(edges);
  const validation = validateDbGraphState(nodes, edges);
  const tableModels = buildTableModels(serializable);
  const tableById = new Map(tableModels.map((table) => [table.id, table]));

  const modelState = new Map<
    string,
    {
      table: TableModel;
      lines: string[];
      usedIdentifiers: Set<string>;
    }
  >(
    tableModels.map((table) => {
      const columnLines = table.columns.map((column) => {
        const attrs = column.attributes ? ` ${column.attributes}` : '';
        return `${column.name} ${column.type}${attrs}`;
      });

      return [
        table.id,
        {
          table,
          lines: [...columnLines],
          usedIdentifiers: new Set(table.columns.map((column) => column.name))
        }
      ];
    })
  );

  edges.forEach((edge, index) => {
    const source = tableById.get(edge.source);
    const target = tableById.get(edge.target);
    if (!source || !target) {
      return;
    }

    const sourceState = modelState.get(source.id);
    const targetState = modelState.get(target.id);
    if (!sourceState || !targetState) {
      return;
    }

    const relationName = edge.data?.relationName || `relation_${index + 1}`;
    const sourceField = sanitizePrismaIdentifier(
      edge.data?.sourceField ?? `${target.tableName}_id`,
      'source_id'
    );
    const targetField = sanitizePrismaIdentifier(edge.data?.targetField ?? 'id', 'id');
    const cardinality = edge.data?.cardinality ?? 'one-to-many';
    const required = Boolean(edge.data?.required);
    const onDelete = edge.data?.onDelete ?? 'NoAction';
    const onUpdate = edge.data?.onUpdate ?? 'NoAction';

    if (!sourceState.usedIdentifiers.has(sourceField)) {
      const sourceFieldType = normalizePrismaScalarType(getOrDefaultColumnType(target.columns, targetField));
      const uniqueness = cardinality === 'one-to-one' ? ' @unique' : '';
      sourceState.lines.push(`${sourceField} ${sourceFieldType}${required ? '' : '?'}${uniqueness}`);
      sourceState.usedIdentifiers.add(sourceField);
    }

    const sourceRelationBase = sanitizePrismaIdentifier(
      edge.data?.relationName ?? `${target.modelName}_relation`,
      `relation${index + 1}`
    );
    const sourceRelationField = ensureUniqueIdentifier(sourceRelationBase, sourceState.usedIdentifiers);
    sourceState.lines.push(
      `${sourceRelationField} ${target.modelName}${required ? '' : '?'} @relation(name: "${relationName}", fields: [${sourceField}], references: [${targetField}], onDelete: ${onDelete}, onUpdate: ${onUpdate})`
    );

    const targetRelationBase = sanitizePrismaIdentifier(
      `${source.tableName}_${relationName}`,
      `${source.tableName}_items`
    );
    const targetRelationField = ensureUniqueIdentifier(targetRelationBase, targetState.usedIdentifiers);
    if (cardinality === 'one-to-one') {
      targetState.lines.push(
        `${targetRelationField} ${source.modelName}? @relation(name: "${relationName}")`
      );
    } else {
      targetState.lines.push(
        `${targetRelationField} ${source.modelName}[] @relation(name: "${relationName}")`
      );
    }
  });

  const modelBlocks = tableModels
    .map((table) => {
      const state = modelState.get(table.id);
      const bodyLines = state ? state.lines : [];
      if (bodyLines.length === 0) {
        bodyLines.push('id String @id');
      }
      const body = bodyLines.join('\n  ');
      return `model ${table.modelName} {\n  ${body}\n\n  @@map("${table.tableName}")\n}`;
    })
    .join('\n\n');

  const diagnostics = [
    ...validation.errors.map((line) => `- ERROR: ${line}`),
    ...validation.warnings.map((line) => `- WARN: ${line}`)
  ].join('\n');

  return `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n${diagnostics ? `/*\n${diagnostics}\n*/\n\n` : ''}const ${DB_MARKER} = ${JSON.stringify(serializable, null, 2)};\nconst ${DB_EDGE_MARKER} = ${JSON.stringify(serializableEdges, null, 2)};\n\n${modelBlocks || 'model Placeholder {\n  id String @id\n}'}\n`;
}

export function generateSupabaseSql(nodes: DBNode[], edges: DBEdge[] = []): string {
  const serializable = toSerializable(nodes);
  const validation = validateDbGraphState(nodes, edges);
  const tableModels = buildTableModels(serializable);
  const tableById = new Map(tableModels.map((table) => [table.id, table]));

  const createStatements = tableModels
    .map((table) => {
      const columns = [...table.columns];
      const existingColumnNames = new Set(columns.map((column) => column.name));

      edges
        .filter((edge) => edge.source === table.id)
        .forEach((edge) => {
          const target = tableById.get(edge.target);
          if (!target) {
            return;
          }

          const sourceField = sanitizePrismaIdentifier(
            edge.data?.sourceField ?? `${target.tableName}_id`,
            'source_id'
          );
          const targetField = sanitizePrismaIdentifier(edge.data?.targetField ?? 'id', 'id');
          const cardinality = edge.data?.cardinality ?? 'one-to-many';
          const required = Boolean(edge.data?.required);
          if (existingColumnNames.has(sourceField)) {
            return;
          }

          const targetFieldType = toSqlType(getOrDefaultColumnType(target.columns, targetField), sourceField);
          const attributes: string[] = [];
          if (required) {
            attributes.push('NOT NULL');
          }
          if (cardinality === 'one-to-one') {
            attributes.push('UNIQUE');
          }
          columns.push({ name: sourceField, type: targetFieldType, attributes: attributes.join(' ') });
          existingColumnNames.add(sourceField);
        });

      const mappedColumns = columns.length
        ? columns
            .map((column) => {
              if (column.name.toLowerCase() === 'id') {
                return 'id uuid primary key default gen_random_uuid()';
              }
              const attributes = column.attributes ? ` ${column.attributes}` : '';
              return `${column.name} ${toSqlType(column.type, column.name)}${attributes}`;
            })
            .filter((line): line is string => Boolean(line))
        : ['id uuid primary key default gen_random_uuid()'];

      return `create table if not exists public.${table.tableName} (\n  ${mappedColumns.join(',\n  ')}\n);`;
    })
    .join('\n\n');

  const foreignKeys = edges
    .map((edge, index) => {
      const source = tableById.get(edge.source);
      const target = tableById.get(edge.target);
      if (!source || !target) {
        return null;
      }

      const sourceField = sanitizePrismaIdentifier(
        edge.data?.sourceField ?? `${target.tableName}_id`,
        'source_id'
      );
      const targetField = sanitizePrismaIdentifier(edge.data?.targetField ?? 'id', 'id');
      const onDeleteSql = mapRelationActionToSql(edge.data?.onDelete ?? 'NoAction');
      const onUpdateSql = mapRelationActionToSql(edge.data?.onUpdate ?? 'NoAction');
      const relationName = sanitizePrismaIdentifier(
        edge.data?.relationName ?? `fk_${source.tableName}_${target.tableName}_${index + 1}`,
        `fk_${index + 1}`
      );

      const targetHasColumn =
        target.columns.some((column) => column.name === targetField) || targetField === 'id';
      if (!targetHasColumn) {
        return `-- Skipped FK ${relationName}: unresolved target column ${target.tableName}.${targetField}`;
      }

      return `alter table if exists public.${source.tableName}\n  add constraint ${relationName}\n  foreign key (${sourceField}) references public.${target.tableName} (${targetField})\n  on delete ${onDeleteSql}\n  on update ${onUpdateSql};`;
    })
    .filter((line): line is string => Boolean(line))
    .join('\n\n');

  const uniqueConstraints = edges
    .map((edge, index) => {
      const source = tableById.get(edge.source);
      const target = tableById.get(edge.target);
      if (!source || !target) {
        return null;
      }

      const cardinality = edge.data?.cardinality ?? 'one-to-many';
      if (cardinality !== 'one-to-one') {
        return null;
      }

      const sourceField = sanitizePrismaIdentifier(
        edge.data?.sourceField ?? `${target.tableName}_id`,
        'source_id'
      );
      const uniqueName = sanitizePrismaIdentifier(
        `${edge.data?.relationName ?? `uq_${source.tableName}_${sourceField}`}_${index + 1}_uniq`,
        `uq_${index + 1}`
      );

      return `alter table if exists public.${source.tableName}\n  add constraint ${uniqueName}\n  unique (${sourceField});`;
    })
    .filter((line): line is string => Boolean(line))
    .join('\n\n');

  const diagnostics = [
    ...validation.errors.map((line) => `-- ERROR: ${line}`),
    ...validation.warnings.map((line) => `-- WARN: ${line}`)
  ].join('\n');
  const sqlParts = [diagnostics, createStatements, uniqueConstraints, foreignKeys].filter(Boolean);
  return `${sqlParts.join('\n\n') || '-- Add tables in DB Visual Builder to generate SQL'}\n`;
}

function parseMarkerArray<T>(code: string, markerName: string): T[] | null {
  const marker = `const ${markerName} = `;
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
    const parsed = JSON.parse(json) as T[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseDbGraph(
  code: string
): { nodes: DBSerializableNode[]; edges: DBSerializableEdge[] } | null {
  const nodes = parseMarkerArray<DBSerializableNode>(code, DB_MARKER);
  if (!nodes) {
    return null;
  }

  const edges = parseMarkerArray<DBSerializableEdge>(code, DB_EDGE_MARKER) ?? [];
  return { nodes, edges };
}

export function parseDbSchema(code: string): DBSerializableNode[] | null {
  const graph = parseDbGraph(code);
  return graph ? graph.nodes : null;
}
