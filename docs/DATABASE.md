# Database Design — KoalaWorld MVP

This document defines the SQLite schema, table structures, indexes, and query patterns for KoalaWorld's MVP. All tables are created on first run via migration statements; no ORM is used.

## Schema Overview

```sql
CREATE TABLE layers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL UNIQUE CHECK(type IN ('earthquake', 'wildfire', 'weather')),
    enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
    last_sync_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ'))
);

CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('earthquake', 'wildfire', 'weather')),
     external_id TEXT NOT NULL,
     updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ')),
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    magnitude REAL,
    depth_km REAL,
    timestamp TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ'))
);

CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_timestamp ON events(timestamp);
CREATE INDEX idx_events_coordinates ON events(latitude, longitude);
```

## Table Definitions

### layers table

| Column       | Type   | Constraints                        | Description                          |
|-------------|--------|-------------------------------------|--------------------------------------|
| `id`        | INTEGER| PRIMARY KEY AUTOINCREMENT           | Unique layer identifier              |
| `type`      | TEXT   | NOT NULL, UNIQUE                    | Layer type enum: earthquake/wildfire/weather |
| `enabled`   | INTEGER| NOT NULL DEFAULT 1                  | Whether the layer is active (0/1)    |
| `last_sync_at` | TEXT | nullable                              | Timestamp of last successful sync for this layer |
| `created_at`| TEXT   | NOT NULL, default value             | Record creation timestamp            |

**Constraints:**
- Only one row per type (`UNIQUE(type)`). Layers are seeded on first run via `INSERT OR IGNORE`.

### events table

| Column       | Type   | Constraints                            | Description                          |
|-------------|--------|-----------------------------------------|--------------------------------------|
| `id`        | INTEGER| PRIMARY KEY AUTOINCREMENT               | Unique event identifier              |
| `type`      | TEXT   | NOT NULL, CHECK type IN (...)          | Event classification                  |
| `source`    | TEXT   | NOT NULL                               | Source system (e.g., 'USGS')          |
| `external_id` | TEXT | NOT NULL                             | ID from the source system             |
| `latitude`  | REAL   | NOT NULL                               | Latitude in decimal degrees         |
| `longitude` | REAL   | NOT NULL                               | Longitude in decimal degrees        |
| `magnitude` | REAL   | nullable                               | Event magnitude (type-dependent)      |
| `depth_km`  | REAL   | nullable                               | Depth in kilometers, if applicable   |
| `timestamp` | TEXT   | NOT NULL                               | ISO 8601 event timestamp              |
| `metadata`  | TEXT   | NOT NULL DEFAULT '{}'                  | JSON object with additional fields    |
| `updated_at`| TEXT   | NOT NULL, default value                | Last update timestamp                 |
| `created_at`| TEXT   | NOT NULL, default value                | Record creation timestamp             |

**Constraints:**
- All coordinates must be valid ranges: latitude [-90, 90], longitude [-180, 180].
- `metadata` field stores JSON; validated at write time by the Go application.

## Indexes

| Index                     | Columns            | Purpose                                  |
|---------------------------|--------------------|------------------------------------------|
| `idx_events_type`         | type               | Fast filtering by event type             |
| `idx_events_timestamp`    | timestamp          | Time-range queries for recent events      |
| `idx_events_coordinates`  | latitude, longitude | Spatial queries (nearby events)           |

## Additional Configuration

On startup, the application enables:
- **WAL mode** (`PRAGMA journal_mode=WAL`) for better concurrent read performance.
- **Foreign keys** (`PRAGMA foreign_keys=ON`) for referential integrity.
- **UNIQUE constraint** on `(source, external_id)` in the events table to prevent duplicate event records from the same source.

## Query Patterns

### Insert (Upsert):
```sql
INSERT INTO events (type, source, external_id, latitude, longitude, magnitude, depth_km, timestamp, metadata) 
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(source, external_id) DO UPDATE SET
    type = excluded.type,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    magnitude = excluded.magnitude,
    depth_km = excluded.depth_km,
    timestamp = excluded.timestamp,
    metadata = excluded.metadata,
    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ');
```

### Select recent earthquake events:
```sql
SELECT id, type, source, latitude, longitude, magnitude, depth_km, timestamp, metadata
FROM events
WHERE type = 'earthquake'
ORDER BY timestamp DESC;
```

### Select all events within bounding box:
```sql
SELECT id, type, source, latitude, longitude, magnitude, depth_km, timestamp, metadata
FROM events
WHERE latitude BETWEEN ? AND ?
  AND longitude BETWEEN ? AND ?
ORDER BY timestamp DESC;
```

## Migration Strategy

- Schema is created once using the `CREATE TABLE` statements above.
- No migration tooling (e.g., GoMigrate); migrations are inline SQL executed by application on startup if tables do not exist.
- Tables are never dropped or altered after initial creation; schema evolution adds columns only when necessary.

## Database File Location

The SQLite database file is stored at `/app/data/koalaworld.db` inside the Docker container, mounted as a volume for persistence across restarts.
