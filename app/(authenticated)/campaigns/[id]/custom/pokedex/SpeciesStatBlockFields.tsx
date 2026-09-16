type NamedIdOption = { id: number; name: string }

export type SpeciesStatBlockInitial = {
  name: string
  type_1_id: number
  type_2_id: number | null
  size_id: number | null
  weight_id: number | null
  growth_rate_id: number | null
  base_hp: number
  base_atk: number
  base_def: number
  base_sp_atk: number
  base_sp_def: number
  base_speed: number
  catch_rate: number | null
  egg_hatch_rate: string | null
  description: string | null
  sprite_code: string | null
  habitatIds: number[]
  proficiencyIds: number[]
  dietIds: number[]
  eggGroupIds: number[]
}

// [[Feature - GM Custom - Pokemon]]: the stat-block fields (name, types, size/weight/growth rate, the
// 6 base stats, catch rate, egg hatch rate, description, sprite code) plus the checkbox multi-selects
// (34/58/14/11 rows -- small enough to pick from directly, per the FR's own row-count check). No
// <form> wrapper or submit button of its own -- the edit page wraps it in a plain <form action>, and
// the create page wraps it in a client <form onSubmit> alongside the Moves/Passives staging editor
// ([[Feature - GM Custom - Pokemon]]'s creation-time Moves/Passives + species-template addendum,
// 2026-09-17) -- both need their own outer <form> and submit button, so this stays a pure field set.
export function SpeciesStatBlockFields({
  types,
  sizes,
  weights,
  growthRates,
  habitats,
  proficiencies,
  diets,
  eggGroups,
  initial,
}: {
  types: NamedIdOption[]
  sizes: NamedIdOption[]
  weights: NamedIdOption[]
  growthRates: NamedIdOption[]
  habitats: NamedIdOption[]
  proficiencies: NamedIdOption[]
  diets: NamedIdOption[]
  eggGroups: NamedIdOption[]
  initial?: SpeciesStatBlockInitial
}) {
  return (
    <>
      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
        <h2 className="font-semibold">Basics</h2>

        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" required defaultValue={initial?.name} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="type1Id">Type 1</label>
        <select id="type1Id" name="type1Id" required defaultValue={initial?.type_1_id ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="" disabled>
            Select...
          </option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <label htmlFor="type2Id">Type 2 (optional)</label>
        <select id="type2Id" name="type2Id" defaultValue={initial?.type_2_id ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">None</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        <label htmlFor="sizeId">Size</label>
        <select id="sizeId" name="sizeId" defaultValue={initial?.size_id ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">None</option>
          {sizes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <label htmlFor="weightId">Weight</label>
        <select id="weightId" name="weightId" defaultValue={initial?.weight_id ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">None</option>
          {weights.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <label htmlFor="growthRateId">Growth rate</label>
        <select id="growthRateId" name="growthRateId" defaultValue={initial?.growth_rate_id ?? ''} className="bg-surface-subtle rounded border px-3 py-2">
          <option value="">None</option>
          {growthRates.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
        <h2 className="font-semibold">Base stats</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            HP
            <input name="baseHp" type="number" required min={1} defaultValue={initial?.base_hp} className="bg-surface-subtle rounded border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Attack
            <input name="baseAtk" type="number" required min={1} defaultValue={initial?.base_atk} className="bg-surface-subtle rounded border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Defense
            <input name="baseDef" type="number" required min={1} defaultValue={initial?.base_def} className="bg-surface-subtle rounded border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Special Attack
            <input name="baseSpAtk" type="number" required min={1} defaultValue={initial?.base_sp_atk} className="bg-surface-subtle rounded border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Special Defense
            <input name="baseSpDef" type="number" required min={1} defaultValue={initial?.base_sp_def} className="bg-surface-subtle rounded border px-3 py-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Speed
            <input name="baseSpeed" type="number" required min={1} defaultValue={initial?.base_speed} className="bg-surface-subtle rounded border px-3 py-2" />
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4">
        <h2 className="font-semibold">Flavor & details</h2>

        <label htmlFor="catchRate">Catch rate (optional)</label>
        <input id="catchRate" name="catchRate" type="number" min={0} defaultValue={initial?.catch_rate ?? ''} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="eggHatchRate">Egg hatch rate (optional)</label>
        <input id="eggHatchRate" name="eggHatchRate" type="text" defaultValue={initial?.egg_hatch_rate ?? ''} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="description">Description (optional)</label>
        <textarea id="description" name="description" defaultValue={initial?.description ?? ''} rows={3} className="bg-surface-subtle rounded border px-3 py-2" />

        <label htmlFor="spriteCode">Sprite code (optional)</label>
        <input
          id="spriteCode"
          name="spriteCode"
          type="text"
          placeholder="e.g. an existing species' slug to reuse its look"
          defaultValue={initial?.sprite_code ?? ''}
          className="bg-surface-subtle rounded border px-3 py-2"
        />
        <p className="text-xs text-muted">Leave blank to show the plain placeholder box instead of a sprite.</p>
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Habitats</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {habitats.map((h) => (
            <label key={h.id} className="flex items-center gap-1">
              <input type="checkbox" name="habitatIds" value={h.id} defaultChecked={initial?.habitatIds.includes(h.id)} />
              {h.name}
            </label>
          ))}
        </div>
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

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Egg Groups</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {eggGroups.map((e) => (
            <label key={e.id} className="flex items-center gap-1">
              <input type="checkbox" name="eggGroupIds" value={e.id} defaultChecked={initial?.eggGroupIds.includes(e.id)} />
              {e.name}
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded border border-accent bg-accent/10 p-4 text-sm">
        <h2 className="font-semibold">Diets</h2>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {diets.map((d) => (
            <label key={d.id} className="flex items-center gap-1">
              <input type="checkbox" name="dietIds" value={d.id} defaultChecked={initial?.dietIds.includes(d.id)} />
              {d.name}
            </label>
          ))}
        </div>
      </section>
    </>
  )
}
