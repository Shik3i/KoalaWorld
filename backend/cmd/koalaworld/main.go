package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"koalaworld/internal/database"
	"koalaworld/internal/handlers"
	"koalaworld/internal/middleware"
	"koalaworld/internal/plugin"
)

func main() {
	// Initialize database.
	dbPath := os.Getenv("KOALA_DB_PATH")
	if dbPath == "" {
		dbPath = "data/koalaworld.db"
	}
	db, err := database.Open(dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}
	defer db.Close()
	log.Printf("Database opened at %s", dbPath)

	// Initialize feed scheduler and register plugins.
	sched := plugin.NewScheduler(db)
	sseBroker := handlers.NewSSEBroker()
	sched.Broker = sseBroker
	sched.Register(plugin.NewEarthquakePlugin(db))
	sched.Register(plugin.NewWildfirePlugin(db))
	sched.Register(plugin.NewWeatherPlugin(db))
	sched.Start(context.Background())

	// Register handlers.
	configHandler := &handlers.ConfigHandler{DB: db}
	layersHandler := &handlers.LayersHandler{DB: db, SyncTrigger: sched.SyncLayers}
	eventsHandler := &handlers.EventsHandler{DB: db}

	healthzHandler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if err := db.Ping(); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{"status": "error", "data": "database unreachable"})
			return
		}
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "ok", "data": "healthy"})
	}

	mux := http.NewServeMux()

	// Health check.
	mux.HandleFunc("/api/healthz", healthzHandler)
	mux.HandleFunc("/api/v1/healthz", healthzHandler)

	// Config.
	mux.Handle("/api/config", configHandler)
	mux.Handle("/api/v1/config", configHandler)

	// Layers.
	mux.HandleFunc("/api/layers", func(w http.ResponseWriter, r *http.Request) {
		layersHandler.GetLayers(w, r)
	})
	mux.HandleFunc("/api/layers/refresh", func(w http.ResponseWriter, r *http.Request) {
		layersHandler.RefreshLayers(w, r)
	})
	mux.HandleFunc("/api/v1/layers", func(w http.ResponseWriter, r *http.Request) {
		layersHandler.GetLayers(w, r)
	})
	mux.HandleFunc("/api/v1/layers/refresh", func(w http.ResponseWriter, r *http.Request) {
		layersHandler.RefreshLayers(w, r)
	})

	// Layer management (PATCH)
	mux.HandleFunc("/api/layers/", func(w http.ResponseWriter, r *http.Request) {
		pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(pathParts) == 3 && pathParts[2] != "" && pathParts[2] != "refresh" {
			layersHandler.UpdateLayer(w, r)
		} else {
			http.NotFound(w, r)
		}
	})
	mux.HandleFunc("/api/v1/layers/", func(w http.ResponseWriter, r *http.Request) {
		pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
		if len(pathParts) == 4 && pathParts[3] != "" && pathParts[3] != "refresh" {
			layersHandler.UpdateLayer(w, r)
		} else {
			http.NotFound(w, r)
		}
	})

	// Events.
	mux.Handle("/api/events", eventsHandler)
	mux.Handle("/api/events/", eventsHandler)
	mux.Handle("/api/v1/events", eventsHandler)
	mux.Handle("/api/v1/events/", eventsHandler)

	// Admin sync logs.
	adminHandler := &handlers.AdminHandler{DB: db}
	mux.HandleFunc("/api/admin/logs", adminHandler.GetSyncLogs)
	mux.HandleFunc("/api/v1/admin/logs", adminHandler.GetSyncLogs)

	// SSE stream
	mux.Handle("/api/events/stream", sseBroker)
	mux.Handle("/api/v1/events/stream", sseBroker)

	// Static file server for built frontend assets.
	fs := http.FileServer(http.Dir("web"))
	mux.Handle("/", fs)

	// Apply middleware: outermost is Logging, then Timing.
	h := middleware.Logging(middleware.Timing(mux))

	port := os.Getenv("KOALA_PORT")
	if port == "" {
		port = "8080"
	}
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

