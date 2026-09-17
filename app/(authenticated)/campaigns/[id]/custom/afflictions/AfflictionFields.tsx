type NamedIdOption = { id: number; name: string }

export type AfflictionFieldsInitial = {
  name: string
  description: string | null
  catch_modifier: number | null
  statModifiers: Record<number, number>
}

// [[Feature - GM Custom - Afflictions]]: name/description/catch_modifier plus a fixed grid of stat
// modifiers (afflictions_stats supports more than one stat per affliction, but there are only 6 stats
// total -- small enough to always show every option directly, same call as GM Custom Pokemon's
// habitat/proficiency checkboxes, rather than a dynamic add/remove list). A blank stat input means "no
// modifier for that stat", not "modifier 0" -- only stats a GM actually fills in get an
// afflictions_stats row.
export function AfflictionFields({ stats, initial }: { stats: NamedIdOption[]; initial?: AfflictionFieldsInitial }) {
  return (
    <>
      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
        <h2 className="font-semibold">Basics</h2>

        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" required defaultValue={initial?.name} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="description">Description (optional)</label>
        <textarea id="description" name="description" defaultValue={initial?.description ?? ''} rows={3} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="catchModifier">Catch modifier (optional)</label>
        <input id="catchModifier" name="catchModifier" type="number" defaultValue={initial?.catch_modifier ?? ''} className="bg-surface-subtle rounded border px-3 py-2" />
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Stat modifiers (optional)</h2>
        <p className="text-xs text-muted">Leave a stat blank for no modifier.</p>
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
