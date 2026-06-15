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

type AirQualityPlugin struct {
	db     *database.DB
	client *http.Client
}

func NewAirQualityPlugin(db *database.DB) *AirQualityPlugin {
	return &AirQualityPlugin{
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

func (p *AirQualityPlugin) Name() string {
	return "air_quality"
}

func (p *AirQualityPlugin) Type() EventType {
	return EventTypeAirQuality
}

type openMeteoAirResponse struct {
	Current struct {
		EuropeanAQI     *float64 `json:"european_aqi"`
		USAQI           *float64 `json:"us_aqi"`
		PM25            *float64 `json:"pm2_5"`
		PM10            *float64 `json:"pm10"`
		Ozone           *float64 `json:"ozone"`
		NitrogenDioxide *float64 `json:"nitrogen_dioxide"`
		CarbonMonoxide  *float64 `json:"carbon_monoxide"`
		SulphurDioxide  *float64 `json:"sulphur_dioxide"`
	} `json:"current"`
}

func (p *AirQualityPlugin) Fetch(ctx context.Context) ([]EventRecord, error) {
	var events []EventRecord
	now := time.Now().UTC().Format(time.RFC3339)

	for _, city := range worldCities {
		url := fmt.Sprintf(
			"https://air-quality-api.open-meteo.com/v1/air-quality?latitude=%.4f&longitude=%.4f&current=european_aqi,us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,carbon_monoxide,sulphur_dioxide",
			city.Lat, city.Lon,
		)

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			log.Printf("Air quality request error for %s: %v", city.Name, err)
			continue
		}

		resp, err := p.client.Do(req)
		if err != nil {
			log.Printf("Air quality fetch error for %s: %v", city.Name, err)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			log.Printf("Air quality API error for %s: %d %s", city.Name, resp.StatusCode, string(bodyBytes))
			continue
		}
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			log.Printf("Air quality read error for %s: %v", city.Name, err)
			continue
		}

		var data openMeteoAirResponse
		if err := json.Unmarshal(body, &data); err != nil {
			continue
		}

		meta := map[string]interface{}{
			"city":             city.Name,
			"european_aqi":     data.Current.EuropeanAQI,
			"us_aqi":           data.Current.USAQI,
			"pm2_5":            data.Current.PM25,
			"pm10":             data.Current.PM10,
			"ozone":            data.Current.Ozone,
			"nitrogen_dioxide": data.Current.NitrogenDioxide,
			"carbon_monoxide":  data.Current.CarbonMonoxide,
			"sulphur_dioxide":  data.Current.SulphurDioxide,
		}
		metaJSON, err := json.Marshal(meta)
		if err != nil {
			log.Printf("Air quality meta marshal error for %s: %v", city.Name, err)
			continue
		}

		var mag *float64
		if data.Current.EuropeanAQI != nil {
			mag = data.Current.EuropeanAQI
		} else if data.Current.USAQI != nil {
			mag = data.Current.USAQI
		}

		events = append(events, EventRecord{
			ExternalID: fmt.Sprintf("aq|%s|%s", city.Name, time.Now().UTC().Format("2006-01-02T15:00")),
			Source:     "Open-Meteo",
			Type:       EventTypeAirQuality,
			Latitude:   city.Lat,
			Longitude:  city.Lon,
			Magnitude:  mag,
			Timestamp:  now,
			Metadata:   string(metaJSON),
		})
	}

	log.Printf("Fetched %d air quality records from Open-Meteo", len(events))
	return events, nil
}

func (p *AirQualityPlugin) Normalize(record RawData) (EventRecord, bool) {
	return EventRecord{}, false
}

func (p *AirQualityPlugin) Upsert(records []EventRecord) error {
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
