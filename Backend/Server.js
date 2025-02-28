// server.js
const express = require('express');
const cors = require('cors');
const db = require('./Db');

const app = express();
const PORT = process.env.PORT || 5001;

// Enable CORS
app.use(cors());
app.use(express.json());

// API endpoint to get users with pagination
app.get('/api/users', async (req, res) => {
  // Wait for initialization
  if (!db.isInitialized()) {
    return res.status(503).json({ error: 'Server is initializing, please try again shortly' });
  }
  
  const start = parseInt(req.query.start) || 0;
  const limit = parseInt(req.query.limit) || 100;
  
  // Validate parameters
  if (start < 0 || limit <= 0 || limit > 200000) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }
  
  try {
    console.log(`Fetching users from ${start} to ${start + limit}`);
    const result = await db.getUsers(start, limit);
    res.json(result);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// API endpoint to get alphabet index map for navigation
app.get('/api/alphabet-index', async (req, res) => {
  if (!db.isInitialized()) {
    return res.status(503).json({ error: 'Server is initializing, please try again shortly' });
  }
  
  try {
    const result = await db.getAlphabetIndex();
    res.json(result);
  } catch (error) {
    console.error('Error fetching alphabet index:', error);
    res.status(500).json({ error: 'Failed to fetch alphabet index' });
  }
});

// Start the server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await db.initialize();
});