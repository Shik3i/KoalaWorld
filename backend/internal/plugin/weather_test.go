package plugin

import "testing"

func TestWeatherPluginName(t *testing.T) {
	p := &WeatherPlugin{}
	if p.Name() != "weather" {
		t.Errorf("expected name weather, got %s", p.Name())
	}
}

func TestWeatherPluginType(t *testing.T) {
	p := &WeatherPlugin{}
	if p.Type() != EventTypeWeather {
		t.Errorf("expected type weather, got %s", p.Type())
	}
}

func TestWeatherPluginNormalize(t *testing.T) {
	p := &WeatherPlugin{}
	_, ok := p.Normalize("anything")
	if ok {
		t.Error("Normalize() should always return false for weather (CSV-based)")
	}
}

func TestWorldCitiesCount(t *testing.T) {
	if len(worldCities) != 30 {
		t.Errorf("expected 30 world cities, got %d", len(worldCities))
	}
}
