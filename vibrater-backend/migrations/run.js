import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, executeSql, getDbType, close } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get migration to start from (e.g., npm run migrate 003)
const startFrom = process.argv[2];
const dbType = getDbType();

async function runMigrations() {
  console.log(`Running database migrations for ${dbType.toUpperCase()}...\n`);

  try {
    // Create migrations table if it doesn't exist
    if (dbType === 'postgres') {
      await executeSql(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) UNIQUE NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } else {
      // SQLite
      await executeSql(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT UNIQUE NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // Get all migration files
    const files = await fs.readdir(__dirname);
    const migrationFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();

    // Get completed migrations
    const result = await query('SELECT filename FROM migrations');
    const completedMigrations = new Set(result.rows.map(r => r.filename));

    for (const file of migrationFiles) {
      // Skip if already completed
      if (completedMigrations.has(file)) {
        console.log(`⊘ ${file} (already applied)`);
        continue;
      }

      // Skip if before startFrom parameter
      if (startFrom) {
        const fileNumber = file.match(/^(\d+)/)?.[1];
        if (fileNumber && parseInt(fileNumber) < parseInt(startFrom)) {
          console.log(`⊘ ${file} (skipped - before ${startFrom})`);
          // Mark as completed so we don't try to run it next time
          if (dbType === 'postgres') {
            await query(
              'INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
              [file]
            );
          } else {
            await query(
              'INSERT OR IGNORE INTO migrations (filename) VALUES (?)',
              [file]
            );
          }
          continue;
        }
      }

      console.log(`Running migration: ${file}`);

      // Read and execute migration
      let sql = await fs.readFile(path.join(__dirname, file), 'utf-8');

      // Convert PostgreSQL-specific syntax to SQLite if needed
      if (dbType === 'sqlite') {
        sql = convertPostgresToSQLite(sql);
      }

      await executeSql(sql);

      // Record migration
      if (dbType === 'postgres') {
        await query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
      } else {
        await query('INSERT INTO migrations (filename) VALUES (?)', [file]);
      }

      console.log(`✓ ${file} completed\n`);
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await close();
  }
}

/**
 * Convert PostgreSQL SQL to SQLite SQL
 */
function convertPostgresToSQLite(sql) {
  return sql
    // Remove CREATE EXTENSION statements (PostgreSQL-specific)
    .replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"[^"]+";?\s*/gi, '')
    .replace(/CREATE\s+EXTENSION\s+"[^"]+";?\s*/gi, '')

    // Remove PostgreSQL functions and triggers (not supported in SQLite)
    .replace(/CREATE\s+OR\s+REPLACE\s+FUNCTION[\s\S]*?language\s+'plpgsql';?\s*/gi, '')
    .replace(/CREATE\s+FUNCTION[\s\S]*?language\s+'plpgsql';?\s*/gi, '')
    .replace(/CREATE\s+TRIGGER[\s\S]*?EXECUTE\s+(FUNCTION|PROCEDURE)\s+[^;]+;?\s*/gi, '')

    // Remove COMMENT ON statements (not supported in SQLite)
    .replace(/COMMENT\s+ON\s+(TABLE|COLUMN|INDEX)\s+[\s\S]*?;/gi, '')

    // Remove CREATE INDEX with USING clause (PostgreSQL-specific, completely remove these)
    .replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+\w+\s+USING\s+\w+\s*\([^)]+\)\s*;?/gi, '')
    .replace(/CREATE\s+INDEX\s+\w+\s+ON\s+\w+\s+USING\s+\w+\s*\([^)]+\)\s*;?/gi, '')

    // Remove ALTER TABLE ADD CONSTRAINT (foreign keys are added inline in SQLite)
    .replace(/ALTER\s+TABLE[\s\S]*?ADD\s+CONSTRAINT[\s\S]*?;/gi, '')

    // ALTER TABLE ADD COLUMN IF NOT EXISTS -> ALTER TABLE ADD COLUMN
    // SQLite doesn't support IF NOT EXISTS in ALTER TABLE
    .replace(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+/gi, 'ALTER TABLE $1 ADD COLUMN ')

    // UUID to TEXT
    .replace(/\bUUID\b/gi, 'TEXT')

    // SERIAL to INTEGER PRIMARY KEY AUTOINCREMENT
    .replace(/\bSERIAL\s+PRIMARY\s+KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')

    // TIMESTAMP to DATETIME
    .replace(/\bTIMESTAMP\b/gi, 'DATETIME')

    // DATE to TEXT (SQLite doesn't have DATE type)
    .replace(/\bDATE\b/gi, 'TEXT')

    // DECIMAL to REAL
    .replace(/\bDECIMAL\([^)]+\)/gi, 'REAL')

    // NOW() to CURRENT_TIMESTAMP
    .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP')

    // Array types to TEXT (store as JSON)
    .replace(/\bTEXT\[\]/gi, 'TEXT')
    .replace(/\bUUID\[\]/gi, 'TEXT')
    .replace(/\bINTEGER\[\]/gi, 'TEXT')

    // VARCHAR to TEXT (SQLite uses TEXT for everything)
    .replace(/\bVARCHAR\(\d+\)/gi, 'TEXT')

    // JSONB to TEXT
    .replace(/\bJSONB\b/gi, 'TEXT')

    // gen_random_uuid() - will need to generate UUIDs in application code
    .replace(/\bDEFAULT\s+gen_random_uuid\(\)/gi, '')

    // BOOLEAN to INTEGER (SQLite doesn't have BOOLEAN)
    .replace(/\bBOOLEAN\b/gi, 'INTEGER')
    .replace(/\bTRUE\b/gi, '1')
    .replace(/\bFALSE\b/gi, '0')

    // Remove ON CONFLICT clauses (SQLite uses INSERT OR IGNORE instead)
    .replace(/\bON\s+CONFLICT\s+\([^)]+\)\s+DO\s+NOTHING\b/gi, '')

    // ON DELETE SET NULL
    .replace(/\bON\s+DELETE\s+SET\s+NULL\b/gi, 'ON DELETE SET NULL')

    // CASCADE constraints
    .replace(/\bON\s+DELETE\s+CASCADE\b/gi, 'ON DELETE CASCADE')
    .replace(/\bON\s+UPDATE\s+CASCADE\b/gi, '');
}

runMigrations();
