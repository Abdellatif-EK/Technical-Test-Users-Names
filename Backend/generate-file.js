const fs = require('fs');
const path = require('path');

// Configuration
const TARGET_SIZE = 10000000; // 10 million users
const FILE_PATH = path.join(__dirname, 'usersnames10M.txt');

// Sample first names for generating data
const firstNames = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
  'Adam', 'Brian', 'Aaron', 'Chris', 'Daniel', 'Edward', 'Frank', 'George', 'Henry', 'Ian',
  'Jack', 'Kevin', 'Larry', 'Matthew', 'Nathan', 'Oscar', 'Paul', 'Quincy', 'Ryan', 'Steven',
  'Timothy', 'Ulysses', 'Victor', 'Walter','Yan','Yassir', 'Xavier', 'Zachary'
];

// Sample last names for generating data
const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor',
  'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson',
  'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King',
  'Wright', 'Lopez', 'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter',
  'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins',
  'Stewart', 'Sanchez', 'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan', 'Bell', 'Murphy', 'Bailey',
  'Rivera', 'Cooper', 'Richardson', 'Cox', 'Howard', 'Ward', 'Torres', 'Peterson', 'Gray', 'Ramirez',
  'James', 'Watson', 'Brooks', 'Kelly', 'Sanders', 'Price', 'Bennett', 'Wood', 'Barnes', 'Ross',
  'Henderson', 'Coleman', 'Jenkins', 'Perry', 'Powell', 'Long', 'Patterson', 'Hughes', 'Flores', 'Washington',
  'Butler', 'Simmons', 'Foster', 'Gonzales', 'Bryant', 'Alexander', 'Russell', 'Griffin', 'Diaz', 'Hayes'
];

// Suffixes to add variety to names (applied randomly with 10% probability)
const suffixes = ['', ' Jr.', ' Sr.', ' II', ' III', ' IV', ' V', ' PhD', ' MD', ' DDS', ' Esq.'];

function generateTestData() {
  console.log(`Generating test data for ${TARGET_SIZE} users...`);

  // Array to store all generated names
  const allNames = [];

  // Generate 10 million names
  for (let i = 0; i < TARGET_SIZE; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const suffix = (Math.random() < 0.1) ? suffixes[Math.floor(Math.random() * suffixes.length)] : '';
    const name = `${firstName} ${lastName}${suffix}`;
    allNames.push(name);

    // Log progress every 1 million names
    if (i % 1000000 === 0) {
      console.log(`Generated ${i} names...`);
    }
  }

  // Sort all names alphabetically
  console.log('Sorting names...');
  allNames.sort();

  // Write sorted names to the file
  console.log('Writing to file...');
  fs.writeFileSync(FILE_PATH, allNames.join('\n'));

  // Log completion and file size
  console.log('Test data generation completed');
  const stats = fs.statSync(FILE_PATH);
  const fileSizeMB = stats.size / (1024 * 1024);
  console.log(`File size: ${fileSizeMB.toFixed(2)} MB`);
}

// Execute the generation function
generateTestData();