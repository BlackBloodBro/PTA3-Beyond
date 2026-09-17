type NamedIdOption = { id: number; name: string }

export type PassiveFieldsInitial = {
  name: string
  description: string | null
  passive_type: string
  category: string | null
  context: string | null
  statModifiers: Record<number, number>
}

const CATEGORIES = [
  { value: 'attack', label: 'Attack' },
  { value: 'defense', label: 'Defense' },
  { value: 'special_attack', label: 'Special Attack' },
  { value: 'special_defense', label: 'Special Defense' },
  { value: 'speed', label: 'Speed' },
  { value: 'mix', label: 'Mix' },
  { value: 'critical_hit', label: 'Critical Hit' },
]

// [[Feature - GM Custom - Passives]]: name/description/passive_type/category/context, plus a fixed
// grid of stat modifiers for Stat-type Passives -- passives_stats supports more than one stat, but
// there are only 6 total, same "always show every option" call as
// [[Feature - GM Custom - Afflictions]]'s own stat grid. category only applies to Stat passives;
// context is optional either way (only Ability passives folded in from the Handbook's "Pokemon
// Skills" ever set it to 'out_of_combat').
export function PassiveFields({ stats, initial }: { stats: NamedIdOption[]; initial?: PassiveFieldsInitial }) {
  return (
    <>
      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
        <h2 className="font-semibold">Basics</h2>

        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" required defaultValue={initial?.name} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="description">Description (optional)</label>
        <textarea id="description" name="description" defaultValue={initial?.description ?? ''} rows={3} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="passiveType">Passive type</label>
        <select id="passiveType" name="passiveType" required defaultValue={initial?.passive_type ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="" disabled>
            Select...
          </option>
          <option value="stat">Stat</option>
          <option value="ability">Ability</option>
        </select>

        <label htmlFor="category">Category (Stat passives only)</label>
        <select id="category" name="category" defaultValue={initial?.category ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">None</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        <label htmlFor="context">Context (optional)</label>
        <select id="context" name="context" defaultValue={initial?.context ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">Either</option>
          <option value="combat">Combat only</option>
          <option value="out_of_combat">Out of combat only</option>
        </select>
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Stat modifiers (optional)</h2>
        <p className="text-xs text-muted">Only meaningful for a Stat passive. Leave a stat blank for no modifier.</p>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((s) => (
            <label key={s.id} className="flex flex-col gap-1 text-sm">
              {s.name}
              <input
                name={`statModifier_${s.id}`}
                type="number"
                defaultValue={initial?.statModifiers[s.id] ?? ''}
                className="bg-surface-subtle rounded border px-3 py-2"
              />
            </label>
          ))}
        </div>
      </section>
    </>
  )
}
