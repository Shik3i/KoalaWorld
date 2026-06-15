package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"koalaworld/internal/database"
	"log"
	"net/http"
	"os"
	"time"
)

type MarinePlugin struct {
	db     *database.DB
	client *http.Client
}

func NewMarinePlugin(db *database.DB) *MarinePlugin {
	return &MarinePlugin{
		db: db,
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

func (p *MarinePlugin) Name() string {
	return "marine"
}

func (p *MarinePlugin) Type() EventType {
	return EventTypeMarine
}

type openMeteoMarineResponse struct {
	Current struct {
		WaveHeight         float64 `json:"wave_height"`
		WaveDirection      float64 `json:"wave_direction"`
		WavePeriod         float64 `json:"wave_period"`
		SwellWaveHeight    float64 `json:"swell_wave_height"`
		SwellWaveDirection float64 `json:"swell_wave_direction"`
		SwellWavePeriod    float64 `json:"swell_wave_period"`
		CurrentVelocity    float64 `json:"ocean_current_velocity"`
		SeaSurfaceTemp     float64 `json:"sea_surface_temperature"`
	} `json:"current"`
}

func (p *MarinePlugin) Fetch(ctx context.Context) ([]EventRecord, error) {
	var events []EventRecord
	now := time.Now().UTC().Format(time.RFC3339)

	for _, city := range worldCities {
		url := fmt.Sprintf(
			"https://marine-api.open-meteo.com/v1/marine?latitude=%.4f&longitude=%.4f&current=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,ocean_current_velocity,sea_surface_temperature",
			city.Lat, city.Lon,
		)

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			continue
		}

		resp, err := p.client.Do(req)
		if err != nil {
			continue
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			continue
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}

		var data openMeteoMarineResponse
		if err := json.Unmarshal(body, &data); err != nil {
			continue
		}

		meta := map[string]interface{}{
			"city":                     city.Name,
			"wave_height":             data.Current.WaveHeight,
			"wave_direction":          data.Current.WaveDirection,
			"wave_period":             data.Current.WavePeriod,
			"swell_wave_height":       data.Current.SwellWaveHeight,
			"swell_wave_direction":    data.Current.SwellWaveDirection,
			"swell_wave_period":       data.Current.SwellWavePeriod,
			"ocean_current_velocity":  data.Current.CurrentVelocity,
			"sea_surface_temperature": data.Current.SeaSurfaceTemp,
		}
		metaJSON, _ := json.Marshal(meta)

		mag := data.Current.WaveHeight

		events = append(events, EventRecord{
			ExternalID: fmt.Sprintf("marine|%s|%s", city.Name, time.Now().UTC().Format("2006-01-02T15:00")),
			Source:     "Open-Meteo",
			Type:       EventTypeMarine,
			Latitude:   city.Lat,
			Longitude:  city.Lon,
			Magnitude:  &mag,
			Timestamp:  now,
			Metadata:   string(metaJSON),
		})
	}

	log.Printf("Fetched %d marine records from Open-Meteo", len(events))
	return events, nil
}

func (p *MarinePlugin) Normalize(record RawData) (EventRecord, bool) {
	return EventRecord{}, false
}

func (p *MarinePlugin) Upsert(records []EventRecord) error {
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
