package plugin

import (
	"encoding/json"
	"testing"
)

func TestEarthquakeNormalizeValid(t *testing.T) {
	p := &EarthquakePlugin{}
	feature := geoJSONFeature{
		Type: "Feature",
		ID:   "us7000abc",
		Geometry: geoJSONGeometry{
			Type:        "Point",
			Coordinates: []float64{139.6917, 35.6895, 30.0},
		},
		Properties: json.RawMessage(`{"mag":6.5,"time":1705312200000,"place":"Tokyo Bay","url":"https://example.com"}`),
	}

	record, ok := p.Normalize(feature)
	if !ok {
		t.Fatal("Normalize() returned false for valid input")
	}
	if record.ExternalID != "us7000abc" {
		t.Errorf("expected us7000abc, got %s", record.ExternalID)
	}
	if record.Latitude != 35.6895 {
		t.Errorf("expected 35.6895, got %f", record.Latitude)
	}
	if record.Longitude != 139.6917 {
		t.Errorf("expected 139.6917, got %f", record.Longitude)
	}
	if record.Magnitude == nil || *record.Magnitude != 6.5 {
		t.Errorf("expected magnitude 6.5, got %v", record.Magnitude)
	}
	if record.Source != "USGS" {
		t.Errorf("expected source USGS, got %s", record.Source)
	}
	if record.Type != EventTypeEarthquake {
		t.Errorf("expected type earthquake, got %s", record.Type)
	}
}

func TestEarthquakeNormalizeInvalidType(t *testing.T) {
	p := &EarthquakePlugin{}
	_, ok := p.Normalize("not a feature")
	if ok {
		t.Error("Normalize() should return false for non-feature input")
	}
}

func TestEarthquakeNormalizeShortCoords(t *testing.T) {
	p := &EarthquakePlugin{}
	feature := geoJSONFeature{
		Type: "Feature",
		ID:   "test",
		Geometry: geoJSONGeometry{
			Type:        "Point",
			Coordinates: []float64{139.0},
		},
		Properties: json.RawMessage(`{"mag":1.0,"time":1705312200000}`),
	}
	_, ok := p.Normalize(feature)
	if ok {
		t.Error("Normalize() should return false for short coordinates")
	}
}

func TestEarthquakeNormalizeInvalidLatLng(t *testing.T) {
	p := &EarthquakePlugin{}
	feature := geoJSONFeature{
		Type: "Feature",
		ID:   "test",
		Geometry: geoJSONGeometry{
			Type:        "Point",
			Coordinates: []float64{200, 100, 10},
		},
		Properties: json.RawMessage(`{"mag":1.0,"time":1705312200000}`),
	}
	_, ok := p.Normalize(feature)
	if ok {
		t.Error("Normalize() should return false for invalid coordinates")
	}
}

func TestEarthquakeNormalizeNaNMag(t *testing.T) {
	p := &EarthquakePlugin{}
	feature := geoJSONFeature{
		Type: "Feature",
		ID:   "test",
		Geometry: geoJSONGeometry{
			Type:        "Point",
			Coordinates: []float64{139.0, 35.0, 10},
		},
		Properties: json.RawMessage(`{"mag":null,"time":1705312200000}`),
	}
	record, ok := p.Normalize(feature)
	if !ok {
		t.Fatal("Normalize() should succeed with null magnitude")
	}
	if record.Magnitude != nil {
		t.Error("Magnitude should be nil for null mag")
	}
}
