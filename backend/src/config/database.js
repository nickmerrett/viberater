import pg from 'pg';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs-extra';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database type from environment variable (default: sqlite)
const DB_TYPE = process.env.DB_TYPE || 'sqlite';

let db = null;
let pool = null;

// Initialize database based on type
if (DB_TYPE === 'postgres') {
  console.log('🗄️  Using PostgreSQL database');

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  pool.on('connect', () => {
    console.log('✓ Connected to PostgreSQL database');
  });

  pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
  });
} else {
  console.log('🗄️  Using SQLite database');

  // Create database directory if it doesn't exist
  const dbDir = process.env.SQLITE_DIR || join(__dirname, '../../storage');
  const dbPath = join(dbDir, 'vibrater.db');

  fs.ensureDirSync(dbDir);

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  console.log(`✓ Connected to SQLite database: ${dbPath}`);
}

/**
 * Generate UUID for SQLite inserts
 */
export function generateUUID() {
  return uuidv4();
}

/**
 * Parse SQLite row - convert JSON strings back to arrays/objects
 */
function parseRow(row) {
  if (!row) return row;

  const parsed = { ...row };

  // Known array columns
  const arrayColumns = ['tags', 'vibe', 'tech_stack', 'links', 'related_ideas'];
  // Known JSON/object columns
  const jsonColumns = ['conversation', 'settings', 'messages', 'project_plan'];

  for (const [key, value] of Object.entries(parsed)) {
    if (value === null || value === undefined) continue;

    // Parse array columns
    if (arrayColumns.includes(key) && typeof value === 'string') {
      try {
        parsed[key] = JSON.parse(value);
        // Ensure it's an array
        if (!Array.isArray(parsed[key])) {
          parsed[key] = [];
        }
      } catch (e) {
        // If parse fails, return empty array
        parsed[key] = [];
      }
    }

    // Parse JSON columns
    if (jsonColumns.includes(key) && typeof value === 'string') {
      try {
        parsed[key] = JSON.parse(value);
      } catch (e) {
        // Keep as string if parse fails
      }
    }

    // Convert integer booleans back to boolean (SQLite stores as 0/1)
    if (key === 'archived' || key === 'ai_generated' || key === 'git_committed') {
      parsed[key] = Boolean(value);
    }
  }

  return parsed;
}

/**
 * Unified query interface for both PostgreSQL and SQLite
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(text, params = []) {
  if (DB_TYPE === 'postgres') {
    return pool.query(text, params);
  } else {
    // SQLite synchronous API wrapped in Promise
    return new Promise((resolve, reject) => {
      try {
        // Convert PostgreSQL-style $1, $2 to SQLite-style ?
        let sqliteQuery = text;
        let sqliteParams = [...params];

        if (params && params.length > 0) {
          sqliteQuery = text.replace(/\$(\d+)/g, '?');
        }

        // Convert PostgreSQL functions to SQLite equivalents
        sqliteQuery = sqliteQuery.replace(/\bNOW\(\)/gi, 'CURRENT_TIMESTAMP');

        // Convert Date objects to ISO strings for SQLite
        sqliteParams = sqliteParams.map(param => {
          if (param instanceof Date) {
            return param.toISOString();
          }
          return param;
        });

        // For INSERT statements, check if we need to inject a UUID for id column
        const isInsert = sqliteQuery.trim().toUpperCase().startsWith('INSERT');
        if (isInsert) {
          // Check if the INSERT is missing an id column value
          const insertMatch = sqliteQuery.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
          if (insertMatch) {
            const tableName = insertMatch[1];
            const columns = insertMatch[2].split(',').map(c => c.trim());

            // Skip migrations table and other tables that use INTEGER autoincrement
            const skipTables = ['migrations'];

            // If 'id' column is not in the list and table needs UUIDs, add it
            if (!columns.includes('id') && !skipTables.includes(tableName)) {
              const uuid = generateUUID();

              // Add id column
              columns.unshift('id');

              // Add UUID to params at the beginning
              sqliteParams.unshift(uuid);

              // Rebuild query with id column
              const valuesMatch = sqliteQuery.match(/VALUES\s*\(([^)]+)\)/i);
              if (valuesMatch) {
                const newColumns = columns.join(', ');
                const valuesPlaceholders = columns.map(() => '?').join(', ');
                sqliteQuery = sqliteQuery.replace(
                  /INSERT\s+INTO\s+\w+\s*\([^)]+\)\s*VALUES\s*\([^)]+\)/i,
                  `INSERT INTO ${tableName} (${newColumns}) VALUES (${valuesPlaceholders})`
                );
              }
            }
          }
        }

        // Determine if this is a SELECT query or a mutation
        const isSelect = sqliteQuery.trim().toUpperCase().startsWith('SELECT');
        const isReturning = sqliteQuery.toUpperCase().includes('RETURNING');

        if (isSelect) {
          const rows = db.prepare(sqliteQuery).all(...sqliteParams);
          // Parse JSON strings back to arrays/objects for SQLite results
          const parsedRows = rows.map(row => parseRow(row));
          resolve({ rows: parsedRows, rowCount: parsedRows.length });
        } else if (isReturning) {
          // Handle INSERT/UPDATE/DELETE with RETURNING clause
          // SQLite doesn't support RETURNING, so we need to handle this differently

          // Remove RETURNING clause and get the columns
          const returningMatch = sqliteQuery.match(/RETURNING\s+(.+?)(?:;|$)/i);
          const returningColumns = returningMatch ? returningMatch[1].trim() : '*';
          const queryWithoutReturning = sqliteQuery.replace(/RETURNING\s+.+?(?:;|$)/i, '');

          const info = db.prepare(queryWithoutReturning).run(...sqliteParams);

          // Fetch the inserted/updated row
          let rows = [];
          if (info.lastInsertRowid || sqliteParams[0]) {
            // For INSERT, get the last inserted row
            const tableName = queryWithoutReturning.match(/INSERT\s+INTO\s+(\w+)/i)?.[1];
            if (tableName) {
              // If we generated a UUID, use it to fetch the row
              if (isInsert && sqliteParams[0]) {
                rows = db.prepare(`SELECT ${returningColumns} FROM ${tableName} WHERE id = ?`).all(sqliteParams[0]);
              } else if (info.lastInsertRowid) {
                rows = db.prepare(`SELECT ${returningColumns} FROM ${tableName} WHERE rowid = ?`).all(info.lastInsertRowid);
              }
              // Parse the returned rows
              rows = rows.map(row => parseRow(row));
            }
          } else {
            // For UPDATE/DELETE, we can't easily get the affected rows in SQLite
            // Return empty rows array with changes count
            rows = [];
          }

          resolve({ rows, rowCount: info.changes });
        } else {
          // Regular INSERT/UPDATE/DELETE without RETURNING
          const info = db.prepare(sqliteQuery).run(...sqliteParams);
          resolve({ rows: [], rowCount: info.changes });
        }
      } catch (error) {
        reject(error);
      }
    });
  }
}

/**
 * Get a database client (for transactions)
 * For SQLite, this returns a transaction wrapper
 */
export async function getClient() {
  if (DB_TYPE === 'postgres') {
    return pool.connect();
  } else {
    // Return a SQLite transaction wrapper
    return {
      query: query,
      release: () => {},
      query: async (text, params) => query(text, params)
    };
  }
}

/**
 * Execute raw SQL (for migrations)
 * @param {string} sql - Raw SQL to execute
 */
export async function executeSql(sql) {
  if (DB_TYPE === 'postgres') {
    return pool.query(sql);
  } else {
    return new Promise((resolve, reject) => {
      try {
        db.exec(sql);
        resolve({ rowCount: 0 });
      } catch (error) {
        reject(error);
      }
    });
  }
}

/**
 * Get database type
 */
export function getDbType() {
  return DB_TYPE;
}

/**
 * Close database connection
 */
export async function close() {
  if (DB_TYPE === 'postgres') {
    await pool.end();
  } else {
    db.close();
  }
}

// Export pool/db for direct access if needed
export { pool, db };

export default { query, getClient, executeSql, getDbType, close, generateUUID };
