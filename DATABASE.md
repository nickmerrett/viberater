# Database Configuration Guide

Vibrater supports both **SQLite** and **PostgreSQL** databases. You can easily switch between them using environment variables.

## Quick Start

### SQLite (Default - Easiest)

```bash
# In .env or .env.local
DB_TYPE=sqlite
SQLITE_DIR=./storage

# Start the app
podman-compose up
```

SQLite database will be created at `./storage/vibrater.db`

### PostgreSQL (Production-Ready)

```bash
# In .env or .env.local
DB_TYPE=postgres
DATABASE_URL=postgresql://vibrater:password@localhost:5432/vibrater

# Start with PostgreSQL
podman-compose --profile postgres up
```

## Database Comparison

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| **Setup** | Zero config | Requires server |
| **Performance** | Fast for small data | Better for large data |
| **Portability** | Single file | Network database |
| **Backups** | Copy file | pg_dump |
| **Concurrent Writes** | Limited | Excellent |
| **Best For** | Development, small deployments | Production, scaling |

## Configuration Details

### SQLite Configuration

```env
# .env
DB_TYPE=sqlite
SQLITE_DIR=./storage  # Where to store the database file
```

**Pros:**
- No separate database server needed
- Simple backups (just copy the file)
- Perfect for development and small deployments
- Easy to migrate/export (single file)

**Cons:**
- Limited concurrent write performance
- Not ideal for high-traffic production

### PostgreSQL Configuration

```env
# .env
DB_TYPE=postgres
DATABASE_URL=postgresql://user:password@host:5432/database
```

**Pros:**
- Excellent performance and scalability
- Full SQL feature support
- Better for production deployments
- Superior concurrent access

**Cons:**
- Requires PostgreSQL server
- More complex setup and backups

## Running Migrations

Migrations work automatically with both database types:

```bash
# Run all pending migrations
npm run migrate

# Or in Docker
podman exec vibrater_backend npm run migrate
```

The migration system automatically converts PostgreSQL-specific syntax to SQLite when needed.

## Switching Databases

### From SQLite to PostgreSQL

1. **Export your SQLite data:**
```bash
# Install sqlite3 command-line tool
sqlite3 storage/vibrater.db .dump > backup.sql
```

2. **Update your .env:**
```env
DB_TYPE=postgres
DATABASE_URL=postgresql://vibrater:password@localhost:5432/vibrater
```

3. **Start PostgreSQL:**
```bash
podman-compose --profile postgres up -d postgres
```

4. **Run migrations:**
```bash
podman exec vibrater_backend npm run migrate
```

5. **Import data** (manual step - you'll need to convert the SQLite dump to PostgreSQL format)

### From PostgreSQL to SQLite

1. **Export PostgreSQL data:**
```bash
podman exec vibrater_postgres pg_dump -U vibrater vibrater > backup.sql
```

2. **Update your .env:**
```env
DB_TYPE=sqlite
SQLITE_DIR=./storage
```

3. **Run migrations:**
```bash
npm run migrate
```

4. **Import data** (manual step - you'll need to convert the PostgreSQL dump to SQLite format)

## Backup Strategies

### SQLite Backups

**Simple file copy:**
```bash
# Backup
cp storage/vibrater.db backups/vibrater-$(date +%Y%m%d).db

# Restore
cp backups/vibrater-20231227.db storage/vibrater.db
```

**Using SQLite tools:**
```bash
# Backup
sqlite3 storage/vibrater.db ".backup backups/vibrater.db"

# Export to SQL
sqlite3 storage/vibrater.db .dump > backup.sql
```

### PostgreSQL Backups

**Using pg_dump:**
```bash
# Backup entire database
podman exec vibrater_postgres pg_dump -U vibrater vibrater > backup.sql

# Backup with compression
podman exec vibrater_postgres pg_dump -U vibrater -Fc vibrater > backup.dump

# Restore
podman exec -i vibrater_postgres psql -U vibrater vibrater < backup.sql

# Restore compressed
podman exec -i vibrater_postgres pg_restore -U vibrater -d vibrater backup.dump
```

## Docker Compose Profiles

The PostgreSQL service uses a Docker Compose profile, making it optional:

```bash
# Start WITHOUT PostgreSQL (uses SQLite)
podman-compose up

# Start WITH PostgreSQL
podman-compose --profile postgres up

# Stop only PostgreSQL
podman-compose --profile postgres down
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_TYPE` | `sqlite` | Database type: `sqlite` or `postgres` |
| `SQLITE_DIR` | `./storage` | Directory for SQLite database file |
| `DATABASE_URL` | - | PostgreSQL connection string |

## Troubleshooting

### SQLite Issues

**"Database is locked"**
- SQLite locks the entire database for writes
- Reduce concurrent write operations
- Consider switching to PostgreSQL for high concurrency

**"Unable to open database file"**
- Check `SQLITE_DIR` exists and is writable
- Verify file permissions

### PostgreSQL Issues

**"Connection refused"**
- Ensure PostgreSQL is running: `podman ps | grep postgres`
- Check `DATABASE_URL` is correct
- Verify network connectivity

**"Role does not exist"**
- Create the database user:
```bash
podman exec -it vibrater_postgres createuser -U postgres vibrater
```

## Performance Tips

### SQLite
- Enable WAL mode (already enabled in our config)
- Keep database size under 1GB for best performance
- Use VACUUM periodically to optimize

### PostgreSQL
- Adjust connection pool size in `database.js`
- Monitor slow queries
- Use indexes appropriately
- Regular VACUUM and ANALYZE

## Production Recommendations

**For small deployments (<100 users):**
- SQLite is perfectly fine
- Much simpler to manage
- Easy backups and migrations

**For larger deployments:**
- Use PostgreSQL
- Set up regular backups
- Consider managed database services (AWS RDS, etc.)
- Enable SSL connections

## Migration Path

**Recommended progression:**
1. **Start with SQLite** - Quick setup, easy development
2. **Scale with SQLite** - Works well for small to medium traffic
3. **Migrate to PostgreSQL** - When you need better concurrency or scale
4. **Optimize PostgreSQL** - Tune for your specific workload

Both options are production-ready - choose based on your needs!
