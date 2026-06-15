package database

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestOpenAndMigrate(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer db.Close()
	defer os.Remove(dbPath)

	// Verify tables exist by querying them
	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM layers").Scan(&count)
	if err != nil {
		t.Fatalf("layers table query error = %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3 layers, got %d", count)
	}

	err = db.QueryRow("SELECT COUNT(*) FROM events").Scan(&count)
	if err != nil {
		t.Fatalf("events table query error = %v", err)
	}
}

func TestUpsertAndGetEvents(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer db.Close()
	defer os.Remove(dbPath)

	mag := 5.5
	evt := Event{
		Type:       "earthquake",
		Source:     "test",
		ExternalID: "evt001",
		Latitude:   35.0,
		Longitude:  135.0,
		Magnitude:  &mag,
		DepthKm:    nil,
		Timestamp:  "2024-01-15T06:30:00Z",
		Metadata:   json.RawMessage(`{"place":"Test"}`),
	}

	// Insert
	if err := db.UpsertEvent(evt); err != nil {
		t.Fatalf("UpsertEvent() error = %v", err)
	}

	// Read back
	events, err := db.GetEvents("earthquake", 10, "", "", nil, "", "", "")
	if err != nil {
		t.Fatalf("GetEvents() error = %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}
	if events[0].ExternalID != "evt001" {
		t.Errorf("expected ExternalID evt001, got %s", events[0].ExternalID)
	}
	if events[0].Source != "test" {
		t.Errorf("expected Source test, got %s", events[0].Source)
	}
	if events[0].Magnitude == nil || *events[0].Magnitude != 5.5 {
		t.Errorf("expected magnitude 5.5, got %v", events[0].Magnitude)
	}

	// Upsert (update same event)
	mag2 := 6.0
	evt.Magnitude = &mag2
	if err := db.UpsertEvent(evt); err != nil {
		t.Fatalf("UpsertEvent() update error = %v", err)
	}
	events, _ = db.GetEvents("earthquake", 10, "", "", nil, "", "", "")
	if len(events) != 1 {
		t.Fatalf("expected 1 event after upsert, got %d", len(events))
	}
	if *events[0].Magnitude != 6.0 {
		t.Errorf("expected updated magnitude 6.0, got %v", *events[0].Magnitude)
	}
}

func TestGetEventsFilters(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer db.Close()
	defer os.Remove(dbPath)

	// Insert test events
	mag1 := 3.0
	mag2 := 5.0
	mag3 := 7.0
	events := []Event{
		{Type: "earthquake", Source: "USGS", ExternalID: "e1", Latitude: 10, Longitude: 20, Magnitude: &mag1, Timestamp: "2024-01-01T00:00:00Z", Metadata: json.RawMessage("{}")},
		{Type: "earthquake", Source: "USGS", ExternalID: "e2", Latitude: 20, Longitude: 30, Magnitude: &mag2, Timestamp: "2024-06-15T00:00:00Z", Metadata: json.RawMessage("{}")},
		{Type: "earthquake", Source: "USGS", ExternalID: "e3", Latitude: 30, Longitude: 40, Magnitude: &mag3, Timestamp: "2024-12-31T00:00:00Z", Metadata: json.RawMessage("{}")},
		{Type: "wildfire", Source: "NASA", ExternalID: "f1", Latitude: 15, Longitude: 25, Timestamp: "2024-03-01T00:00:00Z", Metadata: json.RawMessage("{}")},
	}
	for _, e := range events {
		if err := db.UpsertEvent(e); err != nil {
			t.Fatalf("UpsertEvent() error = %v", err)
		}
	}

	// Test type filter
	eqs, _ := db.GetEvents("earthquake", 100, "", "", nil, "", "", "")
	if len(eqs) != 3 {
		t.Errorf("expected 3 earthquakes, got %d", len(eqs))
	}

	// Test limit
	limited, _ := db.GetEvents("", 2, "", "", nil, "", "", "")
	if len(limited) > 2 {
		t.Errorf("expected at most 2 events, got %d", len(limited))
	}

	// Test time range
	from := "2024-06-01T00:00:00Z"
	to := "2024-12-31T23:59:59Z"
	timeFiltered, _ := db.GetEvents("", 100, from, to, nil, "", "", "")
	if len(timeFiltered) != 2 {
		t.Errorf("expected 2 events in time range, got %d", len(timeFiltered))
	}

	// Test bbox
	bboxFiltered, _ := db.GetEvents("", 100, "", "", []float64{15, 5, 35, 25}, "", "", "")
	if len(bboxFiltered) != 3 {
		t.Errorf("expected 3 events in bbox, got %d", len(bboxFiltered))
	}

	// Test magnitude filter
	magFiltered, _ := db.GetEvents("earthquake", 100, "", "", nil, "4.0", "6.0", "")
	if len(magFiltered) != 1 {
		t.Errorf("expected 1 event with mag 4-6, got %d", len(magFiltered))
	}
}

func TestBatchUpsertEvents(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer db.Close()
	defer os.Remove(dbPath)

	mag1 := 4.0
	mag2 := 5.0
	events := []Event{
		{Type: "earthquake", Source: "USGS", ExternalID: "batch1", Latitude: 10, Longitude: 20, Magnitude: &mag1, Timestamp: "2024-01-01T00:00:00Z", Metadata: json.RawMessage("{}")},
		{Type: "earthquake", Source: "USGS", ExternalID: "batch2", Latitude: 30, Longitude: 40, Magnitude: &mag2, Timestamp: "2024-01-02T00:00:00Z", Metadata: json.RawMessage("{}")},
	}

	if err := db.BatchUpsertEvents(events); err != nil {
		t.Fatalf("BatchUpsertEvents() error = %v", err)
	}

	result, _ := db.GetEvents("earthquake", 100, "", "", nil, "", "", "")
	if len(result) != 2 {
		t.Errorf("expected 2 batched events, got %d", len(result))
	}
}

func TestGetLayers(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer db.Close()
	defer os.Remove(dbPath)

	layers, err := db.GetLayers()
	if err != nil {
		t.Fatalf("GetLayers() error = %v", err)
	}
	if len(layers) != 3 {
		t.Errorf("expected 3 layers, got %d", len(layers))
	}

	// Check earthquake is enabled, others are disabled
	for _, l := range layers {
		switch l.Type {
		case "earthquake":
			if !l.Enabled {
				t.Error("expected earthquake to be enabled")
			}
		case "wildfire", "weather":
			if l.Enabled {
				t.Errorf("expected %s to be disabled", l.Type)
			}
		}
	}
}

func TestUpsertLayer(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer db.Close()
	defer os.Remove(dbPath)

	sync := "2024-01-15T06:30:00Z"
	if err := db.UpsertLayer("earthquake", true, &sync); err != nil {
		t.Fatalf("UpsertLayer() error = %v", err)
	}

	layers, _ := db.GetLayers()
	for _, l := range layers {
		if l.Type == "earthquake" && l.LastSyncAt == nil {
			t.Error("expected last_sync_at to be set")
		}
	}
}

func TestNilMetadata(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	defer db.Close()
	defer os.Remove(dbPath)

	// UpsertEvent with nil metadata should not panic
	mag := 3.0
	evt := Event{
		Type:       "earthquake",
		Source:     "test",
		ExternalID: "nilmeta",
		Latitude:   0,
		Longitude:  0,
		Magnitude:  &mag,
		Timestamp:  "2024-01-01T00:00:00Z",
		Metadata:   nil,
	}
	if err := db.UpsertEvent(evt); err != nil {
		t.Fatalf("UpsertEvent() with nil metadata error = %v", err)
	}

	// BatchUpsertEvents with nil metadata should also work
	events := []Event{evt}
	if err := db.BatchUpsertEvents(events); err != nil {
		t.Fatalf("BatchUpsertEvents() with nil metadata error = %v", err)
	}
}
