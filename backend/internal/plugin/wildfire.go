package plugin

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"koalaworld/internal/database"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const firmsBaseURL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

type WildfirePlugin struct {
	db     *database.DB
	apiKey string
	client *http.Client
}

func NewWildfirePlugin(db *database.DB) *WildfirePlugin {
	return &WildfirePlugin{
		db:     db,
		apiKey: os.Getenv("FIRMS_API_KEY"),
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *WildfirePlugin) Name() string {
	return "wildfire"
}

func (p *WildfirePlugin) Type() EventType {
	return EventTypeWildfire
}

func (p *WildfirePlugin) Fetch(ctx context.Context) ([]EventRecord, error) {
	if p.apiKey == "" {
		log.Printf("FIRMS_API_KEY not set, skipping wildfire fetch")
		return nil, nil
	}

	url := fmt.Sprintf("%s/%s/MODIS_NRT/1/-180,-90,180,90", firmsBaseURL, p.apiKey)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("FIRMS API error %d: %s", resp.StatusCode, string(body))
	}

	reader := csv.NewReader(resp.Body)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("parse csv: %w", err)
	}

	if len(records) < 2 {
		log.Printf("No wildfire records returned")
		return nil, nil
	}

	header := records[0]
	colMap := make(map[string]int)
	for i, name := range header {
		colMap[strings.TrimSpace(name)] = i
	}

	latIdx, ok := colMap["latitude"]
	if !ok {
		return nil, fmt.Errorf("missing latitude column in FIRMS CSV")
	}
	lonIdx, ok := colMap["longitude"]
	if !ok {
		return nil, fmt.Errorf("missing longitude column in FIRMS CSV")
	}
	dateIdx, ok := colMap["acq_date"]
	if !ok {
		return nil, fmt.Errorf("missing acq_date column in FIRMS CSV")
	}
	timeIdx, ok := colMap["acq_time"]
	if !ok {
		return nil, fmt.Errorf("missing acq_time column in FIRMS CSV")
	}
	confIdx := colMap["confidence"]  // optional
	satIdx := colMap["satellite"]     // optional
	frpIdx := colMap["frp"]           // optional
	brightIdx := colMap["brightness"] // optional

	var events []EventRecord
	for _, row := range records[1:] {
		if len(row) < 7 {
			continue
		}

		lat, err := strconv.ParseFloat(strings.TrimSpace(row[latIdx]), 64)
		if err != nil || lat < -90 || lat > 90 {
			continue
		}
		lon, err := strconv.ParseFloat(strings.TrimSpace(row[lonIdx]), 64)
		if err != nil || lon < -180 || lon > 180 {
			continue
		}

		dateStr := strings.TrimSpace(row[dateIdx])
		timeStr := strings.TrimSpace(row[timeIdx])
		for len(timeStr) < 4 {
			timeStr = "0" + timeStr
		}
		ts := dateStr + "T" + timeStr[:2] + ":" + timeStr[2:] + ":00Z"

		confidence := strings.TrimSpace(row[confIdx])
		satellite := strings.TrimSpace(row[satIdx])

		var frp *float64
		if _, ok := colMap["frp"]; ok {
			if v, err := strconv.ParseFloat(strings.TrimSpace(row[frpIdx]), 64); err == nil {
				frp = &v
			}
		}

		var brightness *float64
		if v, err := strconv.ParseFloat(strings.TrimSpace(row[brightIdx]), 64); err == nil {
			brightness = &v
		}

		meta := map[string]interface{}{
			"confidence": confidence,
			"satellite":  satellite,
			"frp":        frp,
			"brightness": brightness,
		}
		metaJSON, err := json.Marshal(meta)
		if err != nil {
			log.Printf("Wildfire meta marshal error: %v", err)
			continue
		}

		events = append(events, EventRecord{
			ExternalID: fmt.Sprintf("%s|%s|%.4f|%.4f", satellite, dateStr, lat, lon),
			Source:     "NASA_FIRMS",
			Type:       EventTypeWildfire,
			Latitude:   lat,
			Longitude:  lon,
			Timestamp:  ts,
			Metadata:   string(metaJSON),
		})
	}

	log.Printf("Fetched %d wildfire records from NASA FIRMS", len(events))
	return events, nil
}

func (p *WildfirePlugin) Normalize(record RawData) (EventRecord, bool) {
	return EventRecord{}, false
}

func (p *WildfirePlugin) Upsert(records []EventRecord) error {
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
			Timestamp:  r.Timestamp,
			Metadata:   json.RawMessage(meta),
		})
	}
	return p.db.BatchUpsertEvents(events)
}
