'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// [[Feature - GM Custom - Skills]]: same "re-derive GM-ness server-side, RLS backs it up too" shape
// as every other "GM Custom X" sibling's own requireGm.
async function requireGm(supabase: SupabaseClient, campaignId: string, userId: string): Promise<boolean> {
  const { data: campaign } = await supabase.from('campaigns').select('gm_user_id').eq('id', campaignId).maybeSingle()
  return campaign?.gm_user_id === userId
}

type SkillFields = {
  name: string
  stat_id: number
}

function parseSkillFields(formData: FormData): { error: string } | { fields: SkillFields } {
  const name = (formData.get('name') as string)?.trim()
  if (!name) return { error: 'Name is required' }

  const statIdRaw = formData.get('statId') as string
  const statId = Number(statIdRaw)
  if (!statIdRaw || Number.isNaN(statId)) return { error: 'Governing stat is required' }

  return {
    fields: {
      name,
      stat_id: statId,
    },
  }
}

export async function createCustomSkill(campaignId: string, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/skills?error=${encodeURIComponent('Only the GM can add custom skills')}`)
  }

  const parsed = parseSkillFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/skills/new?error=${encodeURIComponent(parsed.error)}`)
  }

  const { data: inserted, error } = await supabase
    .from('skills')
    .insert({ ...parsed.fields, campaign_id: campaignId })
    .select('id')
    .single()

  if (error || !inserted) {
    const message = error?.code === '23505' ? `This campaign already has a skill named "${parsed.fields.name}"` : (error?.message ?? 'Could not create skill')
    redirect(`/campaigns/${campaignId}/custom/skills/new?error=${encodeURIComponent(message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/skills/${inserted.id}`)
}

export async function updateCustomSkill(campaignId: string, skillId: number, formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/skills?error=${encodeURIComponent('Only the GM can edit custom skills')}`)
  }

  const parsed = parseSkillFields(formData)
  if ('error' in parsed) {
    redirect(`/campaigns/${campaignId}/custom/skills/${skillId}?error=${encodeURIComponent(parsed.error)}`)
  }

  const { error } = await supabase.from('skills').update(parsed.fields).eq('id', skillId).eq('campaign_id', campaignId)

  if (error) {
    const message = error.code === '23505' ? `This campaign already has a skill named "${parsed.fields.name}"` : error.message
    redirect(`/campaigns/${campaignId}/custom/skills/${skillId}?error=${encodeURIComponent(message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/skills/${skillId}?saved=1`)
}

export async function deleteCustomSkill(campaignId: string, skillId: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  if (!(await requireGm(supabase, campaignId, user.id))) {
    redirect(`/campaigns/${campaignId}/custom/skills?error=${encodeURIComponent('Only the GM can delete custom skills')}`)
  }

  // Unlike Item Category/Proficiency, a Skill can be actually picked by a real Trainer as a Skill
  // Talent -- trainer_skill_talents/trainer_base_skill_talents would silently lose that pick (both
  // cascade), and trainer_milestones' talent_skill_id/bonus_talent_skill_id would hard-fail on the FK
  // restrict. count_trainers_using_skill bypasses RLS to check all four before allowing deletion.
  const { data: usageCount } = await supabase.rpc('count_trainers_using_skill', { target_skill_id: skillId })
  if (usageCount && usageCount > 0) {
    redirect(`/campaigns/${campaignId}/custom/skills/${skillId}?error=${encodeURIComponent("Can't delete a skill that's already picked as a Talent by a Trainer")}`)
  }

  const { error } = await supabase.from('skills').delete().eq('id', skillId).eq('campaign_id', campaignId)
  if (error) {
    redirect(`/campaigns/${campaignId}/custom/skills/${skillId}?error=${encodeURIComponent(error.message)}`)
  }

  redirect(`/campaigns/${campaignId}/custom/skills`)
}
