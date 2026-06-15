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

var firmsBaseURL = func() string {
	if v := os.Getenv("KOALA_FIRMS_URL"); v != "" {
		return v
	}
	return "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
}()

type WildfirePlugin struct {
	db     *database.DB
	apiKey string
	client *http.Client
}

func NewWildfirePlugin(db *database.DB) *WildfirePlugin {
	return &WildfirePlugin{
		db:     db,
		apiKey: os.Getenv("FIRMS_API_KEY"),
		client: &http.Client{Timeout: func() time.Duration {
				if v := os.Getenv("KOALA_HTTP_TIMEOUT"); v != "" {
					if d, err := time.ParseDuration(v); err == nil {
						return d
					}
				}
				return 30 * time.Second
			}()},
	}
}

func (p *WildfirePlugin) Name() string {
	return "wildfire"
}

func (p *WildfirePlugin) Type() EventType {
	return EventTypeWildfire
}

func (p *WildfirePlugin) Fetch(ctx context.Context) ([]EventRecord, error) {
	var events []EventRecord

	if p.apiKey != "" {
		url := fmt.Sprintf("%s/%s/MODIS_NRT/1/-180,-90,180,90", firmsBaseURL, p.apiKey)

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, fmt.Errorf("create request: %w", err)
		}

		resp, err := p.client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("http get: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, fmt.Errorf("FIRMS API error %d: %s", resp.StatusCode, string(body))
		}

		reader := csv.NewReader(resp.Body)
		records, err := reader.ReadAll()
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("parse csv: %w", err)
		}

		if len(records) >= 2 {
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
		} else {
			log.Printf("No wildfire records returned from FIRMS")
		}
	} else {
		log.Printf("FIRMS_API_KEY not set, will try EONET free fallback")
	}

	// If FIRMS returned no data (no key or no results), try EONET as free fallback
	if len(events) == 0 {
		eonetEvents, err := p.fetchEONET(ctx)
		if err != nil {
			log.Printf("EONET fallback error: %v", err)
		} else {
			events = eonetEvents
		}
	}

	return events, nil
}

type eonetResponse struct {
	Title  string       `json:"title"`
	Events []eonetEvent `json:"events"`
}

type eonetEvent struct {
	ID         string          `json:"id"`
	Title      string          `json:"title"`
	Categories []eonetCategory `json:"categories"`
	Geometries []eonetGeometry `json:"geometries"`
}

type eonetCategory struct {
	ID    int    `json:"id"`
	Title string `json:"title"`
}

type eonetGeometry struct {
	Date        string    `json:"date"`
	Type        string    `json:"type"`
	Coordinates []float64 `json:"coordinates"`
}

func (p *WildfirePlugin) fetchEONET(ctx context.Context) ([]EventRecord, error) {
	url := "https://eonet.gsfc.nasa.gov/api/v2.1/events?category=8&status=open"

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("eonet create request: %w", err)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("eonet http get: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("EONET API error %d: %s", resp.StatusCode, string(body))
	}

	var data eonetResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("eonet parse: %w", err)
	}

	var events []EventRecord
	now := time.Now().UTC().Format(time.RFC3339)

	for _, ev := range data.Events {
		if len(ev.Geometries) == 0 || len(ev.Geometries[0].Coordinates) < 2 {
			continue
		}

		geo := ev.Geometries[0]
		lon := geo.Coordinates[0]
		lat := geo.Coordinates[1]

		if lat < -90 || lat > 90 || lon < -180 || lon > 180 {
			continue
		}

		ts := geo.Date
		if ts == "" {
			ts = now
		}

		extID := fmt.Sprintf("EONET|%s|%s", ev.ID, ts)

		meta := map[string]interface{}{
			"title":      ev.Title,
			"source_url": fmt.Sprintf("https://eonet.gsfc.nasa.gov/view.php?id=%s", ev.ID),
			"confidence": "nominal",
			"satellite":  "EONET",
		}
		metaJSON, _ := json.Marshal(meta)

		events = append(events, EventRecord{
			ExternalID: extID,
			Source:     "NASA_EONET",
			Type:       EventTypeWildfire,
			Latitude:   lat,
			Longitude:  lon,
			Timestamp:  ts,
			Metadata:   string(metaJSON),
		})
	}

	log.Printf("Fetched %d wildfire records from NASA EONET (free fallback)", len(events))
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
