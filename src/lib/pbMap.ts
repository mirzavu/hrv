// Utility functions to map PocketBase records to app format
// by mapping PB's `id` field to `$id` for client compatibility

export function withDollarId<T extends { id: string }>(record: T): T & { $id: string } {
  return { ...record, $id: record.id };
}

export function withDollarIdList<T extends { id: string }>(items: T[]): Array<T & { $id: string }> {
  return items.map(withDollarId);
}

// Helper to chunk arrays (used for batching large queries)
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export default { withDollarId, withDollarIdList, chunk };