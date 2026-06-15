package plugin

import (
	"context"
	"os"
	"testing"
)

func TestWildfirePluginNoAPIKey(t *testing.T) {
	// Ensure FIRMS_API_KEY is not set
	os.Unsetenv("FIRMS_API_KEY")
	p := &WildfirePlugin{apiKey: ""}
	records, err := p.Fetch(context.Background())
	if err != nil {
		t.Fatalf("Fetch() error = %v", err)
	}
	if records != nil {
		t.Errorf("expected nil records when no API key, got %d", len(records))
	}
}

func TestWildfirePluginName(t *testing.T) {
	p := &WildfirePlugin{}
	if p.Name() != "wildfire" {
		t.Errorf("expected name wildfire, got %s", p.Name())
	}
}

func TestWildfirePluginType(t *testing.T) {
	p := &WildfirePlugin{}
	if p.Type() != EventTypeWildfire {
		t.Errorf("expected type wildfire, got %s", p.Type())
	}
}

func TestWildfirePluginNormalize(t *testing.T) {
	p := &WildfirePlugin{}
	_, ok := p.Normalize("anything")
	if ok {
		t.Error("Normalize() should always return false for wildfire")
	}
}
