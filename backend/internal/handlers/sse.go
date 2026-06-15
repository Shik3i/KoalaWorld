package handlers

import (
	"fmt"
	"koalaworld/internal/database"
	"net/http"
	"sync"
)

// SSEBroker manages Server-Sent Event connections.
type SSEBroker struct {
	mu      sync.RWMutex
	clients map[chan database.Event]struct{}
}

func NewSSEBroker() *SSEBroker {
	return &SSEBroker{
		clients: make(map[chan database.Event]struct{}),
	}
}

// Subscribe adds a new client channel and returns it.
func (b *SSEBroker) Subscribe() chan database.Event {
	b.mu.Lock()
	defer b.mu.Unlock()
	ch := make(chan database.Event, 10)
	b.clients[ch] = struct{}{}
	return ch
}

// Unsubscribe removes a client channel.
func (b *SSEBroker) Unsubscribe(ch chan database.Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.clients, ch)
	close(ch)
}

// Publish sends an event to all connected clients.
func (b *SSEBroker) Publish(event database.Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for ch := range b.clients {
		select {
		case ch <- event:
		default:
			// Client too slow, skip
		}
	}
}

// ServeHTTP handles SSE connections.
func (b *SSEBroker) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	ch := b.Subscribe()
	defer b.Unsubscribe(ch)

	// Send initial keepalive
	fmt.Fprintf(w, ": keepalive\n\n")
	flusher.Flush()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-ch:
			if !ok {
				return
			}
			data, err := event.Metadata.MarshalJSON()
			if err != nil {
				data = []byte("{}")
			}
			// Build a minimal event JSON for SSE
			eventJSON := fmt.Sprintf(
				`{"id":%d,"type":"%s","source":"%s","latitude":%f,"longitude":%f,"magnitude":%v,"depth_km":%v,"timestamp":"%s","metadata":%s}`,
				event.ID, event.Type, event.Source, event.Latitude, event.Longitude,
				formatNullableFloat(event.Magnitude), formatNullableFloat(event.DepthKm),
				event.Timestamp, string(data),
			)
			fmt.Fprintf(w, "event: new_event\ndata: %s\n\n", eventJSON)
			flusher.Flush()
		}
	}
}

func formatNullableFloat(f *float64) string {
	if f == nil {
		return "null"
	}
	return fmt.Sprintf("%.2f", *f)
}
