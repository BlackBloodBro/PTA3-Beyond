const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON requests
app.use(express.json());
app.use(express.static('public'));

// Initialize the database
require('./database/initDatabase');

// Open a database connection
const db = new sqlite3.Database('database.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Make db accessible to routes
app.locals.db = db;

// Import and use routes
const userRoutes = require('./routes/users');
const trainerRoutes = require('./routes/trainers');
const pokemonRoutes = require('./routes/pokemon');

app.use('/api/users', userRoutes);
app.use('/api/trainers', trainerRoutes);
app.use('/api/pokemon', pokemonRoutes);
// (use other route files similarly)

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
