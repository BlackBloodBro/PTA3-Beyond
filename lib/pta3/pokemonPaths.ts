// Any Pokemon whose effective Campaign is set -- a Wild/pool Pokemon's own campaign_id tag, or a
// Trainer-owned Pokemon's owning Trainer's campaign_id -- lives under that Campaign's namespace,
// split into /pokemon (owned) vs /wild-pokemon (no owner). A campaign-less Pokemon (untagged pool,
// or owned by a campaign-less Trainer) keeps the generic /pokemon/[id] path. `campaignId` here must
// always be the EFFECTIVE campaign -- for an owned Pokemon that's the Trainer's campaign_id, not the
// Pokemon's own (possibly stale/vestigial) campaign_id column. Every internal link/redirect that
// points at a Pokemon's detail page should go through this so the routes never drift apart.
export function pokemonHref(pokemon: { id: string; hasOwner: boolean; campaignId: string | null }): string {
  if (!pokemon.campaignId) return `/pokemon/${pokemon.id}`
  return pokemon.hasOwner ? `/campaigns/${pokemon.campaignId}/pokemon/${pokemon.id}` : `/campaigns/${pokemon.campaignId}/wild-pokemon/${pokemon.id}`
}
