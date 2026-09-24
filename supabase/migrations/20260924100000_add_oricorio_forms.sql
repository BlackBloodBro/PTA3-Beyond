-- Adds Oricorio's 3 missing forms (Pom-Pom/Electric, Pa'u/Psychic, Sensu/Ghost) alongside the existing
-- "Oricorio (Fire)" (id 529, the Baile form) -- confirmed only that one form existed before this.
-- All 4 real Oricorio forms share identical base stats and non-elemental traits (habitat, diet, egg
-- group, the two "Avian/Flying/Winged" proficiencies, and the same curated 3-move/4-passive set) --
-- only typing, the elemental Proficiency, and the sprite differ per form, so each new row clones
-- "Oricorio (Fire)" exactly except for those. Sprite slugs (oricorio-pom-pom/-pau/-sensu) verified
-- directly against img.pokemondb.net before writing this migration, matching the existing Fire row's
-- own "oricorio-baile" convention.
do $$
declare
  fire_id constant int := 529;
  new_id int;
  flying_type_id constant int := 9;
  flying_proficiency_id constant int := (select id from proficiencies where name = 'Flying');
  avian_proficiency_id constant int := (select id from proficiencies where name = 'Avian');
  winged_proficiency_id constant int := (select id from proficiencies where name = 'Winged');
  meadows_habitat_id constant int := (select id from habitats where name = 'Meadows');
  herbivore_diet_id constant int := (select id from diets where name = 'Herbivore');
  flying_egg_group_id constant int := (select id from egg_groups where name = 'Flying');
  form record;
begin
  for form in
    select * from (values
      ('Oricorio (Electric)', (select id from types where name = 'Electric'), 'oricorio-pom-pom', (select id from proficiencies where name = 'Electric')),
      ('Oricorio (Psychic)', (select id from types where name = 'Psychic'), 'oricorio-pau', (select id from proficiencies where name = 'Psychic')),
      ('Oricorio (Ghost)', (select id from types where name = 'Ghost'), 'oricorio-sensu', (select id from proficiencies where name = 'Ghost'))
    ) as v(name, elemental_type_id, sprite_code, elemental_proficiency_id)
  loop
    insert into pokedex (
      name, type_1_id, type_2_id, size_id, weight_id, growth_rate_id,
      base_hp, base_atk, base_def, base_sp_atk, base_sp_def, base_speed,
      catch_rate, egg_hatch_rate, description, sprite_code
    )
    select
      form.name, form.elemental_type_id, flying_type_id, p.size_id, p.weight_id, p.growth_rate_id,
      p.base_hp, p.base_atk, p.base_def, p.base_sp_atk, p.base_sp_def, p.base_speed,
      p.catch_rate, p.egg_hatch_rate, p.description, form.sprite_code
    from pokedex p where p.id = fire_id
    returning id into new_id;

    insert into pokedex_moves (pokedex_id, move_id, level_learned, learnable_without_exp)
    select new_id, pm.move_id, pm.level_learned, pm.learnable_without_exp
    from pokedex_moves pm where pm.pokedex_id = fire_id;

    insert into pokedex_passives (pokedex_id, passive_id, level_learned)
    select new_id, pp.passive_id, pp.level_learned
    from pokedex_passives pp where pp.pokedex_id = fire_id;

    insert into pokedex_habitats (pokedex_id, habitat_id) values (new_id, meadows_habitat_id);
    insert into pokedex_diets (pokedex_id, diet_id) values (new_id, herbivore_diet_id);
    insert into pokedex_egg_groups (pokedex_id, egg_group_id) values (new_id, flying_egg_group_id);
    insert into pokedex_proficiencies (pokedex_id, proficiency_id) values
      (new_id, avian_proficiency_id),
      (new_id, flying_proficiency_id),
      (new_id, winged_proficiency_id),
      (new_id, form.elemental_proficiency_id);
  end loop;
end $$;
