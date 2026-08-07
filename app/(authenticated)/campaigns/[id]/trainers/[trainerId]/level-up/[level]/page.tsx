import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { editMilestone } from '@/app/(authenticated)/trainers/actions'
import { STAT_OPTIONS, loadAdvancedClassOptions } from '@/lib/pta3/advancedClassOptions'
import { AdvancedClassPicker } from '@/app/(authenticated)/trainers/[id]/level-up/AdvancedClassPicker'
import { trainerHref } from '@/lib/pta3/trainerPaths'

// Lets an owner/GM change which subclass and which 2 stats an already-resolved milestone granted --
// mirrors trainers/[id]/level-up/[level]/page.tsx under the campaign-assigned player Trainer's
// campaign-scoped path.
export default async function CampaignTrainerEditMilestonePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; trainerId: string; level: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id: campaignId, trainerId: id, level: levelParam } = await params
  const { error } = await searchParams
  const level = Number(levelParam)
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: trainer } = await supabase.from('trainers').select('name, class_id, is_npc, campaign_id').eq('id', id).single()

  if (!trainer) {
    redirect('/dashboard')
  }

  if (trainer.is_npc || trainer.campaign_id !== campaignId) {
    notFound()
  }

  const basePath = trainerHref({ id, is_npc: false, campaign_id: campaignId })

  const { data: milestone } = await supabase
    .from('trainer_milestones')
    .select('subclass_id, stat_a, stat_b, chosen_stat, chosen_type_id')
    .eq('trainer_id', id)
    .eq('level', level)
    .maybeSingle()

  if (!milestone) {
    redirect(`${basePath}?error=${encodeURIComponent('No milestone at that level to edit')}`)
  }

  const { data: allMilestones } = await supabase.from('trainer_milestones').select('subclass_id').eq('trainer_id', id)
  const heldSubclassIds = (allMilestones ?? []).map((m) => m.subclass_id).filter((subclassId) => subclassId !== milestone.subclass_id)

  const { subclassOptions, statOptions, typeAceId, typeOptions } = await loadAdvancedClassOptions(supabase, trainer.class_id, heldSubclassIds)

  // Recover which top-level picker option currently corresponds to this milestone's stored choice:
  // "Stat ace" and "Type ace" are combined choices in the UI (see AdvancedClassPicker), so a
  // chosen_stat/chosen_type_id on the row means the underlying subclass_id alone isn't the right
  // <select> value to pre-fill.
  const initialChoice = milestone.chosen_stat ? 'stat_ace' : String(milestone.subclass_id)

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={basePath} className="text-sm underline">
          ← {trainer.name}
        </Link>
      </div>

      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold">Edit Level {level} milestone</h1>
        <p className="text-sm text-muted">Change which two stats and which advanced class this milestone granted.</p>
      </div>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      <form action={editMilestone.bind(null, id, level)} className="flex w-full max-w-2xl flex-col gap-4">
        <section className="rounded border-accent bg-accent/10 p-4">
          <h2 className="mb-2 font-semibold">Stat increase</h2>
          <p className="mb-2 text-sm text-muted">Choose two different stats. Each increases by 1.</p>
          <div className="flex gap-4">
            <select name="statA" className="bg-surface-subtle rounded border p-2" required defaultValue={milestone.stat_a}>
              <option value="" disabled>
                Stat 1
              </option>
              {STAT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select name="statB" className="bg-surface-subtle rounded border p-2" required defaultValue={milestone.stat_b}>
              <option value="" disabled>
                Stat 2
              </option>
              {STAT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="rounded border-accent bg-accent/10 p-4">
          <h2 className="mb-2 font-semibold">Advanced class</h2>
          <AdvancedClassPicker
            subclassOptions={subclassOptions}
            statOptions={statOptions}
            typeAceId={typeAceId}
            typeOptions={typeOptions}
            // Editing an already-resolved milestone never re-grants or reverses a Skill Talent pick
            // -- see editMilestone's own comment for why.
            skillTalentOptionsByChoice={{}}
            heldSkillTalents={{}}
            initialChoice={initialChoice}
            initialChosenStat={milestone.chosen_stat ?? ''}
            initialChosenTypeId={milestone.chosen_type_id ? String(milestone.chosen_type_id) : ''}
          />
        </section>

        <button type="submit" className="rounded bg-accent px-4 py-2 text-accent-foreground">
          Save changes
        </button>
      </form>
    </main>
  )
}
