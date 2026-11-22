-- [[Improvement - Fill in the last 23 Legendary and Mythical Pokedex entries from the GM's Guide]]: Size, Weight, Diet,
-- Habitat and Proficiencies for the 23 Legendary/Mythical species the first pass
-- (20260830221200_legendary_pokedex_data_from_gmg.sql) couldn't extract, plus corrections to 12 of that pass's 52
-- species, all re-read from PTA3GameMastersGuide.pdf pages 159-262 column by column (the first pass's errors came from
-- the two-column layout: Groudon had Rayquaza's data, Silvally had Genesect's, and several lost the end of a wrapped
-- Proficiencies line or applied a form-only proficiency to the whole line).
--
-- Mapping rules (same as the first pass unless noted):
-- * Habitats: singular -> table name (Cave -> Caves, ...), Arctic -> Polar, Rainforest -> Jungles, Urban Plant -> Urban
--   Plants, Urban Lab -> Urban; new here: Urban Abandoned -> Abandoned, Urban Ruins -> Ruins, Underground dropped.
-- * Proficiencies: Claws / Blades -> Slashing, Magnetic -> Magnetism. Elemental Attack letter suffixes are split per
--   letter (E = Electric, F = Fire, I = Ice): "Elemental Attack FI" -> Elemental Attack F + Elemental Attack I.
--   A qualifier naming a species or form ("Winged (Naganadel)") only applies to that species. Prose instead of a list
--   (Arceus, Silvally, Cosmog, Cosmoem: "can know any move" / "no moves") -> no proficiencies.
-- * Default form for multi-form entries: Terapagos Normal Form, Hoopa Bound, Zacian/Zamazenta Hero of Many Battles,
--   Ogerpon Teal Mask, Dialga/Palkia Altered Form, Kyurem and Eternatus base.
-- Every row is looked up by name (global rows only, campaign_id is null), never by id.
--
-- Changed species: Azelf, Buzzwole, Dialga, Eternatus, Fezandipiti, Groudon, Hoopa, Koraidon, Kubfu, Kyurem, Lugia, Lunala, Magearna, Melmetal, Meltan, Mesprit, Mewtwo, Miraidon, Necrozma, Nihilego, Ogerpon, Palkia, Pheromosa, Poipole, Regidrago, Reshiram, Silvally, Solgaleo, Terapagos, Uxie, Xerneas, Zacian, Zamazenta, Zapdos, Zeraora.

-- New proficiencies the source uses that had no row (same naming pattern as Grass (Melee), Martial (Kicks), ...).
insert into proficiencies (name) select 'Elemental Attack F' where not exists (select 1 from proficiencies where name = 'Elemental Attack F' and campaign_id is null);
insert into proficiencies (name) select 'Dark (Melee)' where not exists (select 1 from proficiencies where name = 'Dark (Melee)' and campaign_id is null);
insert into proficiencies (name) select 'Fire (Melee)' where not exists (select 1 from proficiencies where name = 'Fire (Melee)' and campaign_id is null);
insert into proficiencies (name) select 'Rock (Melee)' where not exists (select 1 from proficiencies where name = 'Rock (Melee)' and campaign_id is null);
insert into proficiencies (name) select 'Water (Melee)' where not exists (select 1 from proficiencies where name = 'Water (Melee)' and campaign_id is null);
insert into proficiencies (name) select 'Martial (No Punches)' where not exists (select 1 from proficiencies where name = 'Martial (No Punches)' and campaign_id is null);
insert into proficiencies (name) select 'Martial (No Kicks)' where not exists (select 1 from proficiencies where name = 'Martial (No Kicks)' and campaign_id is null);

-- Size + Weight
update pokedex set size_id = (select id from sizes where name = 'Small'), weight_id = (select id from weights where name = 'Featherweight') where name = 'Azelf' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Large'), weight_id = (select id from weights where name = 'Superweight') where name = 'Buzzwole' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Gigantic'), weight_id = (select id from weights where name = 'Superweight') where name = 'Dialga' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Gigantic'), weight_id = (select id from weights where name = 'Superweight') where name = 'Eternatus' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Large'), weight_id = (select id from weights where name = 'Medium') where name = 'Fezandipiti' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Gigantic'), weight_id = (select id from weights where name = 'Superweight') where name = 'Groudon' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Small'), weight_id = (select id from weights where name = 'Light') where name = 'Hoopa' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Huge'), weight_id = (select id from weights where name = 'Superweight') where name = 'Koraidon' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Small'), weight_id = (select id from weights where name = 'Light') where name = 'Kubfu' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Gigantic'), weight_id = (select id from weights where name = 'Superweight') where name = 'Kyurem' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Huge'), weight_id = (select id from weights where name = 'Superweight') where name = 'Lugia' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Huge'), weight_id = (select id from weights where name = 'Superweight') where name = 'Lunala' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Medium'), weight_id = (select id from weights where name = 'Heavy') where name = 'Magearna' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Huge'), weight_id = (select id from weights where name = 'Superweight') where name = 'Melmetal' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Small'), weight_id = (select id from weights where name = 'Light') where name = 'Meltan' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Small'), weight_id = (select id from weights where name = 'Featherweight') where name = 'Mesprit' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Large'), weight_id = (select id from weights where name = 'Heavy') where name = 'Mewtwo' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Huge'), weight_id = (select id from weights where name = 'Superweight') where name = 'Miraidon' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Huge'), weight_id = (select id from weights where name = 'Superweight') where name = 'Necrozma' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Medium'), weight_id = (select id from weights where name = 'Medium') where name = 'Nihilego' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Medium'), weight_id = (select id from weights where name = 'Medium') where name = 'Ogerpon' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Gigantic'), weight_id = (select id from weights where name = 'Superweight') where name = 'Palkia' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Large'), weight_id = (select id from weights where name = 'Medium') where name = 'Pheromosa' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Small'), weight_id = (select id from weights where name = 'Light') where name = 'Poipole' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Huge'), weight_id = (select id from weights where name = 'Superweight') where name = 'Regidrago' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Gigantic'), weight_id = (select id from weights where name = 'Superweight') where name = 'Reshiram' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Large'), weight_id = (select id from weights where name = 'Heavy') where name = 'Silvally' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Huge'), weight_id = (select id from weights where name = 'Superweight') where name = 'Solgaleo' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Tiny'), weight_id = (select id from weights where name = 'Featherweight') where name = 'Terapagos' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Small'), weight_id = (select id from weights where name = 'Featherweight') where name = 'Uxie' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Gigantic'), weight_id = (select id from weights where name = 'Superweight') where name = 'Xerneas' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Huge'), weight_id = (select id from weights where name = 'Heavy') where name = 'Zacian' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Huge'), weight_id = (select id from weights where name = 'Heavy') where name = 'Zamazenta' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Large'), weight_id = (select id from weights where name = 'Medium') where name = 'Zapdos' and campaign_id is null;
update pokedex set size_id = (select id from sizes where name = 'Medium'), weight_id = (select id from weights where name = 'Medium') where name = 'Zeraora' and campaign_id is null;

-- Replace Diet / Habitat / Proficiencies for exactly these species.
delete from pokedex_diets where pokedex_id in (select id from pokedex where campaign_id is null and name in ('Azelf', 'Buzzwole', 'Dialga', 'Eternatus', 'Fezandipiti', 'Groudon', 'Hoopa', 'Koraidon', 'Kubfu', 'Kyurem', 'Lugia', 'Lunala', 'Magearna', 'Melmetal', 'Meltan', 'Mesprit', 'Mewtwo', 'Miraidon', 'Necrozma', 'Nihilego', 'Ogerpon', 'Palkia', 'Pheromosa', 'Poipole', 'Regidrago', 'Reshiram', 'Silvally', 'Solgaleo', 'Terapagos', 'Uxie', 'Xerneas', 'Zacian', 'Zamazenta', 'Zapdos', 'Zeraora'));
delete from pokedex_habitats where pokedex_id in (select id from pokedex where campaign_id is null and name in ('Azelf', 'Buzzwole', 'Dialga', 'Eternatus', 'Fezandipiti', 'Groudon', 'Hoopa', 'Koraidon', 'Kubfu', 'Kyurem', 'Lugia', 'Lunala', 'Magearna', 'Melmetal', 'Meltan', 'Mesprit', 'Mewtwo', 'Miraidon', 'Necrozma', 'Nihilego', 'Ogerpon', 'Palkia', 'Pheromosa', 'Poipole', 'Regidrago', 'Reshiram', 'Silvally', 'Solgaleo', 'Terapagos', 'Uxie', 'Xerneas', 'Zacian', 'Zamazenta', 'Zapdos', 'Zeraora'));
delete from pokedex_proficiencies where pokedex_id in (select id from pokedex where campaign_id is null and name in ('Azelf', 'Buzzwole', 'Dialga', 'Eternatus', 'Fezandipiti', 'Groudon', 'Hoopa', 'Koraidon', 'Kubfu', 'Kyurem', 'Lugia', 'Lunala', 'Magearna', 'Melmetal', 'Meltan', 'Mesprit', 'Mewtwo', 'Miraidon', 'Necrozma', 'Nihilego', 'Ogerpon', 'Palkia', 'Pheromosa', 'Poipole', 'Regidrago', 'Reshiram', 'Silvally', 'Solgaleo', 'Terapagos', 'Uxie', 'Xerneas', 'Zacian', 'Zamazenta', 'Zapdos', 'Zeraora'));

insert into pokedex_diets (pokedex_id, diet_id) values
  ((select id from pokedex where name = 'Azelf' and campaign_id is null), (select id from diets where name = 'Herbivore')),
  ((select id from pokedex where name = 'Buzzwole' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Dialga' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Eternatus' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Fezandipiti' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Groudon' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Hoopa' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Koraidon' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Kubfu' and campaign_id is null), (select id from diets where name = 'Herbivore')),
  ((select id from pokedex where name = 'Kyurem' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Lugia' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Lunala' and campaign_id is null), (select id from diets where name = 'Phototroph')),
  ((select id from pokedex where name = 'Magearna' and campaign_id is null), (select id from diets where name = 'Ergovore')),
  ((select id from pokedex where name = 'Melmetal' and campaign_id is null), (select id from diets where name = 'Pollutivore')),
  ((select id from pokedex where name = 'Melmetal' and campaign_id is null), (select id from diets where name = 'Terravore')),
  ((select id from pokedex where name = 'Meltan' and campaign_id is null), (select id from diets where name = 'Pollutivore')),
  ((select id from pokedex where name = 'Meltan' and campaign_id is null), (select id from diets where name = 'Terravore')),
  ((select id from pokedex where name = 'Mesprit' and campaign_id is null), (select id from diets where name = 'Herbivore')),
  ((select id from pokedex where name = 'Mewtwo' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Miraidon' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Necrozma' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Nihilego' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Ogerpon' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Palkia' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Pheromosa' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Poipole' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Regidrago' and campaign_id is null), (select id from diets where name = 'Ergovore')),
  ((select id from pokedex where name = 'Reshiram' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Silvally' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Solgaleo' and campaign_id is null), (select id from diets where name = 'Phototroph')),
  ((select id from pokedex where name = 'Terapagos' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Uxie' and campaign_id is null), (select id from diets where name = 'Herbivore')),
  ((select id from pokedex where name = 'Xerneas' and campaign_id is null), (select id from diets where name = 'Herbivore')),
  ((select id from pokedex where name = 'Zacian' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Zamazenta' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Zapdos' and campaign_id is null), (select id from diets where name = 'Omnivore')),
  ((select id from pokedex where name = 'Zeraora' and campaign_id is null), (select id from diets where name = 'Ergovore'));

insert into pokedex_habitats (pokedex_id, habitat_id) values
  ((select id from pokedex where name = 'Azelf' and campaign_id is null), (select id from habitats where name = 'Caves')),
  ((select id from pokedex where name = 'Azelf' and campaign_id is null), (select id from habitats where name = 'Lakes')),
  ((select id from pokedex where name = 'Buzzwole' and campaign_id is null), (select id from habitats where name = 'Foreign Dimension')),
  ((select id from pokedex where name = 'Dialga' and campaign_id is null), (select id from habitats where name = 'Space')),
  ((select id from pokedex where name = 'Eternatus' and campaign_id is null), (select id from habitats where name = 'Space')),
  ((select id from pokedex where name = 'Fezandipiti' and campaign_id is null), (select id from habitats where name = 'Forests')),
  ((select id from pokedex where name = 'Fezandipiti' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Groudon' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Groudon' and campaign_id is null), (select id from habitats where name = 'Volcanoes')),
  ((select id from pokedex where name = 'Hoopa' and campaign_id is null), (select id from habitats where name = 'Caves')),
  ((select id from pokedex where name = 'Hoopa' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Koraidon' and campaign_id is null), (select id from habitats where name = 'Caves')),
  ((select id from pokedex where name = 'Koraidon' and campaign_id is null), (select id from habitats where name = 'Deserts')),
  ((select id from pokedex where name = 'Kubfu' and campaign_id is null), (select id from habitats where name = 'Forests')),
  ((select id from pokedex where name = 'Kubfu' and campaign_id is null), (select id from habitats where name = 'Urban')),
  ((select id from pokedex where name = 'Kyurem' and campaign_id is null), (select id from habitats where name = 'Space')),
  ((select id from pokedex where name = 'Lugia' and campaign_id is null), (select id from habitats where name = 'Polar')),
  ((select id from pokedex where name = 'Lugia' and campaign_id is null), (select id from habitats where name = 'Oceans')),
  ((select id from pokedex where name = 'Lunala' and campaign_id is null), (select id from habitats where name = 'Forests')),
  ((select id from pokedex where name = 'Lunala' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Lunala' and campaign_id is null), (select id from habitats where name = 'Space')),
  ((select id from pokedex where name = 'Magearna' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Magearna' and campaign_id is null), (select id from habitats where name = 'Ruins')),
  ((select id from pokedex where name = 'Melmetal' and campaign_id is null), (select id from habitats where name = 'Abandoned')),
  ((select id from pokedex where name = 'Meltan' and campaign_id is null), (select id from habitats where name = 'Abandoned')),
  ((select id from pokedex where name = 'Mesprit' and campaign_id is null), (select id from habitats where name = 'Caves')),
  ((select id from pokedex where name = 'Mesprit' and campaign_id is null), (select id from habitats where name = 'Lakes')),
  ((select id from pokedex where name = 'Mewtwo' and campaign_id is null), (select id from habitats where name = 'Caves')),
  ((select id from pokedex where name = 'Mewtwo' and campaign_id is null), (select id from habitats where name = 'Abandoned')),
  ((select id from pokedex where name = 'Miraidon' and campaign_id is null), (select id from habitats where name = 'Caves')),
  ((select id from pokedex where name = 'Miraidon' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Necrozma' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Necrozma' and campaign_id is null), (select id from habitats where name = 'Space')),
  ((select id from pokedex where name = 'Nihilego' and campaign_id is null), (select id from habitats where name = 'Foreign Dimension')),
  ((select id from pokedex where name = 'Ogerpon' and campaign_id is null), (select id from habitats where name = 'Caves')),
  ((select id from pokedex where name = 'Ogerpon' and campaign_id is null), (select id from habitats where name = 'Forests')),
  ((select id from pokedex where name = 'Ogerpon' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Palkia' and campaign_id is null), (select id from habitats where name = 'Space')),
  ((select id from pokedex where name = 'Pheromosa' and campaign_id is null), (select id from habitats where name = 'Foreign Dimension')),
  ((select id from pokedex where name = 'Poipole' and campaign_id is null), (select id from habitats where name = 'Foreign Dimension')),
  ((select id from pokedex where name = 'Regidrago' and campaign_id is null), (select id from habitats where name = 'Caves')),
  ((select id from pokedex where name = 'Regidrago' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Reshiram' and campaign_id is null), (select id from habitats where name = 'Space')),
  ((select id from pokedex where name = 'Silvally' and campaign_id is null), (select id from habitats where name = 'Caves')),
  ((select id from pokedex where name = 'Silvally' and campaign_id is null), (select id from habitats where name = 'Forests')),
  ((select id from pokedex where name = 'Silvally' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Silvally' and campaign_id is null), (select id from habitats where name = 'Urban')),
  ((select id from pokedex where name = 'Solgaleo' and campaign_id is null), (select id from habitats where name = 'Forests')),
  ((select id from pokedex where name = 'Solgaleo' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Solgaleo' and campaign_id is null), (select id from habitats where name = 'Space')),
  ((select id from pokedex where name = 'Terapagos' and campaign_id is null), (select id from habitats where name = 'Caves')),
  ((select id from pokedex where name = 'Uxie' and campaign_id is null), (select id from habitats where name = 'Caves')),
  ((select id from pokedex where name = 'Uxie' and campaign_id is null), (select id from habitats where name = 'Lakes')),
  ((select id from pokedex where name = 'Xerneas' and campaign_id is null), (select id from habitats where name = 'Forests')),
  ((select id from pokedex where name = 'Zacian' and campaign_id is null), (select id from habitats where name = 'Forests')),
  ((select id from pokedex where name = 'Zacian' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Zamazenta' and campaign_id is null), (select id from habitats where name = 'Forests')),
  ((select id from pokedex where name = 'Zamazenta' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Zapdos' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Zapdos' and campaign_id is null), (select id from habitats where name = 'Urban Plants')),
  ((select id from pokedex where name = 'Zeraora' and campaign_id is null), (select id from habitats where name = 'Forests')),
  ((select id from pokedex where name = 'Zeraora' and campaign_id is null), (select id from habitats where name = 'Mountains')),
  ((select id from pokedex where name = 'Zeraora' and campaign_id is null), (select id from habitats where name = 'Abandoned'));

insert into pokedex_proficiencies (pokedex_id, proficiency_id) values
  ((select id from pokedex where name = 'Azelf' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Azelf' and campaign_id is null), (select id from proficiencies where name = 'Elemental Attack E' and campaign_id is null)),
  ((select id from pokedex where name = 'Azelf' and campaign_id is null), (select id from proficiencies where name = 'Elemental Attack F' and campaign_id is null)),
  ((select id from pokedex where name = 'Azelf' and campaign_id is null), (select id from proficiencies where name = 'Hexwork' and campaign_id is null)),
  ((select id from pokedex where name = 'Azelf' and campaign_id is null), (select id from proficiencies where name = 'Weird' and campaign_id is null)),
  ((select id from pokedex where name = 'Buzzwole' and campaign_id is null), (select id from proficiencies where name = 'Bug' and campaign_id is null)),
  ((select id from pokedex where name = 'Buzzwole' and campaign_id is null), (select id from proficiencies where name = 'Fighting' and campaign_id is null)),
  ((select id from pokedex where name = 'Buzzwole' and campaign_id is null), (select id from proficiencies where name = 'Martial (No Kicks)' and campaign_id is null)),
  ((select id from pokedex where name = 'Buzzwole' and campaign_id is null), (select id from proficiencies where name = 'Parasitic' and campaign_id is null)),
  ((select id from pokedex where name = 'Buzzwole' and campaign_id is null), (select id from proficiencies where name = 'Winged' and campaign_id is null)),
  ((select id from pokedex where name = 'Dialga' and campaign_id is null), (select id from proficiencies where name = 'Dragon' and campaign_id is null)),
  ((select id from pokedex where name = 'Dialga' and campaign_id is null), (select id from proficiencies where name = 'Rock' and campaign_id is null)),
  ((select id from pokedex where name = 'Dialga' and campaign_id is null), (select id from proficiencies where name = 'Steel' and campaign_id is null)),
  ((select id from pokedex where name = 'Dialga' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Dialga' and campaign_id is null), (select id from proficiencies where name = 'Energy Blast' and campaign_id is null)),
  ((select id from pokedex where name = 'Dialga' and campaign_id is null), (select id from proficiencies where name = 'Elemental Attack' and campaign_id is null)),
  ((select id from pokedex where name = 'Dialga' and campaign_id is null), (select id from proficiencies where name = 'Fangs' and campaign_id is null)),
  ((select id from pokedex where name = 'Dialga' and campaign_id is null), (select id from proficiencies where name = 'Pulse' and campaign_id is null)),
  ((select id from pokedex where name = 'Dialga' and campaign_id is null), (select id from proficiencies where name = 'Stampeding' and campaign_id is null)),
  ((select id from pokedex where name = 'Eternatus' and campaign_id is null), (select id from proficiencies where name = 'Dragon' and campaign_id is null)),
  ((select id from pokedex where name = 'Eternatus' and campaign_id is null), (select id from proficiencies where name = 'Poison' and campaign_id is null)),
  ((select id from pokedex where name = 'Eternatus' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Eternatus' and campaign_id is null), (select id from proficiencies where name = 'Draconian' and campaign_id is null)),
  ((select id from pokedex where name = 'Eternatus' and campaign_id is null), (select id from proficiencies where name = 'Elemental Attack F' and campaign_id is null)),
  ((select id from pokedex where name = 'Eternatus' and campaign_id is null), (select id from proficiencies where name = 'Fangs' and campaign_id is null)),
  ((select id from pokedex where name = 'Eternatus' and campaign_id is null), (select id from proficiencies where name = 'Stampeding' and campaign_id is null)),
  ((select id from pokedex where name = 'Eternatus' and campaign_id is null), (select id from proficiencies where name = 'Winged' and campaign_id is null)),
  ((select id from pokedex where name = 'Fezandipiti' and campaign_id is null), (select id from proficiencies where name = 'Dark' and campaign_id is null)),
  ((select id from pokedex where name = 'Fezandipiti' and campaign_id is null), (select id from proficiencies where name = 'Flying' and campaign_id is null)),
  ((select id from pokedex where name = 'Fezandipiti' and campaign_id is null), (select id from proficiencies where name = 'Poison' and campaign_id is null)),
  ((select id from pokedex where name = 'Fezandipiti' and campaign_id is null), (select id from proficiencies where name = 'Avian' and campaign_id is null)),
  ((select id from pokedex where name = 'Fezandipiti' and campaign_id is null), (select id from proficiencies where name = 'Winged' and campaign_id is null)),
  ((select id from pokedex where name = 'Fezandipiti' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Groudon' and campaign_id is null), (select id from proficiencies where name = 'Fire' and campaign_id is null)),
  ((select id from pokedex where name = 'Groudon' and campaign_id is null), (select id from proficiencies where name = 'Ground' and campaign_id is null)),
  ((select id from pokedex where name = 'Groudon' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Groudon' and campaign_id is null), (select id from proficiencies where name = 'Stampeding' and campaign_id is null)),
  ((select id from pokedex where name = 'Hoopa' and campaign_id is null), (select id from proficiencies where name = 'Dark' and campaign_id is null)),
  ((select id from pokedex where name = 'Hoopa' and campaign_id is null), (select id from proficiencies where name = 'Ghost' and campaign_id is null)),
  ((select id from pokedex where name = 'Hoopa' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Hoopa' and campaign_id is null), (select id from proficiencies where name = 'Energy Blast' and campaign_id is null)),
  ((select id from pokedex where name = 'Hoopa' and campaign_id is null), (select id from proficiencies where name = 'Pulse' and campaign_id is null)),
  ((select id from pokedex where name = 'Hoopa' and campaign_id is null), (select id from proficiencies where name = 'Stampeding' and campaign_id is null)),
  ((select id from pokedex where name = 'Koraidon' and campaign_id is null), (select id from proficiencies where name = 'Dragon' and campaign_id is null)),
  ((select id from pokedex where name = 'Koraidon' and campaign_id is null), (select id from proficiencies where name = 'Fighting' and campaign_id is null)),
  ((select id from pokedex where name = 'Koraidon' and campaign_id is null), (select id from proficiencies where name = 'Fire' and campaign_id is null)),
  ((select id from pokedex where name = 'Koraidon' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Koraidon' and campaign_id is null), (select id from proficiencies where name = 'Fangs' and campaign_id is null)),
  ((select id from pokedex where name = 'Kubfu' and campaign_id is null), (select id from proficiencies where name = 'Fighting' and campaign_id is null)),
  ((select id from pokedex where name = 'Kubfu' and campaign_id is null), (select id from proficiencies where name = 'Martial' and campaign_id is null)),
  ((select id from pokedex where name = 'Kyurem' and campaign_id is null), (select id from proficiencies where name = 'Dragon' and campaign_id is null)),
  ((select id from pokedex where name = 'Kyurem' and campaign_id is null), (select id from proficiencies where name = 'Ice' and campaign_id is null)),
  ((select id from pokedex where name = 'Kyurem' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Kyurem' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Kyurem' and campaign_id is null), (select id from proficiencies where name = 'Draconian' and campaign_id is null)),
  ((select id from pokedex where name = 'Kyurem' and campaign_id is null), (select id from proficiencies where name = 'Winged' and campaign_id is null)),
  ((select id from pokedex where name = 'Lugia' and campaign_id is null), (select id from proficiencies where name = 'Flying' and campaign_id is null)),
  ((select id from pokedex where name = 'Lugia' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Lugia' and campaign_id is null), (select id from proficiencies where name = 'Water' and campaign_id is null)),
  ((select id from pokedex where name = 'Lugia' and campaign_id is null), (select id from proficiencies where name = 'Avian' and campaign_id is null)),
  ((select id from pokedex where name = 'Lugia' and campaign_id is null), (select id from proficiencies where name = 'Winged' and campaign_id is null)),
  ((select id from pokedex where name = 'Lunala' and campaign_id is null), (select id from proficiencies where name = 'Fairy' and campaign_id is null)),
  ((select id from pokedex where name = 'Lunala' and campaign_id is null), (select id from proficiencies where name = 'Ghost' and campaign_id is null)),
  ((select id from pokedex where name = 'Lunala' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Lunala' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Lunala' and campaign_id is null), (select id from proficiencies where name = 'Winged' and campaign_id is null)),
  ((select id from pokedex where name = 'Magearna' and campaign_id is null), (select id from proficiencies where name = 'Fairy' and campaign_id is null)),
  ((select id from pokedex where name = 'Magearna' and campaign_id is null), (select id from proficiencies where name = 'Steel' and campaign_id is null)),
  ((select id from pokedex where name = 'Magearna' and campaign_id is null), (select id from proficiencies where name = 'Elemental Attack' and campaign_id is null)),
  ((select id from pokedex where name = 'Magearna' and campaign_id is null), (select id from proficiencies where name = 'Energy Blast' and campaign_id is null)),
  ((select id from pokedex where name = 'Melmetal' and campaign_id is null), (select id from proficiencies where name = 'Electric' and campaign_id is null)),
  ((select id from pokedex where name = 'Melmetal' and campaign_id is null), (select id from proficiencies where name = 'Steel' and campaign_id is null)),
  ((select id from pokedex where name = 'Melmetal' and campaign_id is null), (select id from proficiencies where name = 'Magnetism' and campaign_id is null)),
  ((select id from pokedex where name = 'Melmetal' and campaign_id is null), (select id from proficiencies where name = 'Punches' and campaign_id is null)),
  ((select id from pokedex where name = 'Melmetal' and campaign_id is null), (select id from proficiencies where name = 'Stampeding' and campaign_id is null)),
  ((select id from pokedex where name = 'Meltan' and campaign_id is null), (select id from proficiencies where name = 'Electric' and campaign_id is null)),
  ((select id from pokedex where name = 'Meltan' and campaign_id is null), (select id from proficiencies where name = 'Magnetism' and campaign_id is null)),
  ((select id from pokedex where name = 'Mesprit' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Mesprit' and campaign_id is null), (select id from proficiencies where name = 'Elemental Attack E' and campaign_id is null)),
  ((select id from pokedex where name = 'Mesprit' and campaign_id is null), (select id from proficiencies where name = 'Elemental Attack I' and campaign_id is null)),
  ((select id from pokedex where name = 'Mesprit' and campaign_id is null), (select id from proficiencies where name = 'Spellcraft' and campaign_id is null)),
  ((select id from pokedex where name = 'Mesprit' and campaign_id is null), (select id from proficiencies where name = 'Weird' and campaign_id is null)),
  ((select id from pokedex where name = 'Mewtwo' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Mewtwo' and campaign_id is null), (select id from proficiencies where name = 'Bruiser' and campaign_id is null)),
  ((select id from pokedex where name = 'Mewtwo' and campaign_id is null), (select id from proficiencies where name = 'Elemental Attack' and campaign_id is null)),
  ((select id from pokedex where name = 'Mewtwo' and campaign_id is null), (select id from proficiencies where name = 'Energy Blast' and campaign_id is null)),
  ((select id from pokedex where name = 'Miraidon' and campaign_id is null), (select id from proficiencies where name = 'Dragon' and campaign_id is null)),
  ((select id from pokedex where name = 'Miraidon' and campaign_id is null), (select id from proficiencies where name = 'Electric' and campaign_id is null)),
  ((select id from pokedex where name = 'Miraidon' and campaign_id is null), (select id from proficiencies where name = 'Steel' and campaign_id is null)),
  ((select id from pokedex where name = 'Miraidon' and campaign_id is null), (select id from proficiencies where name = 'Energy Blast' and campaign_id is null)),
  ((select id from pokedex where name = 'Miraidon' and campaign_id is null), (select id from proficiencies where name = 'Pulse' and campaign_id is null)),
  ((select id from pokedex where name = 'Necrozma' and campaign_id is null), (select id from proficiencies where name = 'Ghost' and campaign_id is null)),
  ((select id from pokedex where name = 'Necrozma' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Necrozma' and campaign_id is null), (select id from proficiencies where name = 'Rock' and campaign_id is null)),
  ((select id from pokedex where name = 'Necrozma' and campaign_id is null), (select id from proficiencies where name = 'Steel' and campaign_id is null)),
  ((select id from pokedex where name = 'Necrozma' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Necrozma' and campaign_id is null), (select id from proficiencies where name = 'Stampeding' and campaign_id is null)),
  ((select id from pokedex where name = 'Necrozma' and campaign_id is null), (select id from proficiencies where name = 'Draconian' and campaign_id is null)),
  ((select id from pokedex where name = 'Nihilego' and campaign_id is null), (select id from proficiencies where name = 'Electric' and campaign_id is null)),
  ((select id from pokedex where name = 'Nihilego' and campaign_id is null), (select id from proficiencies where name = 'Poison' and campaign_id is null)),
  ((select id from pokedex where name = 'Nihilego' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Nihilego' and campaign_id is null), (select id from proficiencies where name = 'Rock' and campaign_id is null)),
  ((select id from pokedex where name = 'Nihilego' and campaign_id is null), (select id from proficiencies where name = 'Parasitic' and campaign_id is null)),
  ((select id from pokedex where name = 'Ogerpon' and campaign_id is null), (select id from proficiencies where name = 'Dark (Melee)' and campaign_id is null)),
  ((select id from pokedex where name = 'Ogerpon' and campaign_id is null), (select id from proficiencies where name = 'Fire (Melee)' and campaign_id is null)),
  ((select id from pokedex where name = 'Ogerpon' and campaign_id is null), (select id from proficiencies where name = 'Fighting' and campaign_id is null)),
  ((select id from pokedex where name = 'Ogerpon' and campaign_id is null), (select id from proficiencies where name = 'Grass' and campaign_id is null)),
  ((select id from pokedex where name = 'Ogerpon' and campaign_id is null), (select id from proficiencies where name = 'Rock (Melee)' and campaign_id is null)),
  ((select id from pokedex where name = 'Ogerpon' and campaign_id is null), (select id from proficiencies where name = 'Water (Melee)' and campaign_id is null)),
  ((select id from pokedex where name = 'Ogerpon' and campaign_id is null), (select id from proficiencies where name = 'Bruiser' and campaign_id is null)),
  ((select id from pokedex where name = 'Palkia' and campaign_id is null), (select id from proficiencies where name = 'Dragon' and campaign_id is null)),
  ((select id from pokedex where name = 'Palkia' and campaign_id is null), (select id from proficiencies where name = 'Ice' and campaign_id is null)),
  ((select id from pokedex where name = 'Palkia' and campaign_id is null), (select id from proficiencies where name = 'Water' and campaign_id is null)),
  ((select id from pokedex where name = 'Palkia' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Palkia' and campaign_id is null), (select id from proficiencies where name = 'Energy Blast' and campaign_id is null)),
  ((select id from pokedex where name = 'Palkia' and campaign_id is null), (select id from proficiencies where name = 'Elemental Attack' and campaign_id is null)),
  ((select id from pokedex where name = 'Palkia' and campaign_id is null), (select id from proficiencies where name = 'Fangs' and campaign_id is null)),
  ((select id from pokedex where name = 'Palkia' and campaign_id is null), (select id from proficiencies where name = 'Pulse' and campaign_id is null)),
  ((select id from pokedex where name = 'Palkia' and campaign_id is null), (select id from proficiencies where name = 'Stampeding' and campaign_id is null)),
  ((select id from pokedex where name = 'Pheromosa' and campaign_id is null), (select id from proficiencies where name = 'Bug' and campaign_id is null)),
  ((select id from pokedex where name = 'Pheromosa' and campaign_id is null), (select id from proficiencies where name = 'Fighting' and campaign_id is null)),
  ((select id from pokedex where name = 'Pheromosa' and campaign_id is null), (select id from proficiencies where name = 'Lepidopteran' and campaign_id is null)),
  ((select id from pokedex where name = 'Pheromosa' and campaign_id is null), (select id from proficiencies where name = 'Martial (No Punches)' and campaign_id is null)),
  ((select id from pokedex where name = 'Pheromosa' and campaign_id is null), (select id from proficiencies where name = 'Winged' and campaign_id is null)),
  ((select id from pokedex where name = 'Poipole' and campaign_id is null), (select id from proficiencies where name = 'Dragon' and campaign_id is null)),
  ((select id from pokedex where name = 'Poipole' and campaign_id is null), (select id from proficiencies where name = 'Poison' and campaign_id is null)),
  ((select id from pokedex where name = 'Poipole' and campaign_id is null), (select id from proficiencies where name = 'Prickly' and campaign_id is null)),
  ((select id from pokedex where name = 'Regidrago' and campaign_id is null), (select id from proficiencies where name = 'Dragon' and campaign_id is null)),
  ((select id from pokedex where name = 'Regidrago' and campaign_id is null), (select id from proficiencies where name = 'Draconian' and campaign_id is null)),
  ((select id from pokedex where name = 'Regidrago' and campaign_id is null), (select id from proficiencies where name = 'Fangs' and campaign_id is null)),
  ((select id from pokedex where name = 'Regidrago' and campaign_id is null), (select id from proficiencies where name = 'Magnetism' and campaign_id is null)),
  ((select id from pokedex where name = 'Regidrago' and campaign_id is null), (select id from proficiencies where name = 'Stampeding' and campaign_id is null)),
  ((select id from pokedex where name = 'Reshiram' and campaign_id is null), (select id from proficiencies where name = 'Dragon' and campaign_id is null)),
  ((select id from pokedex where name = 'Reshiram' and campaign_id is null), (select id from proficiencies where name = 'Fire' and campaign_id is null)),
  ((select id from pokedex where name = 'Reshiram' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Reshiram' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Reshiram' and campaign_id is null), (select id from proficiencies where name = 'Draconian' and campaign_id is null)),
  ((select id from pokedex where name = 'Reshiram' and campaign_id is null), (select id from proficiencies where name = 'Winged' and campaign_id is null)),
  ((select id from pokedex where name = 'Solgaleo' and campaign_id is null), (select id from proficiencies where name = 'Fire' and campaign_id is null)),
  ((select id from pokedex where name = 'Solgaleo' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Solgaleo' and campaign_id is null), (select id from proficiencies where name = 'Steel' and campaign_id is null)),
  ((select id from pokedex where name = 'Solgaleo' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Solgaleo' and campaign_id is null), (select id from proficiencies where name = 'Fangs' and campaign_id is null)),
  ((select id from pokedex where name = 'Terapagos' and campaign_id is null), (select id from proficiencies where name = 'Elemental Attack' and campaign_id is null)),
  ((select id from pokedex where name = 'Terapagos' and campaign_id is null), (select id from proficiencies where name = 'Energy Blast' and campaign_id is null)),
  ((select id from pokedex where name = 'Terapagos' and campaign_id is null), (select id from proficiencies where name = 'Normal Block' and campaign_id is null)),
  ((select id from pokedex where name = 'Terapagos' and campaign_id is null), (select id from proficiencies where name = 'Pulse' and campaign_id is null)),
  ((select id from pokedex where name = 'Uxie' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Uxie' and campaign_id is null), (select id from proficiencies where name = 'Elemental Attack F' and campaign_id is null)),
  ((select id from pokedex where name = 'Uxie' and campaign_id is null), (select id from proficiencies where name = 'Elemental Attack I' and campaign_id is null)),
  ((select id from pokedex where name = 'Uxie' and campaign_id is null), (select id from proficiencies where name = 'Tricky' and campaign_id is null)),
  ((select id from pokedex where name = 'Uxie' and campaign_id is null), (select id from proficiencies where name = 'Weird' and campaign_id is null)),
  ((select id from pokedex where name = 'Xerneas' and campaign_id is null), (select id from proficiencies where name = 'Fairy' and campaign_id is null)),
  ((select id from pokedex where name = 'Xerneas' and campaign_id is null), (select id from proficiencies where name = 'Grass' and campaign_id is null)),
  ((select id from pokedex where name = 'Xerneas' and campaign_id is null), (select id from proficiencies where name = 'Psychic' and campaign_id is null)),
  ((select id from pokedex where name = 'Xerneas' and campaign_id is null), (select id from proficiencies where name = 'Healer' and campaign_id is null)),
  ((select id from pokedex where name = 'Xerneas' and campaign_id is null), (select id from proficiencies where name = 'Horned' and campaign_id is null)),
  ((select id from pokedex where name = 'Xerneas' and campaign_id is null), (select id from proficiencies where name = 'Pulse' and campaign_id is null)),
  ((select id from pokedex where name = 'Zacian' and campaign_id is null), (select id from proficiencies where name = 'Fairy' and campaign_id is null)),
  ((select id from pokedex where name = 'Zacian' and campaign_id is null), (select id from proficiencies where name = 'Steel' and campaign_id is null)),
  ((select id from pokedex where name = 'Zacian' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Zacian' and campaign_id is null), (select id from proficiencies where name = 'Fangs' and campaign_id is null)),
  ((select id from pokedex where name = 'Zamazenta' and campaign_id is null), (select id from proficiencies where name = 'Fighting' and campaign_id is null)),
  ((select id from pokedex where name = 'Zamazenta' and campaign_id is null), (select id from proficiencies where name = 'Steel' and campaign_id is null)),
  ((select id from pokedex where name = 'Zamazenta' and campaign_id is null), (select id from proficiencies where name = 'Fangs' and campaign_id is null)),
  ((select id from pokedex where name = 'Zamazenta' and campaign_id is null), (select id from proficiencies where name = 'Martial (No Punches)' and campaign_id is null)),
  ((select id from pokedex where name = 'Zapdos' and campaign_id is null), (select id from proficiencies where name = 'Electric' and campaign_id is null)),
  ((select id from pokedex where name = 'Zapdos' and campaign_id is null), (select id from proficiencies where name = 'Flying' and campaign_id is null)),
  ((select id from pokedex where name = 'Zapdos' and campaign_id is null), (select id from proficiencies where name = 'Avian' and campaign_id is null)),
  ((select id from pokedex where name = 'Zapdos' and campaign_id is null), (select id from proficiencies where name = 'Winged' and campaign_id is null)),
  ((select id from pokedex where name = 'Zeraora' and campaign_id is null), (select id from proficiencies where name = 'Electric' and campaign_id is null)),
  ((select id from pokedex where name = 'Zeraora' and campaign_id is null), (select id from proficiencies where name = 'Bruiser' and campaign_id is null)),
  ((select id from pokedex where name = 'Zeraora' and campaign_id is null), (select id from proficiencies where name = 'Slashing' and campaign_id is null)),
  ((select id from pokedex where name = 'Zeraora' and campaign_id is null), (select id from proficiencies where name = 'Fangs' and campaign_id is null));
