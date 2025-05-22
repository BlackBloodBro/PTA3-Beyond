// routes/trainers.js
const express = require('express');
const router = express.Router();

// Define trainer routes
// Handle GET request to fetch all trainers
router.get('/', (req, res) => {
  // Get the database connection from the server
  const db = req.app.locals.db;

  // Query to select all trainers
  const query = 'SELECT * FROM trainers';

  // Execute the query
  db.all(query, (error, trainers) => {
    if (error) {
      console.error('Error fetching trainers from database:', error);
      return res.status(500).json({ error: 'Failed to fetch trainers' });
    }

    // Send back the list of trainers as JSON
    res.json(trainers);
  });
});

module.exports = router;