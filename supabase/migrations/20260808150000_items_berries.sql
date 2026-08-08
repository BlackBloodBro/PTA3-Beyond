-- Fill out the Items table, batch 5: Berries. Source: PTA3PlayersHandbook.pdf pages 194-196.
--
-- Per the user, Berries get a real dedicated detail table (unlike batches 2-4's flat description-only
-- treatment) since flavor/rarity are genuinely structured, reusable data -- flavors in particular will
-- be needed again for the future Contest Treats & Accessories batch (poffins/pokeblocks combine berry
-- flavors into contest stats), so modeling `flavors` as its own reference table now avoids redoing this
-- later. Symbol legend (only decodable by inspecting the PDF's raw private-use-area codepoints -- the
-- rendered text alone was missing 2 of 5 flavor glyphs): flavor symbols are Dry/Bitter/Spicy/Sour/Sweet;
-- the *leading* symbol on each berry row is a separate rarity symbol (Common/Uncommon/Rare), reusing
-- two of the same glyphs, which is why they must be read as two distinct legends, not one.
--
-- "Berry Planter" (mentioned in passing at the end of this chapter, ~2800P) is deliberately NOT added
-- here -- it reappears with its full mechanical writeup under "Portable Utility Items" (p200) as
-- "Portable Berry Planter," and belongs to that later batch, not this one.
create table flavors (
  id serial primary key,
  name text not null unique
);

insert into flavors (name) values ('Dry'), ('Bitter'), ('Spicy'), ('Sour'), ('Sweet');

alter table flavors enable row level security;
create policy "Public read access" on flavors for select using (true);

create table berries (
  item_id int primary key references items(id) on delete cascade,
  rarity text not null check (rarity in ('Common', 'Uncommon', 'Rare'))
);

alter table berries enable row level security;
create policy "Public read access" on berries for select using (true);

create table berry_flavors (
  item_id int not null references items(id) on delete cascade,
  flavor_id int not null references flavors(id) on delete cascade,
  primary key (item_id, flavor_id)
);

alter table berry_flavors enable row level security;
create policy "Public read access" on berry_flavors for select using (true);

insert into item_categories (name) values ('Berries');

insert into items (name, item_category_id, buyable, price, description)
select v.name, c.id, true, v.price, v.description
from item_categories c,
(values
  ('Oran', 25, 'Heals a Pokémon 5 HP.'),
  ('Sitrus', 120, 'Heals a Pokémon 12 HP.'),
  ('Aguav', 850, 'Heals 1/3 of a Pokémon''s max HP, then confuses them. A Pokémon who favors this berry''s flavor is immune to the confusion.'),
  ('Figy', 850, 'Heals 1/3 of a Pokémon''s max HP, then confuses them. A Pokémon who favors this berry''s flavor is immune to the confusion.'),
  ('Iapapa', 850, 'Heals 1/3 of a Pokémon''s max HP, then confuses them. A Pokémon who favors this berry''s flavor is immune to the confusion.'),
  ('Mago', 850, 'Heals 1/3 of a Pokémon''s max HP, then confuses them. A Pokémon who favors this berry''s flavor is immune to the confusion.'),
  ('Wiki', 850, 'Heals 1/3 of a Pokémon''s max HP, then confuses them. A Pokémon who favors this berry''s flavor is immune to the confusion.'),
  ('Aspear', 120, 'Cures Freezing.'),
  ('Cheri', 120, 'Cures Paralysis.'),
  ('Chesto', 120, 'Cures Sleep.'),
  ('Pecha', 120, 'Cures Poison and Toxin.'),
  ('Persim', 180, 'Cures Confusion.'),
  ('Rawst', 120, 'Cures Burns.'),
  ('Lum', 580, 'Cures all Afflictions.'),
  ('Grepa', 680, 'Counter-vitamin: can lower Special Defense by 1, but only if a Vitamin has already raised it.'),
  ('Hondew', 680, 'Counter-vitamin: can lower Special Attack by 1, but only if a Vitamin has already raised it.'),
  ('Kelpsy', 680, 'Counter-vitamin: can lower Attack by 1, but only if a Vitamin has already raised it.'),
  ('Pomeg', 680, 'Counter-vitamin: can lower max HP by 4, but only if a Vitamin has already raised it.'),
  ('Qualot', 680, 'Counter-vitamin: can lower Defense by 1, but only if a Vitamin has already raised it.'),
  ('Tamato', 680, 'Counter-vitamin: can lower Speed by 1, but only if a Vitamin has already raised it.'),
  ('Babiri', 540, 'Protection from Steel: if hit by a Steel-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Charti', 540, 'Protection from Rock: if hit by a Rock-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Chilan', 540, 'Protection from Normal: if hit by a Normal-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Chople', 540, 'Protection from Fighting: if hit by a Fighting-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Coba', 540, 'Protection from Flying: if hit by a Flying-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Colbur', 540, 'Protection from Dark: if hit by a Dark-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Haban', 540, 'Protection from Dragon: if hit by a Dragon-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Kasib', 540, 'Protection from Ghost: if hit by a Ghost-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Kebia', 540, 'Protection from Poison: if hit by a Poison-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Occa', 540, 'Protection from Fire: if hit by a Fire-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Passho', 540, 'Protection from Water: if hit by a Water-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Payapa', 540, 'Protection from Psychic: if hit by a Psychic-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Rindo', 540, 'Protection from Grass: if hit by a Grass-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Roseli', 540, 'Protection from Fairy: if hit by a Fairy-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Shuca', 540, 'Protection from Ground: if hit by a Ground-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Tanga', 540, 'Protection from Bug: if hit by a Bug-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Wacan', 540, 'Protection from Electric: if hit by an Electric-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Yache', 540, 'Protection from Ice: if hit by an Ice-type attack, treat it as resisted (remove one damage die; negates the extra die if super effective; only adds one die if extremely effective).'),
  ('Apicot', 1880, 'Consumed as a free action at half HP or lower: increase Special Defense by 1 for 2 mins. Does not stack.'),
  ('Ganlon', 1880, 'Consumed as a free action at half HP or lower: increase Defense by 1 for 2 mins. Does not stack.'),
  ('Lansat', 1880, 'Consumed as a free action at half HP or lower: score critical hits on natural 18-20 for 1 min.'),
  ('Liechi', 1880, 'Consumed as a free action at half HP or lower: increase Attack by 1 for 2 mins. Does not stack.'),
  ('Micle', 1880, 'Consumed as a free action at half HP or lower: increase accuracy checks by 2 for 1 round.'),
  ('Petaya', 1880, 'Consumed as a free action at half HP or lower: increase Special Attack by 1 for 2 mins. Does not stack.'),
  ('Salac', 1880, 'Consumed as a free action at half HP or lower: increase Speed by 1 for 2 mins. Does not stack.'),
  ('Starf', 1280, 'Consumed as a free action at half HP or lower: increase a random stat by 1 for 2 mins.'),
  ('Custap', null, 'Incredibly rare. When at 5 HP or less, your next At-Will attack has priority.'),
  ('Enigma', null, 'Incredibly rare. When hit by a super-effective or extremely effective attack, restore HP equal to 1/4th of your max HP.'),
  ('Jacoba', null, 'Incredibly rare. When hit by a melee Attack move, the offender loses HP equal to 1/4th the damage you just took.'),
  ('Kee', null, 'Incredibly rare. When hit by an Attack move, increase Defense by 1 for 2 mins.'),
  ('Leppa', null, 'Incredibly rare. Restore the use of one 3/day frequency move as if you''ve had an extended rest.'),
  ('Maranga', null, 'Incredibly rare. When hit by a Special Attack move, increase Special Defense by 1 for 2 mins.'),
  ('Rowap', null, 'Incredibly rare. When hit by a ranged Special Attack move, the offender loses HP equal to 1/4th the damage you just took.'),
  ('Belue', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Bluk', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Cornn', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Durin', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Magost', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Nanab', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Nomel', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Pamtre', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Pinap', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Rabuta', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Razz', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Spelon', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Watmel', 120, 'No combat effect -- prized for its flavor in Contest Treats.'),
  ('Wepear', 120, 'No combat effect -- prized for its flavor in Contest Treats.')
) as v(name, price, description)
where c.name = 'Berries';

insert into berries (item_id, rarity)
select i.id, v.rarity
from items i,
(values
  ('Oran', 'Common'), ('Sitrus', 'Uncommon'), ('Aguav', 'Uncommon'), ('Figy', 'Uncommon'),
  ('Iapapa', 'Uncommon'), ('Mago', 'Uncommon'), ('Wiki', 'Uncommon'),
  ('Aspear', 'Common'), ('Cheri', 'Common'), ('Chesto', 'Common'), ('Pecha', 'Common'),
  ('Persim', 'Common'), ('Rawst', 'Common'), ('Lum', 'Uncommon'),
  ('Grepa', 'Rare'), ('Hondew', 'Rare'), ('Kelpsy', 'Rare'), ('Pomeg', 'Rare'), ('Qualot', 'Rare'), ('Tamato', 'Rare'),
  ('Babiri', 'Uncommon'), ('Charti', 'Uncommon'), ('Chilan', 'Uncommon'), ('Chople', 'Uncommon'),
  ('Coba', 'Uncommon'), ('Colbur', 'Uncommon'), ('Haban', 'Uncommon'), ('Kasib', 'Uncommon'),
  ('Kebia', 'Uncommon'), ('Occa', 'Uncommon'), ('Passho', 'Uncommon'), ('Payapa', 'Uncommon'),
  ('Rindo', 'Uncommon'), ('Roseli', 'Uncommon'), ('Shuca', 'Uncommon'), ('Tanga', 'Uncommon'),
  ('Wacan', 'Uncommon'), ('Yache', 'Uncommon'),
  ('Apicot', 'Rare'), ('Ganlon', 'Rare'), ('Lansat', 'Rare'), ('Liechi', 'Rare'), ('Micle', 'Rare'),
  ('Petaya', 'Rare'), ('Salac', 'Rare'), ('Starf', 'Rare'),
  ('Custap', 'Rare'), ('Enigma', 'Rare'), ('Jacoba', 'Rare'), ('Kee', 'Rare'), ('Leppa', 'Rare'),
  ('Maranga', 'Rare'), ('Rowap', 'Rare'),
  ('Belue', 'Common'), ('Bluk', 'Common'), ('Cornn', 'Common'), ('Durin', 'Common'), ('Magost', 'Common'),
  ('Nanab', 'Common'), ('Nomel', 'Common'), ('Pamtre', 'Common'), ('Pinap', 'Common'), ('Rabuta', 'Common'),
  ('Razz', 'Common'), ('Spelon', 'Common'), ('Watmel', 'Common'), ('Wepear', 'Common')
) as v(name, rarity)
where i.name = v.name and i.item_category_id = (select id from item_categories where name = 'Berries');

insert into berry_flavors (item_id, flavor_id)
select i.id, f.id
from items i
join item_categories c on c.id = i.item_category_id and c.name = 'Berries'
join (values
  ('Oran', 'Dry'), ('Oran', 'Bitter'), ('Oran', 'Spicy'), ('Oran', 'Sour'),
  ('Sitrus', 'Dry'), ('Sitrus', 'Bitter'), ('Sitrus', 'Sour'), ('Sitrus', 'Sweet'),
  ('Aguav', 'Bitter'),
  ('Figy', 'Spicy'),
  ('Iapapa', 'Sour'),
  ('Mago', 'Sweet'),
  ('Wiki', 'Dry'),
  ('Aspear', 'Sour'),
  ('Cheri', 'Spicy'),
  ('Chesto', 'Dry'),
  ('Pecha', 'Sweet'),
  ('Persim', 'Dry'), ('Persim', 'Spicy'), ('Persim', 'Sour'), ('Persim', 'Sweet'),
  ('Rawst', 'Bitter'),
  ('Lum', 'Dry'), ('Lum', 'Bitter'), ('Lum', 'Spicy'), ('Lum', 'Sweet'),
  ('Grepa', 'Dry'), ('Grepa', 'Sour'), ('Grepa', 'Sweet'),
  ('Hondew', 'Dry'), ('Hondew', 'Bitter'), ('Hondew', 'Spicy'),
  ('Kelpsy', 'Dry'), ('Kelpsy', 'Bitter'), ('Kelpsy', 'Sour'),
  ('Pomeg', 'Bitter'), ('Pomeg', 'Spicy'), ('Pomeg', 'Sweet'),
  ('Qualot', 'Spicy'), ('Qualot', 'Sour'), ('Qualot', 'Sweet'),
  ('Tamato', 'Dry'), ('Tamato', 'Spicy'),
  ('Babiri', 'Dry'), ('Babiri', 'Spicy'),
  ('Charti', 'Dry'), ('Charti', 'Spicy'),
  ('Chilan', 'Dry'), ('Chilan', 'Sweet'),
  ('Chople', 'Bitter'), ('Chople', 'Spicy'),
  ('Coba', 'Dry'), ('Coba', 'Bitter'),
  ('Colbur', 'Bitter'), ('Colbur', 'Sour'),
  ('Haban', 'Bitter'), ('Haban', 'Sweet'),
  ('Kasib', 'Dry'), ('Kasib', 'Sweet'),
  ('Kebia', 'Dry'), ('Kebia', 'Sour'),
  ('Occa', 'Spicy'), ('Occa', 'Sweet'),
  ('Passho', 'Dry'), ('Passho', 'Bitter'),
  ('Payapa', 'Sour'), ('Payapa', 'Sweet'),
  ('Rindo', 'Bitter'), ('Rindo', 'Spicy'),
  ('Roseli', 'Dry'), ('Roseli', 'Sweet'),
  ('Shuca', 'Spicy'), ('Shuca', 'Sweet'),
  ('Tanga', 'Spicy'), ('Tanga', 'Sour'),
  ('Wacan', 'Sour'), ('Wacan', 'Sweet'),
  ('Yache', 'Dry'), ('Yache', 'Sour'),
  ('Apicot', 'Dry'), ('Apicot', 'Spicy'), ('Apicot', 'Sour'),
  ('Ganlon', 'Dry'), ('Ganlon', 'Bitter'), ('Ganlon', 'Sweet'),
  ('Lansat', 'Dry'), ('Lansat', 'Bitter'), ('Lansat', 'Spicy'), ('Lansat', 'Sour'), ('Lansat', 'Sweet'),
  ('Liechi', 'Dry'), ('Liechi', 'Spicy'), ('Liechi', 'Sweet'),
  ('Micle', 'Dry'), ('Micle', 'Sweet'),
  ('Petaya', 'Bitter'), ('Petaya', 'Spicy'), ('Petaya', 'Sour'),
  ('Salac', 'Bitter'), ('Salac', 'Sour'), ('Salac', 'Sweet'),
  ('Starf', 'Dry'), ('Starf', 'Bitter'), ('Starf', 'Spicy'), ('Starf', 'Sour'), ('Starf', 'Sweet'),
  ('Custap', 'Bitter'), ('Custap', 'Sweet'),
  ('Enigma', 'Dry'), ('Enigma', 'Spicy'),
  ('Jacoba', 'Bitter'), ('Jacoba', 'Sour'),
  ('Kee', 'Dry'), ('Kee', 'Sweet'),
  ('Leppa', 'Bitter'), ('Leppa', 'Spicy'), ('Leppa', 'Sour'), ('Leppa', 'Sweet'),
  ('Maranga', 'Dry'), ('Maranga', 'Bitter'),
  ('Rowap', 'Dry'), ('Rowap', 'Sweet'),
  ('Belue', 'Spicy'), ('Belue', 'Sour'),
  ('Bluk', 'Dry'), ('Bluk', 'Sweet'),
  ('Cornn', 'Dry'), ('Cornn', 'Sweet'),
  ('Durin', 'Bitter'), ('Durin', 'Sour'),
  ('Magost', 'Bitter'), ('Magost', 'Sweet'),
  ('Nanab', 'Bitter'), ('Nanab', 'Sweet'),
  ('Nomel', 'Spicy'), ('Nomel', 'Sour'),
  ('Pamtre', 'Dry'), ('Pamtre', 'Sweet'),
  ('Pinap', 'Spicy'), ('Pinap', 'Sour'),
  ('Rabuta', 'Bitter'), ('Rabuta', 'Sour'),
  ('Razz', 'Dry'), ('Razz', 'Spicy'),
  ('Spelon', 'Dry'), ('Spelon', 'Spicy'),
  ('Watmel', 'Bitter'), ('Watmel', 'Sweet'),
  ('Wepear', 'Bitter'), ('Wepear', 'Sour')
) as v(item_name, flavor_name) on v.item_name = i.name
join flavors f on f.name = v.flavor_name
where c.name = 'Berries';
