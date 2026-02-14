import 'dotenv/config';
import pg from 'pg';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// PostgreSQL connection
const pgPool = new Pool({
  connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
});

// SQLite connection
const sqliteDbPath = process.env.SQLITE_DIR || join(__dirname, '../storage');
const sqliteDb = new Database(join(sqliteDbPath, 'vibrater.db'));

const tables = [
  'users',
  'devices',
  'ideas',
  'projects',
  'tasks',
  'ai_conversations',
  'code_snippets',
  'refresh_tokens'
];

/**
 * Convert PostgreSQL array to JSON string
 */
function convertArray(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    // PostgreSQL array format: {item1,item2}
    if (value.startsWith('{') && value.endsWith('}')) {
      const items = value.slice(1, -1).split(',').filter(Boolean);
      return JSON.stringify(items);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return null;
}

/**
 * Convert PostgreSQL value to SQLite-compatible value
 */
function convertValue(value, columnName) {
  if (value === null || value === undefined) return null;

  // Convert boolean to integer (SQLite uses 0/1) - check this first
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  // Keep dates as-is (SQLite will store as TEXT)
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Convert arrays to JSON strings
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  // Known array columns (even if they come as strings from PostgreSQL)
  if (columnName === 'vibe' ||
      columnName === 'tech_stack' ||
      columnName === 'tags' ||
      columnName === 'links' ||
      columnName === 'related_ideas') {
    return convertArray(value);
  }

  // Known JSONB columns
  if (columnName === 'conversation' ||
      columnName === 'settings' ||
      columnName === 'messages' ||
      columnName === 'project_plan') {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    if (typeof value === 'string') {
      return value; // Already a string
    }
  }

  // Convert any remaining objects to JSON string
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  // Primitive values (strings, numbers) - return as-is
  return value;
}

/**
 * Migrate a single table
 */
async function migrateTable(tableName) {
  console.log(`\nMigrating table: ${tableName}`);

  try {
    // Clear existing data from SQLite table
    console.log(`  Clearing existing data...`);
    sqliteDb.prepare(`DELETE FROM ${tableName}`).run();

    // Get data from PostgreSQL
    const result = await pgPool.query(`SELECT * FROM ${tableName}`);
    const rows = result.rows;

    if (rows.length === 0) {
      console.log(`  ✓ No data to migrate`);
      return;
    }

    console.log(`  Found ${rows.length} rows`);

    // Get column names from first row
    const columns = Object.keys(rows[0]);

    // Prepare INSERT statement
    const placeholders = columns.map(() => '?').join(', ');
    const insertSql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    const stmt = sqliteDb.prepare(insertSql);

    // Insert rows in a transaction
    const insertMany = sqliteDb.transaction((rows) => {
      for (const row of rows) {
        const values = columns.map(col => convertValue(row[col], col));
        try {
          stmt.run(...values);
        } catch (error) {
          console.error(`  ✗ Failed to insert row:`, error.message);
          console.error(`    Row:`, row);
          throw error;
        }
      }
    });

    insertMany(rows);

    console.log(`  ✓ Migrated ${rows.length} rows`);
  } catch (error) {
    console.error(`  ✗ Error migrating ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🔄 PostgreSQL → SQLite Migration');
  console.log('================================\n');

  try {
    // Test PostgreSQL connection
    console.log('Testing PostgreSQL connection...');
    await pgPool.query('SELECT 1');
    console.log('✓ PostgreSQL connected\n');

    // Test SQLite connection
    console.log('Testing SQLite connection...');
    sqliteDb.prepare('SELECT 1').get();
    console.log('✓ SQLite connected\n');

    // Migrate each table
    for (const table of tables) {
      await migrateTable(table);
    }

    console.log('\n================================');
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n================================');
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close connections
    await pgPool.end();
    sqliteDb.close();
  }
}

// Run migration
migrate();
