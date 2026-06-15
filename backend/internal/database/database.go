package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"time"

	_ "modernc.org/sqlite"
)

// DB wraps the SQLite database connection.
type DB struct {
	*sql.DB
}

// Layer represents a row in the layers table.
type Layer struct {
	ID         int64   `json:"id"`
	Type       string  `json:"type"`
	Enabled    bool    `json:"enabled"`
	LastSyncAt *string `json:"last_sync"`
	CreatedAt  string  `json:"-"`
}

// Event represents a row in the events table.
type Event struct {
	ID         int64           `json:"id"`
	Type       string          `json:"type"`
	Source     string          `json:"source"`
	ExternalID string          `json:"external_id"`
	Latitude   float64         `json:"latitude"`
	Longitude  float64         `json:"longitude"`
	Magnitude  *float64        `json:"magnitude,omitempty"`
	DepthKm    *float64        `json:"depth_km,omitempty"`
	Timestamp  string          `json:"timestamp"`
	Metadata   json.RawMessage `json:"metadata"`
	UpdatedAt  string          `json:"-"`
	CreatedAt  string          `json:"-"`
}

// Open opens the SQLite database at dbPath, creating the directory and
// running migrations if necessary.
func Open(dbPath string) (*DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create data directory: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	// Enable WAL mode for better concurrent read performance.
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		return nil, fmt.Errorf("enable WAL: %w", err)
	}

	if _, err := db.Exec("PRAGMA busy_timeout = 5000"); err != nil {
		return nil, fmt.Errorf("set busy timeout: %w", err)
	}

	// Enable foreign keys.
	if _, err := db.Exec("PRAGMA foreign_keys=ON"); err != nil {
		return nil, fmt.Errorf("enable foreign keys: %w", err)
	}

	if err := migrate(db); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	if err := seed(db); err != nil {
		return nil, fmt.Errorf("seed: %w", err)
	}

	return &DB{db}, nil
}

// migrate creates tables and indexes if they do not exist.
// Schema matches docs/DATABASE.md with corrections: added source column
// and UNIQUE(source, external_id) constraint to events table.
func migrate(db *sql.DB) error {
	schema := `
	CREATE TABLE IF NOT EXISTS layers (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		type TEXT NOT NULL UNIQUE CHECK(type IN ('earthquake', 'wildfire', 'weather')),
		enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
		last_sync_at TEXT,
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ'))
	);

	CREATE TABLE IF NOT EXISTS events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		type TEXT NOT NULL CHECK(type IN ('earthquake', 'wildfire', 'weather')),
		external_id TEXT NOT NULL,
		source TEXT NOT NULL,
		updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ')),
		latitude REAL NOT NULL,
		longitude REAL NOT NULL,
		magnitude REAL,
		depth_km REAL,
		timestamp TEXT NOT NULL,
		metadata TEXT NOT NULL DEFAULT '{}',
		created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ')),
		UNIQUE(source, external_id)
	);

	CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
	CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
	CREATE INDEX IF NOT EXISTS idx_events_coordinates ON events(latitude, longitude);

	CREATE TABLE IF NOT EXISTS sync_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		layer_type TEXT NOT NULL,
		status TEXT NOT NULL CHECK(status IN ('success', 'error')),
		records_count INTEGER DEFAULT 0,
		error_message TEXT,
		started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ')),
		finished_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ'))
	);
	`

	_, err := db.Exec(schema)
	return err
}

// seed inserts default layer rows if they do not already exist.
func seed(db *sql.DB) error {
	_, err := db.Exec(`
		INSERT OR IGNORE INTO layers (type, enabled) VALUES ('earthquake', 1);
		INSERT OR IGNORE INTO layers (type, enabled) VALUES ('wildfire', 0);
		INSERT OR IGNORE INTO layers (type, enabled) VALUES ('weather', 0);
	`)
	if err != nil {
		return err
	}
	if os.Getenv("KOALA_DEV_SEED") == "true" {
		if err := seedDevData(db); err != nil {
			log.Printf("Dev seed warning: %v", err)
		}
	}
	return nil
}

func seedDevData(db *sql.DB) error {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM events").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	now := time.Now().UTC()
	events := []struct {
		extID     string
		lat, lon  float64
		mag       float64
		depth     float64
		timestamp time.Time
		place     string
	}{
		{"dev-eq-001", 35.68, 139.65, 5.5, 10.0, now.Add(-1 * time.Hour), "Test Tokyo"},
		{"dev-eq-002", 34.05, -118.24, 3.2, 5.0, now.Add(-2 * time.Hour), "Test Los Angeles"},
		{"dev-eq-003", -33.86, 151.21, 4.1, 8.0, now.Add(-3 * time.Hour), "Test Sydney"},
		{"dev-eq-004", 48.85, 2.35, 2.8, 3.0, now.Add(-4 * time.Hour), "Test Paris"},
		{"dev-eq-005", 19.43, -99.13, 6.2, 15.0, now.Add(-5 * time.Hour), "Test Mexico City"},
	}

	for _, e := range events {
		meta := map[string]string{"place": e.place}
		metaJSON, _ := json.Marshal(meta)
		_, err := db.Exec(`
			INSERT OR IGNORE INTO events (type, source, external_id, latitude, longitude, magnitude, depth_km, timestamp, metadata)
			VALUES ('earthquake', 'dev-seed', ?, ?, ?, ?, ?, ?, ?)
		`, e.extID, e.lat, e.lon, e.mag, e.depth, e.timestamp.Format(time.RFC3339), string(metaJSON))
		if err != nil {
			return err
		}
	}
	log.Printf("Dev seed: inserted %d sample events", len(events))
	return nil
}

// GetLayers returns all rows from the layers table.
func (db *DB) GetLayers() ([]Layer, error) {
	rows, err := db.Query("SELECT id, type, enabled, last_sync_at, created_at FROM layers ORDER BY type")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var layers []Layer
	for rows.Next() {
		var l Layer
		if err := rows.Scan(&l.ID, &l.Type, &l.Enabled, &l.LastSyncAt, &l.CreatedAt); err != nil {
			return nil, err
		}
		layers = append(layers, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if layers == nil {
		layers = []Layer{}
	}
	return layers, nil
}

// UpsertLayer inserts or updates a layer row identified by type.
func (db *DB) UpsertLayer(layerType string, enabled bool, lastSyncAt *string) error {
	_, err := db.Exec(`
		INSERT INTO layers (type, enabled, last_sync_at)
		VALUES (?, ?, ?)
		ON CONFLICT(type) DO UPDATE SET
			enabled = excluded.enabled,
			last_sync_at = excluded.last_sync_at
	`, layerType, enabled, lastSyncAt)
	return err
}

// BatchUpsertEvents performs multiple event upserts in a single transaction.
func (db *DB) BatchUpsertEvents(events []Event) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
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
			updated_at = strftime('%Y-%m-%dT%H:%M:%SZ')
	`)
	if err != nil {
		return fmt.Errorf("prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, e := range events {
		metadata := e.Metadata
		if metadata == nil {
			metadata = json.RawMessage("{}")
		}
		if _, err := stmt.Exec(e.Type, e.Source, e.ExternalID, e.Latitude, e.Longitude,
			e.Magnitude, e.DepthKm, e.Timestamp, string(metadata)); err != nil {
			return fmt.Errorf("upsert event %s: %w", e.ExternalID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}
	return nil
}

// UpsertEvent inserts or updates an event identified by (source, external_id).
func (db *DB) UpsertEvent(e Event) error {
	metadata := e.Metadata
	if metadata == nil {
		metadata = json.RawMessage("{}")
	}
	_, err := db.Exec(`
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
			updated_at = strftime('%Y-%m-%dT%H:%M:%SZ')
	`, e.Type, e.Source, e.ExternalID, e.Latitude, e.Longitude, e.Magnitude, e.DepthKm, e.Timestamp, string(metadata))
	return err
}

// GetEvents returns events matching the provided filters. All filter parameters
// are optional; empty/nil values are ignored.
//   - typeFilter: if non-empty, filters by event type.
//   - limit: max rows (0 uses default 1000, capped at 10000).
//   - from: ISO 8601 start timestamp (inclusive).
//   - to: ISO 8601 end timestamp (inclusive).
//   - bbox: [minLon, minLat, maxLon, maxLat] for spatial filtering.
//   - minMag: minimum magnitude (inclusive).
//   - maxMag: maximum magnitude (inclusive).
//   - searchQuery: if non-empty, filters by metadata LIKE pattern.
func (db *DB) GetEvents(typeFilter string, limit int, from, to string, bbox []float64, minMag, maxMag, searchQuery string) ([]Event, error) {
	query := "SELECT id, type, source, external_id, latitude, longitude, magnitude, depth_km, timestamp, metadata, updated_at, created_at FROM events"
	var conditions []string
	var args []interface{}

	if typeFilter != "" {
		conditions = append(conditions, "type = ?")
		args = append(args, typeFilter)
	}
	if from != "" {
		conditions = append(conditions, "timestamp >= ?")
		args = append(args, from)
	}
	if to != "" {
		conditions = append(conditions, "timestamp <= ?")
		args = append(args, to)
	}
	if len(bbox) == 4 {
		conditions = append(conditions, "latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?")
		args = append(args, bbox[1], bbox[3], bbox[0], bbox[2])
	}
	if minMag != "" {
		if v, err := strconv.ParseFloat(minMag, 64); err == nil {
			conditions = append(conditions, "magnitude >= ?")
			args = append(args, v)
		} else {
			log.Printf("Invalid min_mag value: %q", minMag)
		}
	}
	if maxMag != "" {
		if v, err := strconv.ParseFloat(maxMag, 64); err == nil {
			conditions = append(conditions, "magnitude <= ?")
			args = append(args, v)
		} else {
			log.Printf("Invalid max_mag value: %q", maxMag)
		}
	}

	if searchQuery != "" {
		conditions = append(conditions, "metadata LIKE ?")
		args = append(args, "%"+searchQuery+"%")
	}

	if len(conditions) > 0 {
		query += " WHERE "
		for i, c := range conditions {
			if i > 0 {
				query += " AND "
			}
			query += c
		}
	}

	query += " ORDER BY timestamp DESC"

	if limit <= 0 {
		limit = 1000
	} else if limit > 10000 {
		limit = 10000
	}
	query += fmt.Sprintf(" LIMIT %d", limit)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var e Event
		var metadataStr string
		if err := rows.Scan(&e.ID, &e.Type, &e.Source, &e.ExternalID, &e.Latitude, &e.Longitude,
			&e.Magnitude, &e.DepthKm, &e.Timestamp, &metadataStr, &e.UpdatedAt, &e.CreatedAt); err != nil {
			return nil, err
		}
		e.Metadata = json.RawMessage(metadataStr)
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if events == nil {
		events = []Event{}
	}
	return events, nil
}

// InsertSyncLog inserts a row into the sync_logs table.
func (db *DB) InsertSyncLog(layerType, status string, recordsCount int, errorMsg string) error {
	_, err := db.Exec(`
		INSERT INTO sync_logs (layer_type, status, records_count, error_message)
		VALUES (?, ?, ?, ?)
	`, layerType, status, recordsCount, errorMsg)
	return err
}

// SyncLog represents a row in the sync_logs table.
type SyncLog struct {
	ID           int    `json:"id"`
	LayerType    string `json:"layer_type"`
	Status       string `json:"status"`
	RecordsCount int    `json:"records_count"`
	ErrorMessage string `json:"error_message,omitempty"`
	StartedAt    string `json:"started_at"`
	FinishedAt   string `json:"finished_at"`
}

// GetSyncLogs returns the most recent sync log entries, ordered by id DESC.
func (db *DB) GetSyncLogs(limit int) ([]SyncLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	query := fmt.Sprintf("SELECT id, layer_type, status, records_count, COALESCE(error_message, ''), started_at, finished_at FROM sync_logs ORDER BY id DESC LIMIT %d", limit)
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []SyncLog
	for rows.Next() {
		var l SyncLog
		if err := rows.Scan(&l.ID, &l.LayerType, &l.Status, &l.RecordsCount, &l.ErrorMessage, &l.StartedAt, &l.FinishedAt); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if logs == nil {
		logs = []SyncLog{}
	}
	return logs, nil
}

// Close shuts down the database connection.
func (db *DB) Close() error {
	return db.DB.Close()
}
