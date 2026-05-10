import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, DB_TYPE, executeSql } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const startFrom = process.argv[2];

async function runMigrations() {
  console.log(`Running database migrations for ${DB_TYPE.toUpperCase()}...\n`);

  try {
    // Create migrations table if it doesn't exist
    await executeSql(`
      CREATE TABLE IF NOT EXISTS migrations (
        id ${DB_TYPE === 'postgres' ? 'SERIAL' : 'INTEGER'} PRIMARY KEY ${DB_TYPE === 'sqlite' ? 'AUTOINCREMENT' : ''},
        filename ${DB_TYPE === 'postgres' ? 'VARCHAR(255)' : 'TEXT'} UNIQUE NOT NULL,
        applied_at ${DB_TYPE === 'postgres' ? 'TIMESTAMP' : 'DATETIME'} DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = (await fs.readdir(__dirname))
      .filter(f => f.endsWith('.sql'))
      .sort();

    const applied = await db('migrations').select('filename');
    const appliedSet = new Set(applied.map(r => r.filename));

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`⊘ ${file} (already applied)`);
        continue;
      }

      if (startFrom) {
        const num = parseInt(file.match(/^(\d+)/)?.[1]);
        if (num && num < parseInt(startFrom)) {
          console.log(`⊘ ${file} (skipped - before ${startFrom})`);
          await db('migrations').insert({ filename: file }).onConflict('filename').ignore();
          continue;
        }
      }

      console.log(`Running migration: ${file}`);

      let sql = await fs.readFile(path.join(__dirname, file), 'utf-8');
      if (DB_TYPE === 'sqlite') sql = convertPostgresToSQLite(sql);

      await executeSql(sql);
      await db('migrations').insert({ filename: file });

      console.log(`✓ ${file} completed\n`);
    }

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

function convertPostgresToSQLite(sql) {
  return sql
    .replace(/CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+"[^"]+";?\s*/gi, '')
    .replace(/CREATE\s+EXTENSION\s+"[^"]+";?\s*/gi, '')
    .replace(/CREATE\s+OR\s+REPLACE\s+FUNCTION[\s\S]*?language\s+'plpgsql';?\s*/gi, '')
    .replace(/CREATE\s+FUNCTION[\s\S]*?language\s+'plpgsql';?\s*/gi, '')
    .replace(/CREATE\s+TRIGGER[\s\S]*?EXECUTE\s+(FUNCTION|PROCEDURE)\s+[^;]+;?\s*/gi, '')
    .replace(/COMMENT\s+ON\s+(TABLE|COLUMN|INDEX)\s+[\s\S]*?;/gi, '')
    .replace(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+\w+\s+USING\s+\w+\s*\([^)]+\)\s*;?/gi, '')
    .replace(/CREATE\s+INDEX\s+\w+\s+ON\s+\w+\s+USING\s+\w+\s*\([^)]+\)\s*;?/gi, '')
    .replace(/ALTER\s+TABLE[\s\S]*?ADD\s+CONSTRAINT[\s\S]*?;/gi, '')
    .replace(/ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+/gi, 'ALTER TABLE $1 ADD COLUMN ')
    .replace(/\bUUID\b/gi, 'TEXT')
    .replace(/\bSERIAL\s+PRIMARY\s+KEY\b/gi, 'INTEGER PRIMARY KEY AUTOINCREMENT')
    .replace(/\bTIMESTAMP\b/gi, 'DATETIME')
    .replace(/\bDATE\b/gi, 'TEXT')
    .replace(/\bDECIMAL\([^)]+\)/gi, 'REAL')
    .replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP')
    .replace(/\bTEXT\[\]/gi, 'TEXT')
    .replace(/\bUUID\[\]/gi, 'TEXT')
    .replace(/\bINTEGER\[\]/gi, 'TEXT')
    .replace(/\bVARCHAR\(\d+\)/gi, 'TEXT')
    .replace(/\bJSONB\b/gi, 'TEXT')
    .replace(/\bDEFAULT\s+gen_random_uuid\(\)/gi, '')
    .replace(/\bBOOLEAN\b/gi, 'INTEGER')
    .replace(/\bTRUE\b/gi, '1')
    .replace(/\bFALSE\b/gi, '0')
    .replace(/\bON\s+CONFLICT\s+\([^)]+\)\s+DO\s+NOTHING\b/gi, '')
    .replace(/\bON\s+DELETE\s+SET\s+NULL\b/gi, 'ON DELETE SET NULL')
    .replace(/\bON\s+DELETE\s+CASCADE\b/gi, 'ON DELETE CASCADE')
    .replace(/\bON\s+UPDATE\s+CASCADE\b/gi, '');
}

runMigrations();
