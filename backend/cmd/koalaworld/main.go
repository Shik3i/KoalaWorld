package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"koalaworld/internal/database"
	"koalaworld/internal/handlers"
	"koalaworld/internal/middleware"
	"koalaworld/internal/plugin"
)

func main() {
	// Initialize database.
	dbPath := "data/koalaworld.db"
	db, err := database.Open(dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()
	log.Printf("Database opened at %s", dbPath)

	// Initialize feed scheduler and register plugins.
	sched := plugin.NewScheduler(db)
	sched.Register(plugin.NewEarthquakePlugin(db))
	sched.Register(plugin.NewWildfirePlugin(db))
	sched.Register(plugin.NewWeatherPlugin(db))
	sched.Start(context.Background())

	// Register handlers.
	configHandler := &handlers.ConfigHandler{DB: db}
	layersHandler := &handlers.LayersHandler{DB: db, SyncTrigger: sched.SyncLayers}
	eventsHandler := &handlers.EventsHandler{DB: db}

	mux := http.NewServeMux()

	// Health check.
	mux.HandleFunc("/api/healthz", healthzHandler)

	// Config.
	mux.Handle("/api/config", configHandler)

	// Layers.
	mux.HandleFunc("/api/layers", func(w http.ResponseWriter, r *http.Request) {
		layersHandler.GetLayers(w, r)
	})
	mux.HandleFunc("/api/layers/refresh", func(w http.ResponseWriter, r *http.Request) {
		layersHandler.RefreshLayers(w, r)
	})

	// Events.
	mux.Handle("/api/events", eventsHandler)
	mux.Handle("/api/events/", eventsHandler)

	// Static file server for built frontend assets.
	fs := http.FileServer(http.Dir("web"))
	mux.Handle("/", fs)

	// Apply middleware: outermost is Logging, then Timing.
	h := middleware.Logging(middleware.Timing(mux))

	port := "8080"
	srv := &http.Server{
		Addr:    ":" + port,
		Handler: h,
	}

	// Graceful shutdown.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("Starting server on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Could not listen on %s: %v\n", port, err)
		}
	}()

	<-stop

	log.Println("Shutting down server gracefully...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	sched.Stop()
	log.Println("Server exited gracefully")
}

func healthzHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"ok"}`))
}
