package plugin

import "context"

type EventType string

const (
	EventTypeEarthquake EventType = "earthquake"
	EventTypeWildfire   EventType = "wildfire"
	EventTypeWeather    EventType = "weather"
	EventTypeAirQuality EventType = "air_quality"
	EventTypeISS        EventType = "iss"
	EventTypeMarine     EventType = "marine"
)

type EventRecord struct {
	ExternalID string    `json:"external_id"`
	Source     string    `json:"source"`
	Type       EventType `json:"type"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	Magnitude  *float64  `json:"magnitude,omitempty"`
	DepthKm    *float64  `json:"depth_km,omitempty"`
	Timestamp  string    `json:"timestamp"`
	Metadata   string    `json:"metadata"`
}

type RawData = any

type FeedPlugin interface {
	Name() string
	Type() EventType
	Fetch(ctx context.Context) ([]EventRecord, error)
	Normalize(record RawData) (EventRecord, bool)
	Upsert(records []EventRecord) error
}
