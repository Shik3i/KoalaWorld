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
	"time"
)

var usgsURL = func() string {
	if v := os.Getenv("KOALA_USGS_URL"); v != "" {
		return v
	}
	return "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson"
}()

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
	db *database.DB
}

func NewEarthquakePlugin(db *database.DB) *EarthquakePlugin {
	return &EarthquakePlugin{db: db}
}

func (p *EarthquakePlugin) Name() string {
	return "earthquake"
}

func (p *EarthquakePlugin) Type() EventType {
	return EventTypeEarthquake
}

func (p *EarthquakePlugin) Fetch(ctx context.Context) ([]EventRecord, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, usgsURL, nil)
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
