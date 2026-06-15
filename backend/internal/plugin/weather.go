package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"koalaworld/internal/database"
	"log"
	"net/http"
	"time"
)

type weatherCity struct {
	Name string
	Lat  float64
	Lon  float64
}

var worldCities = []weatherCity{
	{"Tokyo", 35.6762, 139.6503},
	{"New York", 40.7128, -74.0060},
	{"London", 51.5074, -0.1278},
	{"Sydney", -33.8688, 151.2093},
	{"Beijing", 39.9042, 116.4074},
	{"Mumbai", 19.0760, 72.8777},
	{"Cairo", 30.0444, 31.2357},
	{"Moscow", 55.7558, 37.6173},
	{"Paris", 48.8566, 2.3522},
	{"Berlin", 52.5200, 13.4050},
	{"Bangkok", 13.7563, 100.5018},
	{"Lagos", 6.5244, 3.3792},
	{"Dubai", 25.2048, 55.2708},
	{"Singapore", 1.3521, 103.8198},
	{"Hong Kong", 22.3193, 114.1694},
	{"Istanbul", 41.0082, 28.9784},
	{"Seoul", 37.5665, 126.9780},
	{"Mexico City", 19.4326, -99.1332},
	{"São Paulo", -23.5505, -46.6333},
	{"Buenos Aires", -34.6037, -58.3816},
	{"Cape Town", -33.9249, 18.4241},
	{"Los Angeles", 34.0522, -118.2437},
	{"Chicago", 41.8781, -87.6298},
	{"Toronto", 43.6532, -79.3832},
	{"Delhi", 28.7041, 77.1025},
	{"Jakarta", -6.2088, 106.8456},
	{"Lima", -12.0464, -77.0428},
	{"Nairobi", -1.2921, 36.8219},
	{"Rome", 41.9028, 12.4964},
	{"Madrid", 40.4168, -3.7038},
}

type WeatherPlugin struct {
	db     *database.DB
	client *http.Client
}

func NewWeatherPlugin(db *database.DB) *WeatherPlugin {
	return &WeatherPlugin{
		db:     db,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *WeatherPlugin) Name() string {
	return "weather"
}

func (p *WeatherPlugin) Type() EventType {
	return EventTypeWeather
}

type openMeteoResponse struct {
	Current struct {
		Temperature2M      float64 `json:"temperature_2m"`
		RelativeHumidity2M float64 `json:"relative_humidity_2m"`
		ApparentTemp       float64 `json:"apparent_temperature"`
		Precipitation      float64 `json:"precipitation"`
		WeatherCode        int     `json:"weather_code"`
		WindSpeed10M       float64 `json:"wind_speed_10m"`
	} `json:"current"`
}

func (p *WeatherPlugin) Fetch(ctx context.Context) ([]EventRecord, error) {
	var events []EventRecord

	for _, city := range worldCities {
		url := fmt.Sprintf(
			"https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
			city.Lat, city.Lon,
		)

		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return nil, fmt.Errorf("create request: %w", err)
		}

		resp, err := p.client.Do(req)
		if err != nil {
			log.Printf("Weather fetch error for %s: %v", city.Name, err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			log.Printf("Weather read error for %s: %v", city.Name, err)
			continue
		}
		if resp.StatusCode != http.StatusOK {
			log.Printf("Weather API error for %s: %d", city.Name, resp.StatusCode)
			continue
		}

		var data openMeteoResponse
		if err := json.Unmarshal(body, &data); err != nil {
			continue
		}

		meta := map[string]interface{}{
			"city":                  city.Name,
			"temperature_2m":        data.Current.Temperature2M,
			"relative_humidity_2m":  data.Current.RelativeHumidity2M,
			"apparent_temperature":  data.Current.ApparentTemp,
			"precipitation":         data.Current.Precipitation,
			"weather_code":          data.Current.WeatherCode,
			"wind_speed_10m":        data.Current.WindSpeed10M,
		}
		metaJSON, err := json.Marshal(meta)
		if err != nil {
			log.Printf("Weather meta marshal error for %s: %v", city.Name, err)
			continue
		}
		mag := data.Current.Temperature2M

		events = append(events, EventRecord{
			ExternalID: fmt.Sprintf("weather|%s|%s", city.Name, time.Now().UTC().Format("2006-01-02T15:00")),
			Source:     "Open-Meteo",
			Type:       EventTypeWeather,
			Latitude:   city.Lat,
			Longitude:  city.Lon,
			Magnitude:  &mag,
			Timestamp:  time.Now().UTC().Format(time.RFC3339),
			Metadata:   string(metaJSON),
		})
	}

	log.Printf("Fetched %d weather records from Open-Meteo", len(events))
	return events, nil
}

func (p *WeatherPlugin) Normalize(record RawData) (EventRecord, bool) {
	return EventRecord{}, false
}

func (p *WeatherPlugin) Upsert(records []EventRecord) error {
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
