import type { DBComponentType, DBNodeProps } from './types';

export type DBPaletteItem = {
  type: DBComponentType;
  label: string;
  description: string;
  defaultProps: DBNodeProps;
};

export const DB_PALETTE: DBPaletteItem[] = [
  {
    type: 'table',
    label: 'Table',
    description: 'Database table schema',
    defaultProps: {
      tableName: 'users',
      columns: 'id String @id\nemail String @unique\ncreatedAt DateTime @default(now())',
      primaryKey: 'id'
    }
  },
  {
    type: 'view',
    label: 'View',
    description: 'Read-only view projection',
    defaultProps: {
      tableName: 'active_users_view',
      columns: 'id\nemail\nlastSeenAt'
    }
  }
];

export function getDbPaletteItem(type: DBComponentType): DBPaletteItem {
  const item = DB_PALETTE.find((candidate) => candidate.type === type);
  if (!item) {
    throw new Error(`Unknown DB component type: ${type}`);
  }
  return item;
}
