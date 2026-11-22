// Supabase (PostgREST) returns at most 1000 rows per request, so a plain `select` on a table that grows past that
// silently stops at row 1000. The global Pokedex crossed 1000 species with
// [[Improvement - Expand Pokedex species and learnset coverage for excluded PokeAPI slugs]], which is why this exists.
//
// `page(from, to)` must build a fresh query with a stable order (e.g. `.order('name').order('id')`) and end in
// `.range(from, to)`; it is called again until a page comes back short.
const PAGE_SIZE = 1000

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<{ data: T[]; error: unknown }> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) return { data: rows, error }
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) return { data: rows, error: null }
  }
}
