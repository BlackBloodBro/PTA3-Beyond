import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveMilestone } from '@/app/(authenticated)/trainers/actions'
import { loadPendingMilestone, loadQualifyingMilestones } from '@/lib/pta3/trainerFeatures'
import { STAT_OPTIONS, loadAdvancedClassOptions } from '@/lib/pta3/advancedClassOptions'
import { AdvancedClassPicker } from './AdvancedClassPicker'

export default async function LevelUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: trainer } = await supabase.from('trainers').select('name, level, class_id, campaign_id').eq('id', id).single()

  if (!trainer) {
    redirect('/dashboard')
  }

  // Any Trainer belonging to a Campaign (NPC or player) lives under /campaigns/[id]/.../level-up now.
  if (trainer.campaign_id) {
    notFound()
  }

  // Same derivation the trainer page and resolveMilestone use -- see
  // lib/pta3/trainerFeatures.ts for why "does a trainer_milestones row already exist at this exact
  // level" (not a raw slot count) is what decides whether there's something pending here.
  const { hasPendingMilestone, nextMilestoneLevel } = await loadPendingMilestone(supabase, {
    trainerId: id,
    classId: trainer.class_id,
    level: trainer.level,
  })

  // Nothing pending (already resolved, not reached yet, or this class has no milestones) --
  // there's nothing for this page to show.
  if (!hasPendingMilestone || !nextMilestoneLevel) {
    redirect(`/trainers/${id}`)
  }

  const filledIds = (await loadQualifyingMilestones(supabase, id, trainer.level)).map((m) => m.subclass_id)
  const { subclassOptions, statOptions, typeAceId, typeOptions } = await loadAdvancedClassOptions(supabase, trainer.class_id, filledIds)

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 p-24">
      <div className="w-full max-w-2xl">
        <Link href={`/trainers/${id}`} className="text-sm underline">
          ← {trainer.name}
        </Link>
      </div>

      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-bold">Level {nextMilestoneLevel} milestone</h1>
        <p className="text-sm text-muted">
          Max HP already increased by 4. Choose two stats to raise and an advanced class to unlock.
        </p>
      </div>

      {error && <p className="w-full max-w-2xl text-danger">{error}</p>}

      <form action={resolveMilestone.bind(null, id)} className="flex w-full max-w-2xl flex-col gap-4">
        <section className="rounded border-accent bg-accent/10 p-4">
          <h2 className="mb-2 font-semibold">Stat increase</h2>
          <p className="mb-2 text-sm text-muted">Choose two different stats. Each increases by 1.</p>
          <div className="flex gap-4">
            <select name="statA" className="bg-surface-subtle rounded border p-2" required defaultValue="">
              <option value="" disabled>
                Stat 1
              </option>
              {STAT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <select name="statB" className="bg-surface-subtle rounded border p-2" required defaultValue="">
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
          <AdvancedClassPicker subclassOptions={subclassOptions} statOptions={statOptions} typeAceId={typeAceId} typeOptions={typeOptions} />
        </section>

        <button type="submit" className="rounded bg-accent px-4 py-2 text-accent-foreground">
          Confirm level up
        </button>
      </form>
    </main>
  )
}
