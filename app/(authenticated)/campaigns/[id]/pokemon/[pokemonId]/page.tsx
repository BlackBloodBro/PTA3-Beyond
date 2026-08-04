import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updatePokemonDetails } from '@/app/(authenticated)/pokemon/actions'
import { computePokemonLevel } from '@/lib/pta3/pokemonLevel'
import { resolveWildPokemonAuthority } from '@/lib/pta3/pokemonAuthority'
import { trainerHref } from '@/lib/pta3/trainerPaths'
import { pokemonHref } from '@/lib/pta3/pokemonPaths'
import { isBookmarked } from '@/lib/pta3/bookmarks'
import { BookmarkToggle } from '@/components/BookmarkToggle'
import { PokemonSprite } from '@/components/PokemonSprite'
import {
  PokemonStateProvider,
  LevelLine,
  ExperienceSection,
  StatsSection,
  MovesSection,
  AfflictionsSection,
  PassivesSection,
  HpSection,
  type KnownMoveEntry,
  type LearnsetEntry,
  type AfflictionInfo,
  type PassiveInfo,
  type KnownPassiveEntry,
  type PassiveLearnsetEntry,
} from '@/app/(authenticated)/pokemon/[pokemonId]/PokemonInteractive'

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  genderless: 'Genderless',
}

// Mirrors pokemon/[pokemonId]/page.tsx almost exactly -- same shared PokemonInteractive components
// and data-fetching, just under a campaign-scoped path for a Trainer/NPC-owned Pokemon whose owning
// Trainer belongs to a Campaign. Sibling of campaigns/[id]/wild-pokemon/[pokemonId] (that one covers
// ownerless Pokemon); see [[Give Wild Pokemon their own campaign-scoped page]] for the original
// reasoning this extends.
export default async function CampaignPokemonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pokemonId: string }>
  searchParams: Promise<{ error?: string; editMoves?: string; editInfo?: string; editPassives?: string }>
}) {
  const { id: campaignId, pokemonId } = await params
  const { error, editMoves, editInfo, editPassives } = await searchParams
  const isEditingMoves = editMoves === '1'
  const isEditingPassives = editPassives === '1'
  const isEditingInfo = editInfo === '1'
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // No .eq('user_id', ...) filter -- pokemon's RLS already scopes this to the owner, the
  // campaign's GM, or a fellow campaign member, same reasoning as the trainer page.
  const { data: pokemon } = await supabase
    .from('pokemon')
    .select(
      `
      id, nickname, current_exp, current_hp, temporary_hp, gender, is_shiny,
      ev_hp, ev_attack, ev_defense, ev_special_attack, ev_special_defense, ev_speed,
      pokedex_id, nature_id, loyalty_id, type_1_id, type_2_id, size_id, weight_id, held_item_id,
      created_by_user_id, campaign:campaign_id(id, name, gm_user_id),
      pokedex:pokedex_id (
        name, description, base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed,
        egg_hatch_rate, growth_rate_id, sprite_code,
        type_1:types!type_1_id(name), type_2:types!type_2_id(name),
        size:sizes!size_id(name), weight:weights!weight_id(name),
        growth_rate:growth_rates!growth_rate_id(name, exp_modifier)
      ),
      override_type_1:types!type_1_id(name),
      override_type_2:types!type_2_id(name),
      override_size:sizes!size_id(name),
      override_weight:weights!weight_id(name),
      nature:natures!nature_id(
        name,
        increased:stats!increased_stat_id(name),
        decreased:stats!decreased_stat_id(name)
      ),
      loyalty:loyalties!loyalty_id(name, modifier),
      held_item:items!held_item_id(name),
      trainers_pokemon(
        trainer_id, obtain_method_id,
        trainers(name, user_id, is_npc, campaigns(id, name, gm_user_id)),
        obtain_method:obtain_methods!obtain_method_id(name, modifier)
      )
    `,
    )
    .eq('id', pokemonId)
    .single()

  if (!pokemon) {
    redirect('/pokemon')
  }

  // trainers_pokemon.pokemon_id is a primary key (one owner at a time), so PostgREST returns this
  // embed as a single object rather than an array -- unlike most other reverse embeds in this
  // codebase, which come back as arrays even for practically-1:1 relations. TS still infers it as
  // an array (same generic-join-typing gap as everywhere else in this project), so this cast
  // reflects the real runtime shape rather than what the type says.
  const ownerLink = pokemon.trainers_pokemon as unknown as {
    trainer_id: string
    obtain_method_id: number | null
    trainers: { name: string; user_id: string; is_npc: boolean; campaigns: { id: string; name: string; gm_user_id: string } | null } | null
    obtain_method: { name: string; modifier: number } | null
  } | null
  const trainer = ownerLink?.trainers
  const trainerId = ownerLink?.trainer_id ?? null
  const trainerLinkHref =
    trainerId && trainer ? trainerHref({ id: trainerId, is_npc: trainer.is_npc, campaign_id: trainer.campaigns?.id ?? null }) : null
  // Campaign comes from wherever it actually lives: a trainer-assigned Pokemon's campaign is its
  // trainer's campaign; a Wild/pool Pokemon carries its own campaign_id directly (the "which
  // campaign's pool is this in" tag from the Wild Pokemon list / /pokemon/new).
  const poolCampaign = pokemon.campaign as unknown as { id: string; name: string; gm_user_id: string } | null
  const campaign = trainer ? trainer.campaigns : poolCampaign

  // An ownerless Pokemon (or one owned by a Trainer belonging to a different campaign than the URL
  // claims) doesn't resolve here -- this namespace is exclusively for this campaign's own
  // Trainer/NPC-owned Pokemon. Checked via the raw `pokemon.trainers_pokemon` (not the manually-cast
  // `ownerLink`) so TS's aliased-condition narrowing has no binding back to `ownerLink` -- it stays
  // its declared `{...} | null` type for every `ownerLink?.` access below instead of collapsing to
  // `never`.
  if (!pokemon.trainers_pokemon || campaign?.id !== campaignId) {
    notFound()
  }

  const basePath = pokemonHref({ id: pokemonId, hasOwner: true, campaignId })
  // A Wild/pool Pokemon has no trainers_pokemon row at all -- its GM-tier authority is the real GM of
  // whatever campaign it's tagged to, or its creator if it isn't tagged to one at all (see
  // resolveWildPokemonAuthority) -- both isOwner and isGM collapse to that same check here rather
  // than looking at a trainer that doesn't exist. This intentionally also grants the GM-only edit
  // fields (gender, nature, type...) to an untagged pool Pokemon's creator -- consistent with RLS
  // already treating them as fully in charge of it, not a lesser "owner" tier.
  const poolAuthority = resolveWildPokemonAuthority(
    { campaignId: poolCampaign?.id ?? null, campaignGmUserId: poolCampaign?.gm_user_id ?? null, createdByUserId: pokemon.created_by_user_id },
    user.id,
  )
  const isOwner = trainer ? trainer.user_id === user.id : poolAuthority
  // No campaign -> no GM to defer to -- falls back to the Trainer's own owner, same rule as the
  // write-side actions (updatePokemonDetails/addPokemonExp/loadPokemonEvContext). Without this, the
  // GM-only fields below never even render for a campaign-less Trainer's own Pokemon.
  const isGM = trainer ? (trainer.campaigns ? trainer.campaigns.gm_user_id === user.id : trainer.user_id === user.id) : poolAuthority
  // Everyone who can reach Edit mode at all can at least change the Nickname; GM-only fields are
  // further gated inside the form itself.
  const canEditInfo = isOwner || isGM
  const bookmarked = await isBookmarked(supabase, user.id, 'pokemon', pokemonId)
  const species = pokemon.pokedex

  if (!species) {
    redirect('/pokemon')
  }

  // Type/Size/Weight can be overridden per-Pokemon by a GM (nullable columns on `pokemon`); null
  // means "use the species default" -- same fallback shape held_item_id already has, just with a
  // real default to fall back to instead of "none". Type 2 only supports override-or-default, not
  // a third "force mono-type" state (see the migration's comment).
  const effectiveType1 = pokemon.override_type_1?.name ?? species.type_1?.name
  const effectiveType2 = pokemon.type_2_id ? pokemon.override_type_2?.name : species.type_2?.name
  const effectiveSize = pokemon.override_size?.name ?? species.size?.name
  const effectiveWeight = pokemon.override_weight?.name ?? species.weight?.name

  // Level is never stored -- always recomputed from current_exp and the four modifiers so it
  // reflects any change (exp award, loyalty shift, obtain method, shininess) immediately.
  const { level, effectiveExp } = await computePokemonLevel(supabase, {
    currentExp: pokemon.current_exp,
    isShiny: pokemon.is_shiny,
    loyaltyId: pokemon.loyalty_id,
    obtainMethodId: ownerLink?.obtain_method_id ?? null,
    growthRateId: species.growth_rate_id,
  })

  // Stat "Value" = species base + this Pokemon's EV allocation (homebrew: 1 EV per 8 levels, max
  // 2 EVs/stat, +1/EV except HP which is +6/EV) + a +1/-1 nature adjustment on its raised/lowered
  // stat + any active stat-Passive bonus. Stat-type Passives (passive_type = 'stat', e.g. Harden,
  // Iron defense) are individually chosen per instance via pokemon_passives -- capped at max 3 / 1
  // per category by learnPassive itself -- unlike ability-type Passives (Rock head, Sturdy...) which
  // are simply auto-known once the species+level unlocks them. Modifier = floor(value / 2), same
  // formula as trainer stats. Bonus is folded in client-side (see PokemonInteractive), same as
  // afflictions, so learning/removing a Passive updates the Stats section immediately.
  const { data: chosenPassiveRows } = await supabase
    .from('pokemon_passives')
    .select('passive_id, passives(id, name, description, passive_type, category, passives_stats(modifier, stats(name)))')
    .eq('pokemon_id', pokemonId)

  // Cast reflects the real runtime shape (a single `passives` object, not the array TS infers once a
  // nested embed like passives_stats is present) -- same reverse/forward-embed quirk documented
  // elsewhere on this page.
  const knownPassiveRows = (chosenPassiveRows ?? []) as unknown as { passive_id: number; passives: (PassiveInfo & { passive_type: string }) | null }[]
  const initialKnownStatPassives: KnownPassiveEntry[] = knownPassiveRows
    .filter((r) => r.passives !== null && r.passives.passive_type === 'stat')
    .map((r) => ({ passive_id: r.passive_id, passives: r.passives! }))

  // Afflictions aren't species-gated and have no stacking cap (unlike stat-type Passives), so the
  // full reference list plus a plain set of active ids is all that's needed -- no eligibility query.
  // Stat modifiers are folded in client-side (see PokemonInteractive) rather than server-computed
  // here, so toggling an affliction updates the Stats section immediately without a re-fetch.
  const [{ data: allAfflictionsRaw }, { data: activeAfflictionRows }] = await Promise.all([
    supabase.from('afflictions').select('id, name, description, afflictions_stats(modifier, stats(name))').order('name'),
    supabase.from('pokemon_afflictions').select('affliction_id').eq('pokemon_id', pokemonId),
  ])

  const allAfflictions: AfflictionInfo[] = (allAfflictionsRaw ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    stats: (a.afflictions_stats ?? [])
      .map((s) => ({ modifier: s.modifier, statName: s.stats?.name ?? null }))
      .filter((s): s is { modifier: number; statName: string } => s.statName !== null),
  }))

  const initialActiveAfflictionIds = (activeAfflictionRows ?? []).map((r) => r.affliction_id)

  const { data: knownMovesRaw } = await supabase
    .from('pokemon_moves')
    .select('move_id, uses_remaining, resets_on, moves(id, name, range, damage_stat, frequency, damage_dice, description, types(name))')
    .eq('pokemon_id', pokemonId)

  // Cast reflects the real runtime shape (a single `moves` object, not the array TS infers) --
  // same reverse-embed quirk documented elsewhere on this page.
  const initialKnownMoves = (knownMovesRaw ?? []) as unknown as KnownMoveEntry[]

  // Full learnset (pokedex_moves), NOT filtered by the Pokemon's current level -- unlike the old
  // query, level-eligibility filtering now happens client-side in MovesSection so a level-up from
  // Add Exp can reveal newly-learnable moves without a fresh request.
  const { data: learnableRowsRaw } = await supabase
    .from('pokedex_moves')
    .select('level_learned, move:moves(id, name, range, damage_stat, frequency, damage_dice, description, types(name))')
    .eq('pokedex_id', pokemon.pokedex_id)
    .order('level_learned', { nullsFirst: true })

  const fullLearnset = (learnableRowsRaw ?? []).filter((r) => r.move) as unknown as LearnsetEntry[]

  const { data: proficiencyRows } = await supabase
    .from('pokedex_proficiencies')
    .select('proficiencies(name)')
    .eq('pokedex_id', pokemon.pokedex_id)

  // Every pokedex_passives row for this species, both Ability- and Stat-type, NOT filtered by level
  // (unlike the old query) -- split into the two kinds below. Ability-type Passives (Rock head,
  // Sturdy, Sinker...) are auto-derived from the species + level, mirroring how trainer class
  // features are derived rather than individually picked: rows with no level_learned are the curated
  // Handbook-sourced ones (always known), and rows with a level_learned (imported from PokeAPI, e.g.
  // Growl/Growth) unlock once the Pokemon reaches it -- filtered server-side here since they're
  // read-only and never need to react to a same-page level-up. Stat-type Passives are NOT
  // level-filtered here -- level-eligibility now happens client-side in PassivesSection (same
  // fullLearnset pattern as Moves) so a level-up from Add Exp can reveal newly-learnable Stat
  // Passives without a fresh request, and so the picker can show/hide by the live client-side level.
  const { data: allPassiveRows } = await supabase
    .from('pokedex_passives')
    .select('level_learned, passives(id, name, description, passive_type, category, passives_stats(modifier, stats(name)))')
    .eq('pokedex_id', pokemon.pokedex_id)
    .order('level_learned', { nullsFirst: true })

  // Cast reflects the real runtime shape (a single `passives` object, not the array TS infers once a
  // nested embed like passives_stats is present) -- same reverse/forward-embed quirk documented
  // elsewhere on this page.
  const passiveLearnsetRows = (allPassiveRows ?? []) as unknown as { level_learned: number | null; passives: (PassiveInfo & { passive_type: string }) | null }[]

  const abilityPassives: PassiveInfo[] = passiveLearnsetRows
    .filter((r) => r.passives !== null && r.passives.passive_type === 'ability')
    .filter((r) => r.level_learned === null || r.level_learned <= level)
    .map((r) => r.passives!)

  const statPassiveLearnset: PassiveLearnsetEntry[] = passiveLearnsetRows
    .filter((r) => r.passives !== null && r.passives.passive_type === 'stat')
    .map((r) => ({ level_learned: r.level_learned, passives: r.passives! }))

  const { data: habitatRows } = await supabase
    .from('pokedex_habitats')
    .select('habitats(name)')
    .eq('pokedex_id', pokemon.pokedex_id)

  const { data: dietRows } = await supabase
    .from('pokedex_diets')
    .select('diets(name)')
    .eq('pokedex_id', pokemon.pokedex_id)

  const { data: eggGroupRows } = await supabase
    .from('pokedex_egg_groups')
    .select('egg_groups(name)')
    .eq('pokedex_id', pokemon.pokedex_id)

  // Only fetched when actually needed to render the GM-only edit inputs -- these are reference
  // tables, no point loading them for a read-only view or a non-GM editing just the Nickname.
  const [
    { data: allNatures },
    { data: allLoyalties },
    { data: allTypes },
    { data: allSizes },
    { data: allWeights },
    { data: allItems },
    { data: allObtainMethods },
  ] =
    isEditingInfo && isGM
      ? await Promise.all([
          supabase.from('natures').select('id, name').order('name'),
          supabase.from('loyalties').select('id, name').order('name'),
          supabase.from('types').select('id, name').neq('name', 'Special/Variable').order('name'),
          supabase.from('sizes').select('id, name').order('name'),
          supabase.from('weights').select('id, name').order('name'),
          supabase.from('items').select('id, name').order('name'),
          supabase.from('obtain_methods').select('id, name').order('name'),
        ])
      : [{ data: null }, { data: null }, { data: null }, { data: null }, { data: null }, { data: null }, { data: null }]

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="flex w-full max-w-6xl items-center gap-3">
        <Link href={trainerLinkHref!} className="text-sm underline">
          ← {trainer?.name ?? 'Trainer'}
        </Link>
      </div>

      {error && <p className="w-full max-w-6xl text-danger">{error}</p>}

      <PokemonStateProvider
        pokemonId={pokemonId}
        basePath={basePath}
        isOwner={isOwner}
        isGM={isGM}
        effectiveType1={effectiveType1}
        effectiveType2={effectiveType2}
        initialLevel={level}
        initialEffectiveExp={effectiveExp}
        initialCurrentExp={pokemon.current_exp}
        initialCurrentHp={pokemon.current_hp}
        temporaryHp={pokemon.temporary_hp}
        initialEvs={{
          hp: pokemon.ev_hp,
          attack: pokemon.ev_attack,
          defense: pokemon.ev_defense,
          special_attack: pokemon.ev_special_attack,
          special_defense: pokemon.ev_special_defense,
          speed: pokemon.ev_speed,
        }}
        species={{
          base_hp: species.base_hp,
          base_atk: species.base_atk,
          base_def: species.base_def,
          base_sp_atk: species.base_sp_atk,
          base_sp_def: species.base_sp_def,
          base_speed: species.base_speed,
        }}
        natureIncreasedName={pokemon.nature?.increased?.name ?? null}
        natureDecreasedName={pokemon.nature?.decreased?.name ?? null}
        initialKnownMoves={initialKnownMoves}
        fullLearnset={fullLearnset}
        isEditingMoves={isEditingMoves}
        allAfflictions={allAfflictions}
        initialActiveAfflictionIds={initialActiveAfflictionIds}
        abilityPassives={abilityPassives}
        initialKnownStatPassives={initialKnownStatPassives}
        statPassiveLearnset={statPassiveLearnset}
        isEditingPassives={isEditingPassives}
        growthRateName={species.growth_rate?.name ?? null}
        growthRateModifier={species.growth_rate?.exp_modifier ?? 1}
        obtainMethodName={ownerLink?.obtain_method?.name ?? null}
        obtainMethodModifier={ownerLink?.obtain_method?.modifier ?? 1}
        loyaltyName={pokemon.loyalty?.name ?? null}
        loyaltyModifier={pokemon.loyalty?.modifier ?? 1}
        isShiny={pokemon.is_shiny}
      >
      <div className="flex w-full max-w-6xl items-start gap-4">
        <aside className="w-64 shrink-0">
          <section className="rounded border border-accent bg-accent/10 p-4">
            <div className="mb-3 flex flex-col items-center gap-1 text-center">
              <PokemonSprite spriteCode={species.sprite_code} shiny={pokemon.is_shiny} alt={species.name} size={96} />
              <h1 className="flex items-center gap-2 text-lg font-bold leading-tight">
                {pokemon.nickname ? `${pokemon.nickname} (${species.name})` : species.name}
                <BookmarkToggle entityType="pokemon" entityId={pokemonId} initialBookmarked={bookmarked} />
              </h1>
              {pokemon.is_shiny && <span className="text-xs font-medium text-warning">✦ Shiny</span>}
              {!isOwner && <span className="text-xs text-muted">(GM view)</span>}
              <LevelLine />
            </div>

            <div className="mb-2 flex items-center justify-between border-t pt-3">
              <h2 className="font-semibold">Info</h2>
              {canEditInfo && !isEditingInfo && (
                <Link
                  href={`${basePath}?editInfo=1`}
                  className="rounded border px-3 py-1 text-sm"
                >
                  Edit
                </Link>
              )}
            </div>

            {canEditInfo && isEditingInfo ? (
              <form action={updatePokemonDetails.bind(null, pokemonId)} className="flex flex-col gap-3 text-sm">
                <div className="flex flex-col gap-3">
                  {!isGM ? (
                    <>
                      <div className="flex flex-col gap-1">
                        <p>
                          Trainer:{' '}
                          {trainerId ? (
                            <Link href={trainerLinkHref!} className="underline">
                              {trainer?.name ?? '—'}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </p>
                        {campaign && (
                          <p>
                            Campaign:{' '}
                            <Link href={`/campaigns/${campaign.id}`} className="underline">
                              {campaign.name}
                            </Link>
                          </p>
                        )}
                        <p>Obtain method: {ownerLink?.obtain_method?.name ?? '—'}</p>
                        <p>Loyalty: {pokemon.loyalty?.name ?? '—'}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <p>Nature: {pokemon.nature?.name ?? '—'}</p>
                        <p>Stat increase: {pokemon.nature?.increased?.name ?? '—'}</p>
                        <p>Stat decrease: {pokemon.nature?.decreased?.name ?? '—'}</p>
                      </div>
                      <div className="flex flex-col gap-1">
                        <p>Weight: {effectiveWeight ?? '—'}</p>
                        <p>Size: {effectiveSize ?? '—'}</p>
                        <p>Gender: {pokemon.gender ? GENDER_LABELS[pokemon.gender] : '—'}</p>
                      </div>
                      <p>Held item: {pokemon.held_item?.name ?? 'None'}</p>
                    </>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <p>
                        Trainer:{' '}
                        {trainerId ? (
                          <Link href={trainerLinkHref!} className="underline">
                            {trainer?.name ?? '—'}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </p>
                      {campaign && (
                        <p>
                          Campaign:{' '}
                          <Link href={`/campaigns/${campaign.id}`} className="underline">
                            {campaign.name}
                          </Link>
                        </p>
                      )}
                    </div>
                  )}
                </div>

              <label htmlFor="nickname">Nickname</label>
              <input
                id="nickname"
                name="nickname"
                type="text"
                defaultValue={pokemon.nickname ?? ''}
                className="bg-surface-subtle rounded border p-2"
              />

              {isGM && (
                <>
                  <label htmlFor="obtainMethodId">Obtain method</label>
                  <select
                    id="obtainMethodId"
                    name="obtainMethodId"
                    className="bg-surface-subtle rounded border p-2"
                    defaultValue={ownerLink?.obtain_method_id ?? ''}
                  >
                    <option value="">—</option>
                    {(allObtainMethods ?? []).map((om) => (
                      <option key={om.id} value={om.id}>
                        {om.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="loyaltyId">Loyalty</label>
                  <select id="loyaltyId" name="loyaltyId" className="bg-surface-subtle rounded border p-2" defaultValue={pokemon.loyalty_id ?? ''}>
                    <option value="">—</option>
                    {(allLoyalties ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="natureId">Nature (roll a d20 — numbers match the options below)</label>
                  <select id="natureId" name="natureId" className="bg-surface-subtle rounded border p-2" defaultValue={pokemon.nature_id ?? ''}>
                    <option value="">None</option>
                    {(allNatures ?? []).map((n, i) => (
                      <option key={n.id} value={n.id}>
                        {i + 1}. {n.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="weightId">Weight</label>
                  <select id="weightId" name="weightId" className="bg-surface-subtle rounded border p-2" defaultValue={pokemon.weight_id ?? ''}>
                    <option value="">Species default ({species.weight?.name ?? '—'})</option>
                    {(allWeights ?? []).map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="sizeId">Size</label>
                  <select id="sizeId" name="sizeId" className="bg-surface-subtle rounded border p-2" defaultValue={pokemon.size_id ?? ''}>
                    <option value="">Species default ({species.size?.name ?? '—'})</option>
                    {(allSizes ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="gender">Gender</label>
                  <select id="gender" name="gender" className="bg-surface-subtle rounded border p-2" defaultValue={pokemon.gender ?? ''}>
                    <option value="">Unknown</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="genderless">Genderless</option>
                  </select>

                  <label htmlFor="heldItemId">Held item</label>
                  <select id="heldItemId" name="heldItemId" className="bg-surface-subtle rounded border p-2" defaultValue={pokemon.held_item_id ?? ''}>
                    <option value="">None</option>
                    {(allItems ?? []).map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="type1Id">Type 1</label>
                  <select id="type1Id" name="type1Id" className="bg-surface-subtle rounded border p-2" defaultValue={pokemon.type_1_id ?? ''}>
                    <option value="">Species default ({species.type_1?.name ?? '—'})</option>
                    {(allTypes ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="type2Id">Type 2</label>
                  <select id="type2Id" name="type2Id" className="bg-surface-subtle rounded border p-2" defaultValue={pokemon.type_2_id ?? ''}>
                    <option value="">Species default ({species.type_2?.name ?? 'None'})</option>
                    {(allTypes ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="isShiny" defaultChecked={pokemon.is_shiny} />
                    Shiny
                  </label>
                </>
              )}

              <div className="mt-1 flex gap-2">
                <button type="submit" className="rounded bg-accent px-4 py-2 text-accent-foreground">
                  Save
                </button>
                <Link
                  href={basePath}
                  className="rounded border px-4 py-2 text-center"
                >
                  Cancel
                </Link>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-1">
                <p>
                  Trainer:{' '}
                  {trainerId ? (
                    <Link href={trainerLinkHref!} className="underline">
                      {trainer?.name ?? '—'}
                    </Link>
                  ) : (
                    '—'
                  )}
                </p>
                {campaign && (
                  <p>
                    Campaign:{' '}
                    <Link href={`/campaigns/${campaign.id}`} className="underline">
                      {campaign.name}
                    </Link>
                  </p>
                )}
                <p>Obtain method: {ownerLink?.obtain_method?.name ?? '—'}</p>
                <p>Loyalty: {pokemon.loyalty?.name ?? '—'}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p>Nature: {pokemon.nature?.name ?? '—'}</p>
                <p>Stat increase: {pokemon.nature?.increased?.name ?? '—'}</p>
                <p>Stat decrease: {pokemon.nature?.decreased?.name ?? '—'}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p>Weight: {effectiveWeight ?? '—'}</p>
                <p>Size: {effectiveSize ?? '—'}</p>
                <p>Gender: {pokemon.gender ? GENDER_LABELS[pokemon.gender] : '—'}</p>
              </div>
              <p>Held item: {pokemon.held_item?.name ?? 'None'}</p>
            </div>
          )}
          </section>
        </aside>

        <div className="flex flex-1 flex-col gap-4">
        <ExperienceSection />

        <StatsSection />

        <MovesSection />

        <section className="rounded border border-accent bg-accent/10 p-4">
          <h2 className="mb-2 font-semibold">Move Proficiencies</h2>
          {(proficiencyRows ?? []).length === 0 ? (
            <p className="text-sm text-muted">None.</p>
          ) : (
            <p className="text-sm">{(proficiencyRows ?? []).map((p) => p.proficiencies?.name).filter(Boolean).join(', ')}</p>
          )}
        </section>

        <PassivesSection />

        <section className="rounded border border-accent bg-accent/10 p-4">
          <h2 className="mb-2 font-semibold">Biology</h2>
          <div className="grid grid-cols-2 gap-1 text-sm">
            <p>Egg group: {(eggGroupRows ?? []).map((r) => r.egg_groups?.name).filter(Boolean).join(', ') || '—'}</p>
            <p>Egg hatch rate: {species.egg_hatch_rate ?? '—'}</p>
            <p>Diet: {(dietRows ?? []).map((r) => r.diets?.name).filter(Boolean).join(', ') || '—'}</p>
            <p>Habitat: {(habitatRows ?? []).map((r) => r.habitats?.name).filter(Boolean).join(', ') || '—'}</p>
          </div>
        </section>
        </div>

        <aside className="w-64 shrink-0 flex flex-col gap-4">
          <HpSection />
          <AfflictionsSection />
        </aside>
      </div>
      </PokemonStateProvider>
    </main>
  )
}
