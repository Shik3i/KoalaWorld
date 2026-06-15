package plugin

import (
	"testing"
)

func TestPluginInterfaceCompliance(t *testing.T) {
	// Compile-time checks that all plugins implement FeedPlugin
	var _ FeedPlugin = (*EarthquakePlugin)(nil)
	var _ FeedPlugin = (*WildfirePlugin)(nil)
	var _ FeedPlugin = (*WeatherPlugin)(nil)
	_ = t
}
