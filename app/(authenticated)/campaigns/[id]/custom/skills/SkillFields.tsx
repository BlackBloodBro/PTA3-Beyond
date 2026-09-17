type NamedIdOption = { id: number; name: string }

export type SkillFieldsInitial = {
  name: string
  stat_id: number
}

// [[Feature - GM Custom - Skills]]: name + governing stat only -- skills has no relation tables of
// its own, and the real complexity for this FR is entirely in the delete-in-use guard, not the form.
export function SkillFields({ stats, initial }: { stats: NamedIdOption[]; initial?: SkillFieldsInitial }) {
  return (
    <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
      <h2 className="font-semibold">Basics</h2>

      <label htmlFor="name">Name</label>
      <input id="name" name="name" type="text" required defaultValue={initial?.name} className="bg-surface-subtle rounded border px-3 py-2" />

      <label htmlFor="statId">Governing stat</label>
      <select id="statId" name="statId" required defaultValue={initial?.stat_id ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
        <option value="" disabled>
          Select...
        </option>
        {stats.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </section>
  )
}
