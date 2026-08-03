// Any Trainer belonging to a Campaign (NPC or player) lives under a campaign-scoped namespace;
// a campaign-less Trainer keeps the generic path. Every internal link/redirect that points at a
// trainer's detail page (or a sub-route under it) should go through this so the routes never drift
// apart.
export function trainerHref(trainer: { id: string; is_npc: boolean; campaign_id: string | null }): string {
  if (!trainer.campaign_id) return `/trainers/${trainer.id}`
  return trainer.is_npc ? `/campaigns/${trainer.campaign_id}/npcs/${trainer.id}` : `/campaigns/${trainer.campaign_id}/trainers/${trainer.id}`
}
