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
- Only one row per type (`UNIQUE(type)`). The application manages insertion via `INSERT OR REPLACE`.

### events table

| Column       | Type   | Constraints                            | Description                          |
|-------------|--------|-----------------------------------------|--------------------------------------|
| `id`        | INTEGER| PRIMARY KEY AUTOINCREMENT               | Unique event identifier              |
| `type`      | TEXT   | NOT NULL, CHECK type IN (...)          | Event classification                  |
| `source`    | TEXT   | NOTNULL                                 | Source system (e.g., 'USGS')          |
| `latitude`  | REAL   | NOTNULL                                 | Latitude in decimal degrees         |
| `longitude` | REAL   | NOTNULL                                 | Longitude in decimal degrees        |
| `magnitude` | REAL   | nullable                                  | Event magnitude (type-dependent)      |
| `depth_km`  | REAL   | nullable                                  | Depth in kilometers, if applicable   |
| `timestamp` | TEXT   | NOTNULL                                 | ISO 8601 event timestamp              |
| `metadata`  | TEXT   | NOT NULL DEFAULT '{}'                     | JSON object with additional fields    |
| `created_at`| TEXT   | NOTNULL, default value                  | Record creation timestamp             |

**Constraints:**
- All coordinates must be valid ranges: latitude [-90, 90], longitude [-180, 180].
- `metadata` field stores JSON; validated at write time by the Go application.

## Indexes

| Index                     | Columns            | Purpose                                  |
|---------------------------|--------------------|------------------------------------------|
| `idx_events_type`         | type               | Fast filtering by event type             |
| `idx_events_timestamp`    | timestamp          | Time-range queries for recent events      |
| `idx_events_coordinates`  | latitude, longitude | Spatial queries (nearby events)           |

## Query Patterns

### Insert (Upsert):
```sql
INSERT INTO events (type, source, external_id, latitude, longitude, magnitude, depth_km, timestamp, metadata) 
VALUES (?, ?, ?, ?, ?, ?, ?, ?); ON CONFLICT(source, external_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;
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

The SQLite database file is stored at `/data/koalaworld.db` inside the Docker container, mounted as a volume for persistence across restarts.
