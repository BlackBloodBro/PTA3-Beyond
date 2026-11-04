export type ItemCategoryFieldsInitial = {
  name: string
  description: string | null
  show_in_encounters: boolean
}

// [[Feature - GM Custom - Item Category]]: the simplest fields component in the whole "GM Custom X"
// family -- item_categories is just (name, description), no relation tables of its own.
export function ItemCategoryFields({ initial }: { initial?: ItemCategoryFieldsInitial }) {
  return (
    <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
      <h2 className="font-semibold">Basics</h2>

      <label htmlFor="name">Name</label>
      <input id="name" name="name" type="text" required defaultValue={initial?.name} className="bg-surface-subtle rounded border px-3 py-2" />

      <label htmlFor="description">Description (optional)</label>
      <textarea id="description" name="description" defaultValue={initial?.description ?? ''} rows={3} className="bg-surface-subtle rounded border px-3 py-2" />

      <label className="flex items-center gap-2">
        <input type="checkbox" name="show_in_encounters" defaultChecked={initial?.show_in_encounters ?? false} />
        Show items in Encounters
      </label>
      <p className="text-xs text-muted">Items in this category are listed in a Trainer&apos;s Encounter actions. Other items stay hidden unless &quot;Show all items&quot; is clicked.</p>
    </section>
  )
}
