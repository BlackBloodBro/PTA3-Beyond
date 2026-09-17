export type ProficiencyFieldsInitial = {
  name: string
  description: string | null
}

// [[Feature - GM Custom - Proficiency]]: the simplest fields component in the whole "GM Custom X"
// family, tied with [[Feature - GM Custom - Item Category]] -- proficiencies is just (name,
// description), no relation tables of its own.
export function ProficiencyFields({ initial }: { initial?: ProficiencyFieldsInitial }) {
  return (
    <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
      <h2 className="font-semibold">Basics</h2>

      <label htmlFor="name">Name</label>
      <input id="name" name="name" type="text" required defaultValue={initial?.name} className="bg-surface-subtle rounded border px-3 py-2" />

      <label htmlFor="description">Description (optional)</label>
      <textarea id="description" name="description" defaultValue={initial?.description ?? ''} rows={3} className="bg-surface-subtle rounded border px-3 py-2" />
    </section>
  )
}
