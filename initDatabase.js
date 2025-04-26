const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("database.db");

db.serialize(() => {

  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE CHECK(length(username) > 0),
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('player', 'gamemaster'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE CHECK(length(name) > 0)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS loyalties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level INTEGER NOT NULL UNIQUE,
      description TEXT NOT NULL CHECK(length(description) > 0),
      exp_modifier REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS obtain_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE CHECK(length(name) > 0),
      exp_modifier REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS weights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS egg_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS diets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL CHECK(length(description) > 0)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS habitats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS proficiencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL CHECK(length(description) > 0)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS growth_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      exp_modifier REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS frequencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      frequency INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS natures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(name) > 0),
      stat_increase_id INTEGER NOT NULL,
      stat_decrease_id INTEGER NOT NULL,
      FOREIGN KEY (stat_increase_id) REFERENCES stats(id),
      FOREIGN KEY (stat_decrease_id) REFERENCES stats(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS passives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(name) > 0),
      description TEXT NOT NULL CHECK(length(description) > 0)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS item_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE CHECK(length(name) > 0),
      description TEXT NOT NULL CHECK(length(description) > 0)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE CHECK(length(name) > 0)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS origins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE CHECK(length(name) > 0),
      feature TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level INTEGER NOT NULL UNIQUE CHECK(level >= 1),
      experience INTEGER NOT NULL UNIQUE CHECK(experience >= 0)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS afflictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE CHECK(length(name) > 0),
      description TEXT NOT NULL CHECK(length(description) > 0),
      catch_modifier INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS catch_modifier_hp (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE CHECK(length(name) > 0),
      catch_modifier INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS catch_modifier_battlestart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE CHECK(length(name) > 0),
      catch_modifier INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS breeding_modifier_friendship (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE CHECK(length(name) > 0),
      breeding_modifier INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(name) > 0),
      description TEXT NOT NULL CHECK(length(description) > 0),
      category_id INTEGER NOT NULL,
      held_item BOOLEAN NOT NULL CHECK(held_item IN (0, 1)),
      price INTEGER CHECK(price >= 0),
      FOREIGN KEY (category_id) REFERENCES item_categories(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS catch_modifier_ball (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL UNIQUE,
      catch_modifier INTEGER NOT NULL,
      FOREIGN KEY (item_id) REFERENCES items(id) 
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE CHECK(length(name) > 0),
      description TEXT NOT NULL CHECK(length(description) > 0),
      type TEXT NOT NULL CHECK(type IN ('class', 'subclass')),
      class_id INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS features (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE CHECK(length(name) > 0),
      description TEXT NOT NULL CHECK(length(description) > 0),
      class_id INTEGER NOT NULL,
      frequency_id INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (frequency_id) REFERENCES frequencies(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(name) > 0),
      range TEXT NOT NULL,
      type_id INTEGER NOT NULL,
      stat_id INTEGER NOT NULL,
      frequency_id INTEGER NOT NULL,
      damage TEXT NOT NULL,
      effect TEXT,
      FOREIGN KEY (type_id) REFERENCES types(id),
      FOREIGN KEY (stat_id) REFERENCES stats(id),
      FOREIGN KEY (frequency_id) REFERENCES frequencies(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS passive_modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      passive_id INTEGER NOT NULL,
      stat_id INTEGER NOT NULL,
      modifier INTEGER NOT NULL CHECK(modifier >= 1),
      FOREIGN KEY (passive_id) REFERENCES passives(id),
      FOREIGN KEY (stat_id) REFERENCES stats(id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokedex (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dexpage INTEGER CHECK(dexpage > 0),
      name TEXT NOT NULL CHECK(length(name) > 0),
      type_1_id INTEGER NOT NULL,
      type_2_id INTEGER,
      growth_rate_id INTEGER NOT NULL,
      base_hp INTEGER NOT NULL,
      base_attack INTEGER NOT NULL,
      base_defense INTEGER NOT NULL,
      base_special_attack INTEGER NOT NULL,
      base_special_defense INTEGER NOT NULL,
      base_speed INTEGER NOT NULL,
      FOREIGN KEY (type_1_id) REFERENCES types(id),
      FOREIGN KEY (type_2_id) REFERENCES types(id),
      FOREIGN KEY (growth_rate_id) REFERENCES growth_rates(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trainers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL CHECK(length(name) > 0),
      level INTEGER NOT NULL CHECK(level >= 1),
      class_id INTEGER NOT NULL,
      subclass_1_id INTEGER,
      subclass_2_id INTEGER,
      subclass_3_id INTEGER,
      origin_id INTEGER NOT NULL,
      current_hp INTEGER NOT NULL,
      max_hp INTEGER NOT NULL CHECK(max_hp >= 0),
      attack INTEGER NOT NULL CHECK(attack >= 0),
      defense INTEGER NOT NULL CHECK(defense >= 0),
      special_attack INTEGER NOT NULL CHECK(special_attack >= 0),
      special_defense INTEGER NOT NULL CHECK(special_defense >= 0),
      speed INTEGER NOT NULL CHECK(speed >= 0),
      money INTEGER NOT NULL CHECK(money >= 0),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (subclass_1_id) REFERENCES classes(id),
      FOREIGN KEY (subclass_2_id) REFERENCES classes(id),
      FOREIGN KEY (subclass_3_id) REFERENCES classes(id),
      FOREIGN KEY (origin_id) REFERENCES origins(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokemon (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokedex_id INTEGER NOT NULL,
      trainer_id INTEGER NOT NULL,
      nature_id INTEGER NOT NULL,
      size_id INTEGER NOT NULL,
      weight_id INTEGER NOT NULL,
      hatch_rate INTEGER NOT NULL CHECK(hatch_rate > 0),
      nickname TEXT CHECK(length(nickname) <= 30 AND length(nickname) > 0),
      obtain_method_id INTEGER NOT NULL,
      experience INTEGER NOT NULL CHECK(experience >= 0),
      loyalty REAL NOT NULL CHECK(loyalty >= 0.0),
      loyalty_level INTEGER NOT NULL,
      level INTEGER NOT NULL CHECK(level >= 1),
      gender TEXT NOT NULL CHECK(gender IN ('male', 'female', 'genderless')),
      shiny BOOLEAN NOT NULL CHECK(shiny IN (0, 1)),
      held_item_id INTEGER,
      current_hp INTEGER NOT NULL,
      ev_hp INTEGER NOT NULL CHECK(ev_hp >= 0 AND ev_hp <= 2),
      ev_attack INTEGER NOT NULL CHECK(ev_attack >= 0 AND ev_attack <= 2),
      ev_defense INTEGER NOT NULL CHECK(ev_defense >= 0 AND ev_defense <= 2),
      ev_special_attack INTEGER NOT NULL CHECK(ev_special_attack >= 0 AND ev_special_attack <= 2),
      ev_special_defense INTEGER NOT NULL CHECK(ev_special_defense >= 0 AND ev_special_defense <= 2),
      ev_speed INTEGER NOT NULL CHECK(ev_speed >= 0 AND ev_speed <= 2),
      FOREIGN KEY (pokedex_id) REFERENCES pokedex(id),
      FOREIGN KEY (trainer_id) REFERENCES trainers(id),
      FOREIGN KEY (nature_id) REFERENCES natures(id),
      FOREIGN KEY (size_id) REFERENCES sizes(id),
      FOREIGN KEY (weight_id) REFERENCES weights(id),
      FOREIGN KEY (obtain_method_id) REFERENCES obtain_methods(id),
      FOREIGN KEY (held_item_id) REFERENCES items(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trainers_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainer_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK ((stackable = 1 AND quantity >= 1) OR (stackable = 0 AND quantity = 1)),
      stackable BOOLEAN NOT NULL CHECK(stackable IN (0, 1)),
      FOREIGN KEY (trainer_id) REFERENCES trainers(id),
      FOREIGN KEY (item_id) REFERENCES items(id),
      UNIQUE (trainer_id, item_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokedex_egg_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokedex_id INTEGER NOT NULL,
      egg_group_id INTEGER NOT NULL,
      FOREIGN KEY (pokedex_id) REFERENCES pokedex(id),
      FOREIGN KEY (egg_group_id) REFERENCES egg_groups(id),
      UNIQUE (pokedex_id, egg_group_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokedex_diets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokedex_id INTEGER NOT NULL,
      diet_id INTEGER NOT NULL,
      FOREIGN KEY (pokedex_id) REFERENCES pokedex(id),
      FOREIGN KEY (diet_id) REFERENCES diets(id),
      UNIQUE (pokedex_id, diet_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokedex_habitats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokedex_id INTEGER NOT NULL,
      habitat_id INTEGER NOT NULL,
      FOREIGN KEY (pokedex_id) REFERENCES pokedex(id),
      FOREIGN KEY (habitat_id) REFERENCES habitats(id),
      UNIQUE (pokedex_id, habitat_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokedex_proficiencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokedex_id INTEGER NOT NULL,
      proficiency_id INTEGER NOT NULL,
      FOREIGN KEY (pokedex_id) REFERENCES pokedex(id),
      FOREIGN KEY (proficiency_id) REFERENCES proficiencies(id),
      UNIQUE (pokedex_id, proficiency_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS moves_proficiencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      move_id INTEGER NOT NULL,
      proficiency_id INTEGER NOT NULL,
      FOREIGN KEY (move_id) REFERENCES moves(id),
      FOREIGN KEY (proficiency_id) REFERENCES proficiencies(id),
      UNIQUE (move_id, proficiency_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trainers_pokemon (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainer_id INTEGER NOT NULL,
      pokemon_id INTEGER NOT NULL UNIQUE,
      placement INTEGER CHECK(placement BETWEEN 0 AND 5),
      FOREIGN KEY (trainer_id) REFERENCES trainers(id),
      FOREIGN KEY (pokemon_id) REFERENCES pokemon(id),
      UNIQUE (trainer_id, placement)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokedex_passives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokedex_id INTEGER NOT NULL,
      passive_id INTEGER NOT NULL,
      FOREIGN KEY (pokedex_id) REFERENCES pokedex(id),
      FOREIGN KEY (passive_id) REFERENCES passives(id),
      UNIQUE (pokedex_id, passive_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokemon_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokemon_id INTEGER NOT NULL,
      move_id INTEGER NOT NULL,
      placement INTEGER CHECK(placement BETWEEN 0 AND 5),
      FOREIGN KEY (pokemon_id) REFERENCES pokemon(id),
      FOREIGN KEY (move_id) REFERENCES moves(id),
      UNIQUE (pokemon_id, move_id),
      UNIQUE (pokemon_id, placement)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokedex_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      move_id INTEGER NOT NULL,
      pokedex_id INTEGER NOT NULL,
      level INTEGER NOT NULL CHECK(level >= 1),
      FOREIGN KEY (move_id) REFERENCES moves(id),
      FOREIGN KEY (pokedex_id) REFERENCES pokedex(id),
      UNIQUE (move_id, pokedex_id)
    )
  `);

});

db.close();
