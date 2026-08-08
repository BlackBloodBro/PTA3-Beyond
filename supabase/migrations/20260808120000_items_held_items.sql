-- Fill out the Items table, batch 2: Held Items (the PDF's named combat held items, distinct from the
-- 54 systematic per-type boosters already seeded -- Charcoal/Mystic Water/Silk Scarf-style classics,
-- Gems, and Plates). Source: PTA3PlayersHandbook.pdf pages 192-193.
--
-- "Elemental Plate" (p192, ~19800P, "named per Pokémon type... +4 damage") is deliberately NOT added
-- here -- it's the generic template the 18 existing "X plate" items (Draco plate, Icicle plate, etc.,
-- boost_amount 4) already are individual instances of. Adding a 19th generic "Elemental Plate" row
-- would duplicate what's already correctly modeled.
--
-- Terrain Extender/Terrain Seeds/Weather Rocks are the same kind of "named per type of X" template,
-- but unlike Elemental Plate there's no existing per-terrain or per-weather reference table in this
-- schema to expand against (no `terrains`/`weathers` table exists anywhere), so these stay as single
-- generic catalog rows with the templating explained in `description` -- matches the same
-- don't-flood-the-catalog reasoning already applied to Technical Machines.
--
-- None of these 35 items have a clean single-type/single-amount boost shape (heterogeneous mechanics:
-- stat changes, conditional immunities, consumed-on-trigger effects), so `held_item_boosts`-style
-- boosted_type_id/boost_amount stay null -- full mechanics live in `description` text only, matching
-- this app's "nothing auto-applies effects" convention.
insert into items (name, item_category_id, buyable, price, description)
select v.name, 1, true, v.price, v.description
from (values
  ('Air Balloon', 1350, 'You are immune to Ground-type attacks. If you are hit by any other type of attack, Air Balloon is destroyed.'),
  ('Absorb Bulb', 650, 'When you are hit by a Water-type attack, Absorb Bulb is destroyed and your Special Attack is raised by 2 for 10 mins.'),
  ('Adrenaline Orb', 2550, 'When your Attack or Special Attack is lowered by a foe''s effects, your Speed is raised by 1 for 10 mins.'),
  ('Assault Vest', 2550, 'Your Special Defense is +1. You may not use moves that do not deal damage on hit.'),
  ('Big Root', 2550, 'When using an attack that heals you according to how much damage you deal, heal yourself an additional 1d6 hit points.'),
  ('Binding Band', 2550, 'When using an attack that deals damage while keeping a target bound, deal an additional 1d4 damage each turn.'),
  ('Black Sludge', 1250, 'As an action, consume and destroy Black Sludge. Poison-types that consume Black Sludge regain 1d6 hit points per round for 2 mins (20 rounds) or until at max HP. All other Pokémon are Poisoned by consuming Black Sludge.'),
  ('Cell Battery', 650, 'When you are hit by an Electric-type attack, Cell Battery is destroyed and your Attack is raised by 2 for 10 mins.'),
  ('Choice Band', 2550, 'Your Attack is +2. Whenever you make an attack, that is the only attack you can use for 3 mins. If you can no longer use that move, you may still Struggle.'),
  ('Choice Scarf', 2550, 'Your Speed is +2. Whenever you make an attack, that is the only attack you can use for 3 mins. If you can no longer use that move, you may still Struggle.'),
  ('Choice Specs', 2550, 'Your Special Attack is +2. Whenever you make an attack, that is the only attack you can use for 3 mins. If you can no longer use that move, you may still Struggle.'),
  ('Destiny Knot', 1750, 'If you become Infatuated, the Pokémon who Infatuated you becomes Infatuated with you.'),
  ('Everstone', 550, 'While held, a Pokémon will not be able to evolve. A Pokémon will also not get exhausted from fighting off evolution while held.'),
  ('Eviolite', 2550, 'If you can still potentially evolve, your Defense and Special Defense are +1.'),
  ('Expert Belt', 2550, 'If you hit with a super effective or extremely effective attack, deal an additional +4 damage.'),
  ('Focus Band', 1950, 'If you would be knocked out, roll 1d20. On 17 or higher, you are instead set to 1 hit point and the Focus Band is destroyed.'),
  ('Focus Sash', 2550, 'If you would be knocked out from a single attack when you were at max hit points, instead you are set to 1 hit point once per battle.'),
  ('Heavy Boots', 2550, 'You are immune to damage and effects of Hazards once per combat.'),
  ('King''s Rock', 2550, 'When attacking, you stun targets on natural 18-20. Once you stun a target, King''s Rock does not work for the rest of the day.'),
  ('Leftovers', 2550, 'As an action, start consuming Leftovers for 1 min (10 rounds) or until at max HP. While consuming Leftovers, regain 10 hp per round. Afterwards, Leftovers is destroyed.'),
  ('Life Orb', 2550, 'Whenever using an attack that deals damage on hit, deal an additional 1d6, then you lose that result as unreducible hit points.'),
  ('Mental Herb', 650, 'Consume Mental Herb as an action to become immune for 5 minutes against effects from opponents that would prevent you from using a move.'),
  ('Muscle Band', 2550, 'Your Attack is +2 on your first turn each combat.'),
  ('Protective Pads', 2550, 'If you would be damaged as a result of making a melee attack against a foe by a foe''s effect or ability, ignore that damage.'),
  ('Quick Claw', 2550, '1/day, you may give one of your moves priority. If someone else uses a priority move, compare Speed for turn order.'),
  ('Razor Claw', 2550, 'When attacking, you score a critical hit on a natural roll of 18, 19, or 20. If you score a critical hit, Razor Claw does not work for the rest of the day.'),
  ('Rocky Helmet', 2550, 'Whenever you are hit by an attack at melee range, the offender loses 1d4 hit points.'),
  ('Safety Goggles', 2550, 'You are immune to damaging effects from weather and powder effect moves.'),
  ('Shell Bell', 2550, 'Once per combat, on hit, your damaging attack will also heal you 1d4 hit points.'),
  ('Terrain Extender', 450, 'Terrain Extenders are named per type of terrain and are activated and destroyed when you create that type of terrain. When they are destroyed, the terrain effect lasts for 5 mins.'),
  ('Terrain Seeds', 650, 'Terrain Seeds are named per type of terrain and are activated and destroyed when you step onto that type of terrain. When they are destroyed, your Defense is +1 for 10 mins.'),
  ('Throat Spray', 1850, 'Once per day when you use a voice-oriented move, your Special Attack is raised +1 for 10 mins.'),
  ('Weather Rocks', 450, 'Weather Rocks are named per type of weather and are activated and destroyed when you create that type of weather. When they are destroyed, the weather effect lasts for 5 mins.'),
  ('White Herb', 650, 'When consumed and destroyed, remove all of your temporarily lowered stats effects.'),
  ('Wise Glasses', 2550, 'Your Special Attack is +2 on your first turn each combat.')
) as v(name, price, description);
