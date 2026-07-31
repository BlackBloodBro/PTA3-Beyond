// A Wild/pool Pokemon (no trainers_pokemon row) has no separate "owner" tier -- whoever controls it
// fully is either that campaign's actual GM (if it's tagged to one) or its creator (if it isn't).
// Only a campaign's GM can ever tag a pool Pokemon with that campaign_id in the first place
// (createPokemon / assignPokemonToCampaign both require it), so in every case this reaches today the
// creator and the campaign's GM are the same person -- but this checks the real, current GM directly
// rather than leaning on that as an unstated invariant, per the "Campaign membership hands GM-tier
// control to the GM alone" rule applied consistently across Trainers and Pokemon.
export function resolveWildPokemonAuthority(
  params: { campaignId: string | null; campaignGmUserId: string | null; createdByUserId: string | null },
  userId: string,
): boolean {
  if (params.campaignId) {
    return params.campaignGmUserId === userId
  }
  return params.createdByUserId === userId
}
