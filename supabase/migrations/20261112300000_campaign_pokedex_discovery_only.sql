-- [[Feature - Only show Pokemon a Trainer has encountered in the Pokedex]]: a per-Campaign switch for a "discovery"
-- Pokedex -- the species tab then only lists species the party has scanned, that the viewer's own Trainers own, or
-- everything for the GM / a Walking encyclopedia Researcher. OFF by default: production holds only a couple of
-- scanned species in total, so an always-on gate would nearly empty every existing Campaign's Pokedex; a GM opts in.
alter table campaigns add column pokedex_discovery_only boolean not null default false;
