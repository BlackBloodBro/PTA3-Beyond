const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("database.db");

db.serialize(() => {

  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('player', 'gamemaster')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trainers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      level INTEGER,
      class_id INTEGER,
      subclass_1_id INTEGER,
      subclass_2_id INTEGER,
      subclass_3_id INTEGER,
      origin_id INTEGER,
      current_hp INTEGER,
      max_hp INTEGER,
      attack INTEGER,
      defense INTEGER,
      special_attack INTEGER,
      special_defense INTEGER,
      speed INTEGER,
      money INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (subclass_1_id) REFERENCES advanced_classes(id),
      FOREIGN KEY (subclass_2_id) REFERENCES advanced_classes(id),
      FOREIGN KEY (subclass_3_id) REFERENCES advanced_classes(id),
      FOREIGN KEY (origin_id) REFERENCES origins(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokemon (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokedex_id INTEGER,
      trainer_id INTEGER,
      nature_id INTEGER,
      nickname TEXT,
      obtained TEXT NOT NULL,
      experience INTEGER,
      loyalty REAL,
      level INTEGER,
      gender TEXT CHECK(gender IN ('male', 'female', 'genderless')),
      shiny BOOLEAN CHECK(shiny IN (0, 1)),
      held_item_id INTEGER,
      current_hp INTEGER,
      ev_hp INTEGER CHECK(ev_hp IN (0, 1, 2)),
      ev_attack INTEGER CHECK(ev_attack IN (0, 1, 2)),
      ev_defense INTEGER CHECK(ev_defense IN (0, 1, 2)),
      ev_special_attack INTEGER CHECK(ev_special_attack IN (0, 1, 2)),
      ev_special_defense INTEGER CHECK(ev_special_defense IN (0, 1, 2)),
      ev_speed INTEGER CHECK(ev_speed IN (0, 1, 2)),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pokedex_id) REFERENCES pokedex(id),
      FOREIGN KEY (trainer_id) REFERENCES trainers(id),
      FOREIGN KEY (nature_id) REFERENCES natures(id),
      FOREIGN KEY (held_item_id) REFERENCES items(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainer_id INTEGER,
      pokemon_id INTEGER,
      placement INTEGER CHECK(placement IN (0, 1, 2, 3, 4, 5)),
      FOREIGN KEY (trainer_id) REFERENCES trainers(id),
      FOREIGN KEY (pokemon_id) REFERENCES pokemon(id),
      UNIQUE (trainer_id, placement)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokemon_passives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokemon_id INTEGER,
      passive_id INTEGER,
      FOREIGN KEY (pokemon_id) REFERENCES pokemon(id),
      FOREIGN KEY (passive_id) REFERENCES passives(id),
      UNIQUE (pokemon_id, passive_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokemon_moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokemon_id INTEGER,
      move_id INTEGER,
      FOREIGN KEY (pokemon_id) REFERENCES pokemon(id),
      FOREIGN KEY (move_id) REFERENCES moves(id),
      UNIQUE (pokemon_id, move_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokedex (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type_1_id INTEGER,
      type_2_id INTEGER,
      growth_rate TEXT CHECK(growth_rate IN ("erratic", "fast", "medium_fast", "medium_slow", "slow")),
      base_hp INTEGER,
      base_attack INTEGER,
      base_defense INTEGER,
      base_special_attack INTEGER,
      base_special_defense INTEGER,
      base_speed INTEGER,
      FOREIGN KEY (type_1_id) REFERENCES types(id),
      FOREIGN KEY (type_2_id) REFERENCES types(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      range TEXT,
      type_id INTEGER,
      stat TEXT CHECK(stat IN ("attack", "special_attack", "speed")),
      frequency TEXT CHECK(frequency IN ("at_will", "3/day", "1/day")),
      damage TEXT,
      effect TEXT,
      FOREIGN KEY (type_id) REFERENCES types(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS learnsets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      move_id INTEGER,
      pokedex_id INTEGER,
      level INTEGER,
      FOREIGN KEY (move_id) REFERENCES moves(id),
      FOREIGN KEY (pokedex_id) REFERENCES pokedex(id),
      UNIQUE (move_id, pokedex_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS natures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      stat_increase TEXT CHECK(stat_increase IN ("attack", "defense", "special_attack", "special_defense", "speed")),
      stat_decrease TEXT CHECK(stat_decrease IN ("attack", "defense", "special_attack", "special_defense", "speed"))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS passives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      effect TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      effect TEXT,
      category TEXT,
      held_item BOOLEAN CHECK(held_item IN (0, 1)),
      price INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS inventories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainer_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      quantity INTEGER,
      stackable BOOLEAN CHECK(held_item IN (0, 1)),
      FOREIGN KEY (trainer_id) REFERENCES trainers(id),
      FOREIGN KEY (item_id) REFERENCES items(id),
      UNIQUE (trainer_id, item_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS advanced_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER,
      name TEXT NOT NULL UNIQUE,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS origins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      feature TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS levels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      experience INTEGER,
      level INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS level_modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      value_integer INTEGER,
      value_text TEXT,
      modifier REAL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS breeding_modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      value_integer INTEGER,
      value_text TEXT,
      modifier INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS catch_modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      value_integer INTEGER,
      value_text TEXT,
      modifier INTEGER
    )
  `);

});

db.close();
