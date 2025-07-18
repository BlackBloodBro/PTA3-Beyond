// routes/users.js
const express = require('express');
const router = express.Router();

// Handle POST request to create a new user
router.post('/', (req, res) => {
  const db = req.app.locals.db;

  // Extract user data from the request body
  const { username, password, role } = req.body;

  // SQL query to insert a new user into the database
  const query = `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`;

  // Execute the query with provided values
  db.run(query, [username, password, role], function (error) {
    if (error) {
      console.error('Error inserting user into database:', error);
      return res.status(500).json({ error: 'Failed to add user' });
    }

    // Respond with the new user's ID
    res.status(201).json({ id: this.lastID });
  });
});

// Handle POST request to log in a user
router.post('/login', (req, res) => {
  const db = req.app.locals.db;

  // Extract login credentials from the request body
  const { username, password } = req.body;

  // SQL query to find a user with matching username and password
  const query = `SELECT * FROM users WHERE username = ? AND password = ?`;

  // Execute the query
  db.get(query, [username, password], (error, user) => {
    if (error) {
      console.error('Error checking login credentials:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    // If no user is found, return an error
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Respond with user info (e.g., role for redirect)
    res.json({ id: user.id, role: user.role });
  });
});

module.exports = router;
