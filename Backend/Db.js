// db.js
const { Pool } = require('pg');
const fs = require('fs');
const readline = require('readline');
const path = require('path');

// Path to the user names file for initial import
const FILE_PATH = path.join(__dirname, 'usersnames.txt');

// PostgreSQL connection configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'namesdb',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Cache for alphabet index positions
let alphabetIndexCache = {};
let totalUsers = 0;
let isInitialized = false;

// Initialize the database and cache
async function initialize() {
  try {
    console.log('Initializing database...');
    
    // Create users table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        first_letter CHAR(1) NOT NULL
      );
      
      -- Create index on first_letter for faster letter-based lookups
      CREATE INDEX IF NOT EXISTS idx_users_first_letter ON users(first_letter);
      
      -- Create index on name for faster sorting
      CREATE INDEX IF NOT EXISTS idx_users_name ON users(name);
    `);
    
    // Check if we need to import data
    const { rows: countResult } = await pool.query('SELECT COUNT(*) FROM users');
    const currentCount = parseInt(countResult[0].count);
    
    if (currentCount === 0) {
      console.log('No users found in database. Checking if import is needed...');
      
      // Check if file exists
      if (fs.existsSync(FILE_PATH)) {
        await importUsersFromFile();
      } else {
        console.log('No user file found. Generate test data if needed.');
        await generateTestData(10000000); // Generate 1M test users
        await importUsersFromFile();
      }
    } else {
      console.log(`Database already contains ${currentCount} users. Skipping import.`);
      totalUsers = currentCount;
    }
    
    await buildAlphabetCache();
    isInitialized = true;
    console.log('Initialization complete!');
  } catch (error) {
    console.error('Error during initialization:', error);
    // Retry after a delay
    console.log('Retrying initialization in 5 seconds...');
    setTimeout(initialize, 5000);
  }
}

// Import users from file to database
async function importUsersFromFile() {
  console.log('Importing users from file to database...');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const fileStream = fs.createReadStream(FILE_PATH);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    let batchCounter = 0;
    const batchSize = 10000;
    let values = [];
    let totalImported = 0;
    
    for await (const line of rl) {
      if (!line.trim()) continue;
      
      const name = line.trim();
      const firstLetter = name.charAt(0).toUpperCase();
      
      values.push(`('${name.replace(/'/g, "''")}', '${firstLetter}')`);
      batchCounter++;
      
      if (batchCounter >= batchSize) {
        await client.query(`
          INSERT INTO users (name, first_letter) 
          VALUES ${values.join(',')}
        `);
        
        totalImported += batchCounter;
        console.log(`Imported ${totalImported} users...`);
        
        values = [];
        batchCounter = 0;
      }
    }
    
    // Insert any remaining records
    if (values.length > 0) {
      await client.query(`
        INSERT INTO users (name, first_letter) 
        VALUES ${values.join(',')}
      `);
      totalImported += values.length;
    }
    
    await client.query('COMMIT');
    console.log(`Import completed. Total users imported: ${totalImported}`);
    totalUsers = totalImported;
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during import:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Build the alphabet index cache
async function buildAlphabetCache() {
  console.log('Building alphabet index cache...');
  
  // Initialize with all letters
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  alphabetIndexCache = {};
  
  // Get count for each letter first
  const { rows: letterCounts } = await pool.query(`
    SELECT first_letter, COUNT(*) as count
    FROM users
    GROUP BY first_letter
    ORDER BY first_letter
  `);
  
  // Create a map of letters that have users
  const lettersWithData = {};
  letterCounts.forEach(row => {
    const letter = row.first_letter.toUpperCase();
    if (alphabet.includes(letter)) {
      lettersWithData[letter] = parseInt(row.count);
    }
  });
  
  // Get the start position for each letter
  const { rows } = await pool.query(`
    SELECT first_letter, MIN(id) as first_id
    FROM users
    GROUP BY first_letter
    ORDER BY first_letter
  `);
  
  // Only include letters that actually have data in the alphabetIndex
  rows.forEach(row => {
    const letter = row.first_letter.toUpperCase();
    if (alphabet.includes(letter) && lettersWithData[letter] > 0) {
      // Convert to 0-based index by subtracting 1 from id
      alphabetIndexCache[letter] = parseInt(row.first_id) - 1;
    }
  });
  
  console.log('Alphabet index cache built!', alphabetIndexCache);
}

// Generate test data
async function generateTestData(targetSize) {
  console.log(`Generating test data for approximately ${targetSize} users...`);
  
  // Sample first names and last names for generating data
  const firstNames = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 
    'Adam', 'Brian', 'Aaron', 'Chris', 'Daniel', 'Edward', 'Frank', 'George', 'Henry', 'Ian', 
    'Jack', 'Kevin', 'Larry', 'Matthew', 'Nathan', 'Oscar', 'Paul', 'Quincy', 'Ryan', 'Steven', 
    'Timothy', 'Ulysses', 'Victor', 'Walter', 'Xavier', 'Zachary'];
    
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor',
    'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson',
    'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King',
    'Wright', 'Lopez', 'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter'];
  
  // Calculate how many batches we need (for memory efficiency)
  const batchSize = 100000;
  const batches = Math.ceil(targetSize / batchSize);
  
  // Create write stream
  const writeStream = fs.createWriteStream(FILE_PATH);
  
  // Generate names in batches
  let generatedCount = 0;
  
  const suffixes = ['', ' Jr.', ' Sr.', ' II', ' III', ' IV', ' V', ' PhD', ' MD', ' DDS', ' Esq.'];
  
  for (let batch = 0; batch < batches; batch++) {
    const batchNames = [];
    const currentBatchSize = Math.min(batchSize, targetSize - generatedCount);
    
    for (let i = 0; i < currentBatchSize; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const suffix = (Math.random() < 0.1) ? suffixes[Math.floor(Math.random() * suffixes.length)] : '';
      
      batchNames.push(`${firstName} ${lastName}${suffix}`);
    }
    
    // Sort batch names alphabetically
    batchNames.sort();
    
    // Write to file
    writeStream.write(batchNames.join('\n') + '\n');
    
    generatedCount += currentBatchSize;
    console.log(`Generated ${generatedCount} names (${(generatedCount/targetSize*100).toFixed(1)}%)`);
  }
  
  await new Promise(resolve => writeStream.end(resolve));
  console.log('Test data generation completed');
}

// Methods to access data from other files
async function getUsers(start, limit) {
  try {
    const { rows } = await pool.query(`
      SELECT name FROM users 
      ORDER BY name 
      LIMIT $1 OFFSET $2
    `, [limit, start]);
    
    return {
      users: rows.map(row => row.name),
      total: totalUsers,
      start,
      limit
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
}

async function getAlphabetIndex() {
  try {
    const { rows } = await pool.query(`
      SELECT first_letter, COUNT(*) as count
      FROM users
      GROUP BY first_letter
      ORDER BY first_letter
    `);
    
    const letterCounts = {};
    
    rows.forEach(row => {
      const letter = row.first_letter.toUpperCase();
      letterCounts[letter] = parseInt(row.count);
    });
    
    return {
      alphabetIndex: alphabetIndexCache,
      letterCounts: letterCounts,
      totalUsers
    };
  } catch (error) {
    console.error('Error fetching letter counts:', error);
    return {
      alphabetIndex: alphabetIndexCache,
      letterCounts: {},
      totalUsers
    };
  }
}

module.exports = {
  pool,
  initialize,
  getUsers,
  getAlphabetIndex,
  isInitialized: () => isInitialized
};