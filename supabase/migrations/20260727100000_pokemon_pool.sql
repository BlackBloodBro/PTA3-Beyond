-- Supports GM-created Pokemon that aren't (yet) assigned to any trainer -- a "pool" Pokemon.
-- Ownership/visibility for a normal Pokemon is entirely derived through trainers_pokemon (owner,
-- or that trainer's campaign GM, or a fellow campaign member), so a Pokemon with no
-- trainers_pokemon row at all -- which is exactly what "unassigned" means, no schema hack needed
-- for that part -- would otherwise be invisible to everyone, including whoever made it.
--
-- campaign_id is purely organizational (which of the GM's campaigns this pool Pokemon conceptually
-- belongs to, e.g. for a prepped wild encounter) -- nullable, since a GM can also stockpile a
-- Pokemon with no campaign at all (a personal pool). It does NOT drive access by itself: actual
-- assignment permission for a *specific trainer* is already governed by
-- is_campaign_gm_for_trainer() (that trainer's own campaign), independent of the pool Pokemon's
-- campaign_id tag.
--
-- created_by_user_id is what actually drives RLS here: it's the only way to know who's allowed to
-- see/manage a Pokemon that has no owner via trainers_pokemon yet.
alter table pokemon
  add column campaign_id uuid references campaigns(id) on delete set null,
  add column created_by_user_id uuid references public.users(id);

create index on pokemon (campaign_id);
create index on pokemon (created_by_user_id);

-- Only applies while the Pokemon is still unassigned (no trainers_pokemon row) -- once assigned,
-- normal owner/campaign-GM policies take over exclusively, so the creator doesn't retain
-- standing rights over a Pokemon that's since been handed off and played by someone else.
create policy "Creator manages their own unassigned pokemon" on pokemon
  for all using (
    created_by_user_id = auth.uid()
    and not exists (select 1 from trainers_pokemon tp where tp.pokemon_id = pokemon.id)
  ) with check (created_by_user_id = auth.uid());
