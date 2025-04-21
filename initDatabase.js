const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("database.db");

db.serialize(() => {
  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trainer_id INTEGER UNIQUE,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trainers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      level INTEGER,
      class TEXT,
      subclass_1 TEXT,
      subclass_2 TEXT,
      subclass_3 TEXT,
      origin TEXT,
      hitpoints INTEGER,
      attack INTEGER,
      defense INTEGER,
      special_attack INTEGER,
      special_defense INTEGER,
      speed INTEGER,
      money INTEGER,
      pokemon_1_id INTEGER,
      pokemon_2_id INTEGER,
      pokemon_3_id INTEGER,
      pokemon_4_id INTEGER,
      pokemon_5_id INTEGER,
      pokemon_6_id INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokemon (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokedex_id INTEGER UNIQUE,
      trainer_id INTEGER UNIQUE,
      nature_id INTEGER,
      nickname TEXT,
      obtained TEXT,
      experience INTEGER,
      loyalty INTEGER,
      level INTEGER,
      gender TEXT,
      shiny TEXT,
      held_item TEXT,
      current_hp INTEGER,
      ev_hp INTEGER,
      ev_attack INTEGER,
      ev_defense INTEGER,
      ev_special_attack INTEGER,
      ev_special_defense INTEGER,
      ev_speed INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pokedex (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name INTEGER,
      type_1_id INTEGER,
      type_2_id INTEGER,
      growth_rate TEXT,
      base_hp INTEGER,
      base_attack INTEGER,
      base_defense INTEGER,
      base_special_attack INTEGER,
      base_special_defense INTEGER,
      base_speed INTEGER,
      learnset TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS moves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      range TEXT,
      type TEXT,
      stat TEXT,
      frequency TEXT,
      damage TEXT,
      effect TEXT
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
      name TEXT,
      effect TEXT,
      type TEXT,
      price INTEGER
    )
  `);
  

});

db.close();
