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
const loginRoutes = require('./routes/login');

app.use('/api/login', loginRoutes);
// (use other route files similarly)

app.get('/test/trainers', (req, res) => {
  const db = req.app.locals.db;
  db.all('SELECT * FROM trainers', (err, rows) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).send("DB error");
    }
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
