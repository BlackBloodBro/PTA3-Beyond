type NamedIdOption = { id: number; name: string }

export type MoveFieldsInitial = {
  name: string
  type_id: number
  damage_stat: string
  range: string | null
  frequency: string | null
  damage_dice: string | null
  description: string | null
  proficiencyIds: number[]
}

// [[Feature - GM Custom - Moves]]: one form covers the whole entity -- no relation-table matrix
// problem like GM Custom Type's own type-effectiveness scope, and no size-driven form split like GM
// Custom Pokemon's learnset needed. Proficiencies (58 rows) are a plain checkbox multi-select, same
// shape as Pokemon's habitat/proficiency checkboxes -- small enough to always show every option.
export function MoveFields({ types, proficiencies, initial }: { types: NamedIdOption[]; proficiencies: NamedIdOption[]; initial?: MoveFieldsInitial }) {
  return (
    <>
      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
        <h2 className="font-semibold">Basics</h2>

        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" required defaultValue={initial?.name} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="typeId">Type</label>
        <select id="typeId" name="typeId" required defaultValue={initial?.type_id ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="" disabled>
            Select...
          </option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <label htmlFor="damageStat">Damage stat</label>
        <select id="damageStat" name="damageStat" required defaultValue={initial?.damage_stat ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="" disabled>
            Select...
          </option>
          <option value="physical">Physical</option>
          <option value="special">Special</option>
          <option value="either">Either</option>
          <option value="effect">Effect (non-damage)</option>
        </select>

        <label htmlFor="range">Range (optional)</label>
        <input id="range" name="range" type="text" placeholder="e.g. Melee, Ranged (20ft)" defaultValue={initial?.range ?? ''} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="frequency">Frequency (optional)</label>
        <input id="frequency" name="frequency" type="text" placeholder="e.g. At will, 1/day, 3/day" defaultValue={initial?.frequency ?? ''} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="damageDice">Damage dice (optional)</label>
        <input id="damageDice" name="damageDice" type="text" placeholder="e.g. 2d6" defaultValue={initial?.damage_dice ?? ''} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="description">Description (optional)</label>
        <textarea id="description" name="description" defaultValue={initial?.description ?? ''} rows={3} className="bg-surface-subtle rounded border px-3 py-2" />
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Move Proficiencies</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {proficiencies.map((p) => (
            <label key={p.id} className="flex items-center gap-1">
              <input type="checkbox" name="proficiencyIds" value={p.id} defaultChecked={initial?.proficiencyIds.includes(p.id)} />
              {p.name}
            </label>
          ))}
        </div>
      </section>
    </>
  )
}
