type NamedIdOption = { id: number; name: string }

export type ItemFieldsInitial = {
  name: string
  description: string | null
  buyable: boolean
  price: number | null
  stackable: boolean
  holdable: boolean
  categoryIds: number[]
  boostedTypeId: number | null
  boostAmount: number | null
}

// [[Feature - GM Custom - Items]]: the item form -- name, description, buyable/price, stackable/
// holdable, category checkboxes (item_categories has ~12 rows, small enough to pick from directly,
// same shape as [[Feature - GM Custom - Pokemon]]'s own checkbox multi-selects), and an optional
// held-item type-boost pair. No `<form>` wrapper or submit button of its own -- unlike Pokemon's own
// split (forced by Moves/Passives needing a separate too-large-for-a-checkbox-wall editor), items have
// nothing that doesn't fit directly in one form, so /new and /[itemId] each just wrap this in their
// own plain <form action> with Save straight after, matching this codebase's own bottom-of-form Save
// convention with no extra wiring needed.
export function ItemFields({ types, categories, initial }: { types: NamedIdOption[]; categories: NamedIdOption[]; initial?: ItemFieldsInitial }) {
  return (
    <>
      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
        <h2 className="font-semibold">Basics</h2>

        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" required defaultValue={initial?.name} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="description">Description (optional)</label>
        <textarea id="description" name="description" defaultValue={initial?.description ?? ''} rows={3} className="bg-surface-subtle rounded border px-3 py-2" />
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Shop & Bag behavior</h2>

        <label className="flex items-center gap-2">
          <input type="checkbox" name="buyable" defaultChecked={initial?.buyable ?? false} />
          Buyable in the Catalog
        </label>

        <label htmlFor="price">Price (optional -- also used to sell this item back)</label>
        <input id="price" name="price" type="number" min={0} defaultValue={initial?.price ?? ''} className="bg-surface-subtle rounded border px-3 py-2" />

        <label className="flex items-center gap-2">
          <input type="checkbox" name="stackable" defaultChecked={initial?.stackable ?? true} />
          Stackable (multiple copies count as one Bag row)
        </label>

        <label className="flex items-center gap-2">
          <input type="checkbox" name="holdable" defaultChecked={initial?.holdable ?? true} />
          Holdable (a Pokémon can carry this as its held item)
        </label>
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Categories</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-1">
              <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={initial?.categoryIds.includes(c.id)} />
              {c.name}
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Held item type-boost (optional)</h2>
        <label htmlFor="boostedTypeId">Boosted type</label>
        <select id="boostedTypeId" name="boostedTypeId" defaultValue={initial?.boostedTypeId ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">None</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <label htmlFor="boostAmount">Boost amount</label>
        <input id="boostAmount" name="boostAmount" type="number" defaultValue={initial?.boostAmount ?? ''} className="bg-surface-subtle rounded border px-3 py-2" />
        <p className="text-xs text-muted">Both fields are needed together -- leave either blank to grant no boost.</p>
      </section>
    </>
  )
}
