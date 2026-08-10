-- Corrective fixes for Researcher Features, found while cross-checking the existing seeded rows
-- against the Player's Handbook PDF (pages 74-88) as part of [[Add all Class features to the list]]
-- (seeding Breeder/Coordinator/Ranger). User-confirmed fixes, one per discrepancy found.

-- 1. Same split/truncation bug as Ace trainer's fix (20260810100000): "Stat increase" + "Advanced
-- class" were two separate, truncated rows at levels 3/7/11 instead of one combined feature.
delete from features
where name in ('Stat increase', 'Advanced class')
  and class_id = (select id from classes where name = 'Researcher')
  and subclass_id is null
  and level_required in (3, 7, 11);

insert into features (name, description, class_id, subclass_id, level_required) values
  ('Stat Increase and Advanced Class', 'Choose two different Trainer Stats to increase by 1, then gain 1d4 max HP. You only gain new stats at levels 3, 7, and 11. Choose a Researcher Advanced Class or a different base Class. You can only ever gain a single Class or Advanced Class at a time, at level 3, level 7, and level 11', (select id from classes where name = 'Researcher'), null, 3),
  ('Stat Increase and Advanced Class', 'Choose two different Trainer Stats to increase by 1, then gain 1d4 max HP. You only gain new stats at levels 3, 7, and 11. Choose a Researcher Advanced Class or a different base Class. You can only ever gain a single Class or Advanced Class at a time, at level 3, level 7, and level 11', (select id from classes where name = 'Researcher'), null, 7),
  ('Stat Increase and Advanced Class', 'Choose two different Trainer Stats to increase by 1, then gain 1d4 max HP. You only gain new stats at levels 3, 7, and 11. Choose a Researcher Advanced Class or a different base Class. You can only ever gain a single Class or Advanced Class at a time, at level 3, level 7, and level 11', (select id from classes where name = 'Researcher'), null, 11);

-- 2. Archeologist Fossil resurrection: typo, "our hours" should be "four hours"
update features set description = 'You’ve studied for a long time and finally constructed your very own portable fossil reanimator. Once per day you may use your fossil reanimator for three hours to create an egg from any fossil that will hatch a Pokémon of the matching species. Your reanimator machine needs weekly maintenance and will break into disrepair without you. If you lose or break your reanimator, it takes four hours for you to repair it. You may not use the same fossil sample more than once to create an egg. You may only use your portable fossil reanimator once per day, regardless of the feature you are using'
where name = 'Fossil resurrection' and subclass_id = (select id from subclasses where name = 'Archeologist') and level_required = 6;

-- 3. Archeologist Stone energizer: restore the list of qualifying evolutionary stones
update features set description = 'Using your reanimator to infused its energies into stones yield fascinating results. Once per day, you may use your fossil reanimator for one hour to give an expended evolutionary stone back its ability to evolve a Pokémon. You may even change it into any other evolutionary stone (Dawn Stone, Dusk Stone, Fire Stone, Ice Stone, Leaf Stone, Moon Stone, Shiny Stone, Sun Stone, Thunder Stone, or Water Stone). You may only use your portable fossil reanimator once per day, regardless of the feature you are using'
where name = 'Stone energizer' and subclass_id = (select id from subclasses where name = 'Archeologist') and level_required = 8;

-- 4. Archeologist Lovable atrocities: restore the clarifying parenthetical
update features set description = 'Once per week, you can use any two fossils simultaneously with your portable fossil reanimator. The resulting Pokémon egg will hatch a Pokémon that will not be able to evolve but will have aspects of both fossil’s Pokémon combined (the Pokémon who hatches can be based on any stage in the evolutionary families of each combined fossil, not just the base form -- for example Machoke and Alakazam). Its types will be one type from each of the fossil’s species. Each of its stats should be an average of the two fossil’s species stats. It’s passives and moves should be a combination of the basic available passives and moves from each fossil’s species. All other information about the Pokémon and its appearance is up to you. You may only use your portable fossil reanimator once per day, regardless of the feature you are using'
where name = 'Lovable atrocities' and subclass_id = (select id from subclasses where name = 'Archeologist') and level_required = 13;

-- 5. Watcher: name typo, "Appied" should be "Applied"
update features set name = 'Applied psychology'
where name = 'Appied psychology' and subclass_id = (select id from subclasses where name = 'Watcher') and level_required = 7;
