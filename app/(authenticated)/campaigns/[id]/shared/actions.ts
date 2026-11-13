'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { loadBagSnapshot } from '@/lib/pta3/bag'
import { loadSharedSnapshot, type SharedSnapshot } from '@/lib/pta3/sharedInventory'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

// One row of a Trainer's own inventory as the shared page lists it (for depositing).
export type TrainerItemRow = { id: string; name: string; label: string; quantity: number; stackable: boolean }

export type SharedState = { shared: SharedSnapshot; trainerMoney: number; trainerItems: TrainerItemRow[] }

// [[Feature - Shared currency and inventory]]: every transfer is one call to a SECURITY DEFINER database function
// (deposit_/withdraw_shared_money / _item) that re-checks who may act for the Trainer and moves both halves atomically.
// These actions only validate the Campaign, call the function, and hand back the fresh state of both sides.

async function requireTrainerInCampaign(supabase: SupabaseClient, campaignId: string, trainerId: string): Promise<string | null> {
  const { data: trainer } = await supabase.from('trainers').select('campaign_id').eq('id', trainerId).maybeSingle()
  if (!trainer || trainer.campaign_id !== campaignId) return 'That Trainer is not in this Campaign'
  return null
}

async function loadState(supabase: SupabaseClient, campaignId: string, trainerId: string): Promise<SharedState> {
  const [shared, bag] = await Promise.all([loadSharedSnapshot(supabase, campaignId), loadBagSnapshot(supabase, trainerId)])
  return {
    shared,
    trainerMoney: bag.money,
    trainerItems: bag.items.map((i) => ({
      id: i.id,
      name: i.name,
      label: `${i.name}${i.moveName ? ` (${i.moveName})` : ''}${i.pokedexName ? ` (${i.pokedexName})` : ''}${
        i.usesRemaining !== null ? ` — ${i.usesRemaining} use${i.usesRemaining === 1 ? '' : 's'} left` : ''
      }`,
      quantity: i.quantity,
      stackable: i.stackable,
    })),
  }
}

export async function loadSharedState(campaignId: string, trainerId: string): Promise<{ error: string } | SharedState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const problem = await requireTrainerInCampaign(supabase, campaignId, trainerId)
  if (problem) return { error: problem }
  return loadState(supabase, campaignId, trainerId)
}

export async function transferMoney(
  campaignId: string,
  trainerId: string,
  direction: 'deposit' | 'withdraw',
  amount: number,
): Promise<{ error: string } | SharedState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const problem = await requireTrainerInCampaign(supabase, campaignId, trainerId)
  if (problem) return { error: problem }

  const whole = Math.floor(Number(amount))
  if (!Number.isInteger(whole) || whole < 1) return { error: 'Enter a whole amount of at least 1' }

  const { error } = await supabase.rpc(direction === 'deposit' ? 'deposit_shared_money' : 'withdraw_shared_money', {
    p_trainer_id: trainerId,
    p_amount: whole,
  })
  if (error) return { error: error.message }
  return loadState(supabase, campaignId, trainerId)
}

// `rowId` is the Trainer's inventory row when depositing, or the shared pool's row when withdrawing.
export async function transferItem(
  campaignId: string,
  trainerId: string,
  direction: 'deposit' | 'withdraw',
  rowId: string,
  quantity: number,
): Promise<{ error: string } | SharedState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const problem = await requireTrainerInCampaign(supabase, campaignId, trainerId)
  if (problem) return { error: problem }

  const whole = Math.floor(Number(quantity))
  if (!Number.isInteger(whole) || whole < 1) return { error: 'Enter a whole quantity of at least 1' }

  const { error } =
    direction === 'deposit'
      ? await supabase.rpc('deposit_shared_item', { p_trainer_id: trainerId, p_trainers_item_id: rowId, p_quantity: whole })
      : await supabase.rpc('withdraw_shared_item', { p_trainer_id: trainerId, p_campaign_item_id: rowId, p_quantity: whole })
  if (error) return { error: error.message }
  return loadState(supabase, campaignId, trainerId)
}
