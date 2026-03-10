/**
 * Fetches all rows from a Supabase query, bypassing the default 1000-row limit.
 * Uses batch pagination with .range() to load data in chunks.
 */
export async function fetchAllRows<T = any>(
  queryBuilder: any,
  batchSize = 1000
): Promise<T[]> {
  let allRows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await queryBuilder.range(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  return allRows;
}
