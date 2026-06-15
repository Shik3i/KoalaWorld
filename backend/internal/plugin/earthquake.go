package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"koalaworld/internal/database"
	"log"
	"math"
	"net/http"
	"os"
	"sync"
	"time"
)

var httpClient = &http.Client{
	Timeout: func() time.Duration {
		if v := os.Getenv("KOALA_HTTP_TIMEOUT"); v != "" {
			if d, err := time.ParseDuration(v); err == nil {
				return d
			}
		}
		return 30 * time.Second
	}(),
}

type geoJSONFeatureCollection struct {
	Type     string           `json:"type"`
	Features []geoJSONFeature `json:"features"`
}

type geoJSONFeature struct {
	Type       string         `json:"type"`
	ID         string         `json:"id"`
	Geometry   geoJSONGeometry `json:"geometry"`
	Properties json.RawMessage `json:"properties"`
}

type geoJSONGeometry struct {
	Type        string    `json:"type"`
	Coordinates []float64 `json:"coordinates"`
}

type earthquakeMeta struct {
	Place    string   `json:"place,omitempty"`
	URL      string   `json:"url,omitempty"`
	Felt     *int     `json:"felt,omitempty"`
	CDI      *float64 `json:"cdi,omitempty"`
	MMI      *float64 `json:"mmi,omitempty"`
	Alert    string   `json:"alert,omitempty"`
	Status   string   `json:"status,omitempty"`
	Tsunami  int      `json:"tsunami,omitempty"`
	Sig      int      `json:"sig,omitempty"`
	Net      string   `json:"net,omitempty"`
	Code     string   `json:"code,omitempty"`
	MagType  string   `json:"magType,omitempty"`
	Title    string   `json:"title,omitempty"`
}

type EarthquakePlugin struct {
	db           *database.DB
	mu           sync.Mutex
	backfillDone bool
}

func NewEarthquakePlugin(db *database.DB) *EarthquakePlugin {
	return &EarthquakePlugin{db: db}
}

func fdsnURL(start, end time.Time) string {
	return fmt.Sprintf("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=%s&endtime=%s&minmagnitude=2.5&orderby=time",
		start.Format("2006-01-02T15:04:05"),
		end.Format("2006-01-02T15:04:05"))
}

func (p *EarthquakePlugin) Name() string {
	return "earthquake"
}

func (p *EarthquakePlugin) Type() EventType {
	return EventTypeEarthquake
}

func (p *EarthquakePlugin) Fetch(ctx context.Context) ([]EventRecord, error) {
	p.mu.Lock()
	if !p.backfillDone {
		count, err := p.db.CountEventsByType("earthquake")
		if err != nil {
			p.mu.Unlock()
			return nil, fmt.Errorf("count events: %w", err)
		}
		if count == 0 {
			p.mu.Unlock()
			log.Printf("Earthquake backfill: starting (0 events found)")
			if backfillRecords, err := p.Backfill(ctx); err != nil {
				log.Printf("Earthquake backfill error: %v", err)
			} else {
				if err := p.Upsert(backfillRecords); err != nil {
					log.Printf("Earthquake backfill upsert error: %v", err)
				} else {
					log.Printf("Earthquake backfill: upserted %d records", len(backfillRecords))
				}
			}
			p.mu.Lock()
		}
		p.backfillDone = true
	}
	p.mu.Unlock()

	now := time.Now().UTC()
	start := now.Add(-5 * time.Minute)

	if p.db != nil {
		latestTS, err := p.db.GetLatestEventTimestamp("earthquake")
		if err != nil {
			log.Printf("Earthquake: failed to read latest event timestamp: %v", err)
		} else if latestTS != nil {
			if t, err := time.Parse(time.RFC3339, *latestTS); err == nil {
				// Start 6 hours before our newest event to catch
				// retroactively reported events (API delays)
				start = t.Add(-6 * time.Hour)
				if now.Sub(start) > 7*24*time.Hour {
					start = now.Add(-5 * time.Minute)
				}
			}
		}
	}

	url := os.Getenv("KOALA_USGS_URL")
	if url == "" {
		url = fdsnURL(start, now)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	var fc geoJSONFeatureCollection
	if err := json.Unmarshal(body, &fc); err != nil {
		return nil, fmt.Errorf("parse geojson: %w", err)
	}

	if fc.Type != "FeatureCollection" {
		return nil, fmt.Errorf("unexpected geojson type: %s", fc.Type)
	}

	records := make([]EventRecord, 0, len(fc.Features))
	for _, f := range fc.Features {
		if record, ok := p.Normalize(f); ok {
			records = append(records, record)
		}
	}

	log.Printf("Fetched %d earthquake records from USGS", len(records))
	return records, nil
}

func (p *EarthquakePlugin) Backfill(ctx context.Context) ([]EventRecord, error) {
	now := time.Now().UTC()
	start := now.AddDate(0, 0, -90)

	url := fdsnURL(start, now)
	log.Printf("Earthquake backfill: fetching 90 days of M2.5+ data from %s to %s", start.Format("2006-01-02"), now.Format("2006-01-02"))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("backfill create request: %w", err)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("backfill http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("backfill unexpected status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("backfill read body: %w", err)
	}

	var fc geoJSONFeatureCollection
	if err := json.Unmarshal(body, &fc); err != nil {
		return nil, fmt.Errorf("backfill parse geojson: %w", err)
	}

	if fc.Type != "FeatureCollection" {
		return nil, fmt.Errorf("backfill unexpected geojson type: %s", fc.Type)
	}

	records := make([]EventRecord, 0, len(fc.Features))
	for _, f := range fc.Features {
		if record, ok := p.Normalize(f); ok {
			records = append(records, record)
		}
	}

	log.Printf("Earthquake backfill: parsed %d records from %d features", len(records), len(fc.Features))
	return records, nil
}

func (p *EarthquakePlugin) Normalize(record RawData) (EventRecord, bool) {
	feat, ok := record.(geoJSONFeature)
	if !ok {
		return EventRecord{}, false
	}

	if len(feat.Geometry.Coordinates) < 3 {
		return EventRecord{}, false
	}

	lat := feat.Geometry.Coordinates[1]
	lon := feat.Geometry.Coordinates[0]

	if lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		return EventRecord{}, false
	}

	depth := feat.Geometry.Coordinates[2]

	var props struct {
		Mag     *float64 `json:"mag"`
		Time    float64  `json:"time"`
		Place   string   `json:"place"`
		URL     string   `json:"url"`
		Felt    *int     `json:"felt"`
		CDI     *float64 `json:"cdi"`
		MMI     *float64 `json:"mmi"`
		Alert   string   `json:"alert"`
		Status  string   `json:"status"`
		Tsunami int      `json:"tsunami"`
		Sig     int      `json:"sig"`
		Net     string   `json:"net"`
		Code    string   `json:"code"`
		MagType string   `json:"magType"`
		Title   string   `json:"title"`
	}

	if err := json.Unmarshal(feat.Properties, &props); err != nil {
		return EventRecord{}, false
	}

	ts := time.UnixMilli(int64(props.Time)).UTC().Format(time.RFC3339)

	var mag *float64
	if props.Mag != nil && !math.IsNaN(*props.Mag) {
		mag = props.Mag
	}

	var depthKm *float64
	if depth != 0 {
		depthKm = &depth
	}

	meta := earthquakeMeta{
		Place:   props.Place,
		URL:     props.URL,
		Felt:    props.Felt,
		CDI:     props.CDI,
		MMI:     props.MMI,
		Alert:   props.Alert,
		Status:  props.Status,
		Tsunami: props.Tsunami,
		Sig:     props.Sig,
		Net:     props.Net,
		Code:    props.Code,
		MagType: props.MagType,
		Title:   props.Title,
	}

	metaJSON, err := json.Marshal(meta)
	if err != nil {
		return EventRecord{}, false
	}

	return EventRecord{
		ExternalID: feat.ID,
		Source:     "USGS",
		Type:       EventTypeEarthquake,
		Latitude:   lat,
		Longitude:  lon,
		Magnitude:  mag,
		DepthKm:    depthKm,
		Timestamp:  ts,
		Metadata:   string(metaJSON),
	}, true
}

func (p *EarthquakePlugin) Upsert(records []EventRecord) error {
	events := make([]database.Event, 0, len(records))
	for _, r := range records {
		meta := r.Metadata
		if meta == "" {
			meta = "{}"
		}
		events = append(events, database.Event{
			Type:       string(r.Type),
			Source:     r.Source,
			ExternalID: r.ExternalID,
			Latitude:   r.Latitude,
			Longitude:  r.Longitude,
			Magnitude:  r.Magnitude,
			DepthKm:    r.DepthKm,
			Timestamp:  r.Timestamp,
			Metadata:   json.RawMessage(meta),
		})
	}
	return p.db.BatchUpsertEvents(events)
}
