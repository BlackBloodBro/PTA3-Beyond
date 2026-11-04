-- [[Improvement - Only show battle items in an encounter]]: an Encounter's Trainer actions panel used to list
-- a Trainer's entire Bag. Which items count as "battle items" is decided per category: this flag is false for
-- every category by default (including new GM custom ones, who tick it on the category form) and set true for
-- the built-in categories whose items are plausibly used mid-fight. A "Show all items" toggle in the panel
-- still reveals everything else.
alter table item_categories add column show_in_encounters boolean not null default false;

update item_categories
set show_in_encounters = true
where campaign_id is null
  and name in ('Combat Enhancers', 'Medicine', 'Poké Balls', 'Berries');
