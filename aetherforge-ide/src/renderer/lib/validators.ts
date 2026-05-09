const INVALID_FS_NAME_PATTERN = /[\\/]/;

export function validateFileSystemName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Name is required.';
  }
  if (INVALID_FS_NAME_PATTERN.test(trimmed)) {
    return 'Name cannot include / or \\.';
  }
  if (trimmed === '.' || trimmed === '..') {
    return 'Reserved name is not allowed.';
  }
  return null;
}
