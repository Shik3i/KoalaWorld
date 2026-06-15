package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"koalaworld/internal/database"
	"net/http"
	"os"
	"time"
)

type issPlugin struct {
	db     *database.DB
	client *http.Client
}

func NewISSPlugin(db *database.DB) *issPlugin {
	return &issPlugin{
		db: db,
		client: &http.Client{Timeout: func() time.Duration {
			if v := os.Getenv("KOALA_HTTP_TIMEOUT"); v != "" {
				if d, err := time.ParseDuration(v); err == nil {
					return d
				}
			}
			return 10 * time.Second
		}()},
	}
}

func (p *issPlugin) Name() string {
	return "iss"
}

func (p *issPlugin) Type() EventType {
	return EventTypeISS
}

type issPositionResponse struct {
	Message     string `json:"message"`
	ISSPosition struct {
		Latitude  string `json:"latitude"`
		Longitude string `json:"longitude"`
	} `json:"iss_position"`
	Timestamp int64 `json:"timestamp"`
}

func (p *issPlugin) Fetch(ctx context.Context) ([]EventRecord, error) {
	url := "http://api.open-notify.org/iss-now.json"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("iss create request: %w", err)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("iss http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ISS API error %d: %s", resp.StatusCode, string(body))
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("iss read body: %w", err)
	}

	var data issPositionResponse
	if err := json.Unmarshal(body, &data); err != nil {
		return p.fetchFallback(ctx)
	}

	if data.Message != "success" {
		return p.fetchFallback(ctx)
	}

	var lat, lon float64
	if _, err := fmt.Sscanf(data.ISSPosition.Latitude, "%f", &lat); err != nil {
		return p.fetchFallback(ctx)
	}
	if _, err := fmt.Sscanf(data.ISSPosition.Longitude, "%f", &lon); err != nil {
		return p.fetchFallback(ctx)
	}

	ts := time.Unix(data.Timestamp, 0).UTC().Format(time.RFC3339)

	meta := map[string]interface{}{
		"name":   "International Space Station",
		"source": "Open Notify",
	}
	metaJSON, _ := json.Marshal(meta)

	mag := 1.0

	return []EventRecord{{
		ExternalID: fmt.Sprintf("iss|%d", data.Timestamp),
		Source:     "Open_Notify",
		Type:       EventTypeISS,
		Latitude:   lat,
		Longitude:  lon,
		Magnitude:  &mag,
		Timestamp:  ts,
		Metadata:   string(metaJSON),
	}}, nil
}

type whereTheISSAtResponse struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Altitude  float64 `json:"altitude"`
	Velocity  float64 `json:"velocity"`
	Timestamp int64   `json:"timestamp"`
}

func (p *issPlugin) fetchFallback(ctx context.Context) ([]EventRecord, error) {
	url := "https://api.wheretheiss.at/v1/satellites/25544"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("iss fallback create request: %w", err)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("iss fallback http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("ISS fallback API error %d: %s", resp.StatusCode, string(body))
	}

	var data whereTheISSAtResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("iss fallback parse: %w", err)
	}

	ts := time.Unix(data.Timestamp, 0).UTC().Format(time.RFC3339)

	meta := map[string]interface{}{
		"name":     "International Space Station",
		"source":   "WhereTheISSAt",
		"altitude": data.Altitude,
		"velocity": data.Velocity,
	}
	metaJSON, _ := json.Marshal(meta)

	mag := 1.0

	return []EventRecord{{
		ExternalID: fmt.Sprintf("iss|%d", data.Timestamp),
		Source:     "WhereTheISSAt",
		Type:       EventTypeISS,
		Latitude:   data.Latitude,
		Longitude:  data.Longitude,
		Magnitude:  &mag,
		Timestamp:  ts,
		Metadata:   string(metaJSON),
	}}, nil
}

func (p *issPlugin) Normalize(record RawData) (EventRecord, bool) {
	return EventRecord{}, false
}

func (p *issPlugin) Upsert(records []EventRecord) error {
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
			Timestamp:  r.Timestamp,
			Metadata:   json.RawMessage(meta),
		})
	}
	return p.db.BatchUpsertEvents(events)
}
