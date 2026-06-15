package plugin

import (
	"context"
	"fmt"
	"koalaworld/internal/database"
	"log"
	"math"
	"math/rand"
	"sync"
	"time"
)

type Scheduler struct {
	db      *database.DB
	plugins []FeedPlugin
	cancel  context.CancelFunc
	wg      sync.WaitGroup
	mu      sync.Mutex
}

func NewScheduler(db *database.DB) *Scheduler {
	return &Scheduler{db: db}
}

func (s *Scheduler) Register(plugin FeedPlugin) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.plugins = append(s.plugins, plugin)
}

func (s *Scheduler) Start(ctx context.Context) {
	ctx, s.cancel = context.WithCancel(ctx)

	s.mu.Lock()
	plugins := make([]FeedPlugin, len(s.plugins))
	copy(plugins, s.plugins)
	s.mu.Unlock()

	for _, p := range plugins {
		s.wg.Add(1)
		go func(plugin FeedPlugin) {
			defer s.wg.Done()
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Panic recovered in %s sync: %v", plugin.Name(), r)
				}
			}()

			interval := syncInterval(plugin)
			ticker := time.NewTicker(interval)
			defer ticker.Stop()

			if err := s.syncOne(ctx, plugin); err != nil {
				log.Printf("Initial sync error [%s]: %v", plugin.Name(), err)
			}

			for {
				select {
				case <-ticker.C:
					if err := s.syncOne(ctx, plugin); err != nil {
						log.Printf("Sync error [%s]: %v", plugin.Name(), err)
					}
				case <-ctx.Done():
					return
				}
			}
		}(p)
	}
}

func (s *Scheduler) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
	s.wg.Wait()
}

func (s *Scheduler) SyncAll() {
	s.mu.Lock()
	plugins := make([]FeedPlugin, len(s.plugins))
	copy(plugins, s.plugins)
	s.mu.Unlock()

	for _, p := range plugins {
		p := p
		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("Panic recovered in %s sync: %v", p.Name(), r)
				}
			}()
			if err := s.syncOne(context.Background(), p); err != nil {
				log.Printf("Sync error [%s]: %v", p.Name(), err)
			}
		}()
	}
}

func (s *Scheduler) SyncLayers(layerTypes []string) {
	s.mu.Lock()
	plugins := make([]FeedPlugin, len(s.plugins))
	copy(plugins, s.plugins)
	s.mu.Unlock()

	for _, lt := range layerTypes {
		for _, p := range plugins {
			if string(p.Type()) == lt || p.Name() == lt {
				p := p
				go func() {
					defer func() {
						if r := recover(); r != nil {
							log.Printf("Panic recovered in %s sync: %v", p.Name(), r)
						}
					}()
					if err := s.syncOne(context.Background(), p); err != nil {
						log.Printf("Sync error [%s]: %v", p.Name(), err)
					}
				}()
			}
		}
	}
}

const maxRetries = 3

func retrySync(ctx context.Context, fn func(context.Context) error) error {
	var err error
	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(math.Pow(2, float64(attempt-1))) * time.Second
			jitter := time.Duration(rand.Int63n(int64(backoff) / 2))
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff + jitter):
			}
		}
		err = fn(ctx)
		if err == nil {
			return nil
		}
		log.Printf("Retry attempt %d/%d after error: %v", attempt+1, maxRetries, err)
	}
	return fmt.Errorf("all %d retries failed: %w", maxRetries, err)
}

func (s *Scheduler) syncOne(ctx context.Context, plugin FeedPlugin) error {
	var records []EventRecord
	err := retrySync(ctx, func(ctx context.Context) error {
		var err error
		records, err = plugin.Fetch(ctx)
		return err
	})
	if err != nil {
		return fmt.Errorf("fetch after retries: %w", err)
	}

	if len(records) == 0 {
		return nil
	}

	if err := plugin.Upsert(records); err != nil {
		return fmt.Errorf("upsert: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if err := s.db.UpsertLayer(string(plugin.Type()), true, &now); err != nil {
		log.Printf("Failed to update sync time for %s: %v", plugin.Name(), err)
	}

	log.Printf("Synced %d records for %s", len(records), plugin.Name())
	return nil
}

func syncInterval(plugin FeedPlugin) time.Duration {
	switch plugin.Type() {
	case EventTypeEarthquake:
		return 5 * time.Minute
	default:
		return 5 * time.Minute
	}
}
