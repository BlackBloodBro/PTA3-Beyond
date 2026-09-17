import { MATCHUP_CHOICES, type MatchupChoice } from './matchupChoices'

type NamedIdOption = { id: number; name: string }

export type TypeFieldsInitial = {
  name: string
  selfChoice: MatchupChoice
  matchupsByOtherTypeId: Record<number, { attack: MatchupChoice; defend: MatchupChoice }>
}

const CHOICE_LABELS: Record<MatchupChoice, string> = {
  immune: 'Immune (0x)',
  resisted: 'Resisted (-1 die)',
  neutral: 'Neutral',
  effective: 'Super-effective (+1 die)',
}

function MatchupSelect({ name, defaultValue }: { name: string; defaultValue?: MatchupChoice }) {
  return (
    <select id={name} name={name} required defaultValue={defaultValue ?? ''} className="bg-surface-subtle rounded border px-2 py-1 text-sm">
      <option value="" disabled>
        Select...
      </option>
      {MATCHUP_CHOICES.map((c) => (
        <option key={c} value={c}>
          {CHOICE_LABELS[c]}
        </option>
      ))}
    </select>
  )
}

// [[Feature - GM Custom - Type]]: forces an explicit pick for every matchup relationship (per the
// user's own choice of "force a full walkthrough" over "default neutral, override individually") --
// one row per other Type currently visible to this Campaign (global + this Campaign's own other
// customs), each needing both directions (this Type attacking it, and it attacking this Type), plus a
// single self-matchup pick since attacking_type_id = defending_type_id collapses both directions into
// one relationship for that one case.
export function TypeFields({ otherTypes, initial }: { otherTypes: NamedIdOption[]; initial?: TypeFieldsInitial }) {
  return (
    <>
      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
        <h2 className="font-semibold">Basics</h2>

        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" required defaultValue={initial?.name} className="bg-surface-subtle rounded border px-3 py-2" />
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Self-matchup</h2>
        <p className="text-xs text-muted">How this Type matches up against itself (e.g. Fire is resisted by Fire in the global chart).</p>
        <label htmlFor="self">This Type vs. itself</label>
        <MatchupSelect name="self" defaultValue={initial?.selfChoice} />
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Matchups against every other Type ({otherTypes.length})</h2>
        <p className="text-xs text-muted">
          Every relationship needs an explicit pick -- both directions are independent (this Type&apos;s attack vs. a Type isn&apos;t the same as
          that Type&apos;s attack vs. this one).
        </p>
        <div className="flex flex-col gap-3">
          {otherTypes.map((t) => {
            const rowInitial = initial?.matchupsByOtherTypeId[t.id]
            return (
              <div key={t.id} className="grid grid-cols-[1fr_auto] items-start gap-2 border-b border-accent/30 pb-2 last:border-0">
                <span className="pt-1 font-medium">{t.name}</span>
                <div className="flex flex-col gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted">This Type attacking {t.name}</span>
                    <MatchupSelect name={`attack_${t.id}`} defaultValue={rowInitial?.attack} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-muted">{t.name} attacking this Type</span>
                    <MatchupSelect name={`defend_${t.id}`} defaultValue={rowInitial?.defend} />
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}
