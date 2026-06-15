package plugin

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

// mockPlugin implements FeedPlugin for testing.
type mockPlugin struct {
	name          string
	fetchCount    int32
	failFetch     bool
	upsertCount   int32
	failUpsert    bool
	normalizeFail bool
}

func (m *mockPlugin) Name() string                                    { return m.name }
func (m *mockPlugin) Type() EventType                                 { return EventTypeEarthquake }
func (m *mockPlugin) Fetch(ctx context.Context) ([]EventRecord, error) {
	atomic.AddInt32(&m.fetchCount, 1)
	if m.failFetch {
		return nil, errors.New("fetch error")
	}
	return []EventRecord{{ExternalID: "test", Source: "test", Type: EventTypeEarthquake, Latitude: 0, Longitude: 0, Timestamp: "2024-01-01T00:00:00Z"}}, nil
}
func (m *mockPlugin) Normalize(record RawData) (EventRecord, bool) {
	if m.normalizeFail {
		return EventRecord{}, false
	}
	return EventRecord{}, true
}
func (m *mockPlugin) Upsert(records []EventRecord) error {
	atomic.AddInt32(&m.upsertCount, 1)
	if m.failUpsert {
		return errors.New("upsert error")
	}
	return nil
}

func TestRetrySync_Success(t *testing.T) {
	var count int32
	fn := func(ctx context.Context) error {
		atomic.AddInt32(&count, 1)
		return nil
	}
	err := retrySync(context.Background(), fn)
	if err != nil {
		t.Fatalf("retrySync() error = %v", err)
	}
	if count != 1 {
		t.Errorf("expected 1 call, got %d", count)
	}
}

func TestRetrySync_AllFail(t *testing.T) {
	var count int32
	fn := func(ctx context.Context) error {
		atomic.AddInt32(&count, 1)
		return errors.New("transient error")
	}
	err := retrySync(context.Background(), fn)
	if err == nil {
		t.Fatal("retrySync() expected error")
	}
	if count != maxRetries {
		t.Errorf("expected %d retries, got %d", maxRetries, count)
	}
}

func TestRetrySync_RetryThenSuccess(t *testing.T) {
	var count int32
	fn := func(ctx context.Context) error {
		atomic.AddInt32(&count, 1)
		if count < 3 {
			return errors.New("transient error")
		}
		return nil
	}
	err := retrySync(context.Background(), fn)
	if err != nil {
		t.Fatalf("retrySync() error = %v", err)
	}
	if count != 3 {
		t.Errorf("expected 3 calls (2 retries + success), got %d", count)
	}
}

func TestRetrySync_CancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	fn := func(ctx context.Context) error {
		return errors.New("error")
	}
	err := retrySync(ctx, fn)
	if err == nil {
		t.Fatal("retrySync() expected error for cancelled context")
	}
}

func TestMockPluginFetch(t *testing.T) {
	m := &mockPlugin{name: "test"}
	records, err := m.Fetch(context.Background())
	if err != nil {
		t.Fatalf("Fetch() error = %v", err)
	}
	if len(records) != 1 {
		t.Errorf("expected 1 record, got %d", len(records))
	}
	if m.Name() != "test" {
		t.Errorf("expected name test, got %s", m.Name())
	}
}

func TestMockPluginFetchFail(t *testing.T) {
	m := &mockPlugin{name: "test", failFetch: true}
	_, err := m.Fetch(context.Background())
	if err == nil {
		t.Fatal("expected error from failing fetch")
	}
}

func TestSyncInterval(t *testing.T) {
	m := &mockPlugin{name: "earthquake"}
	d := syncInterval(m)
	if d != 5*time.Minute {
		t.Errorf("expected 5m interval, got %v", d)
	}
}
