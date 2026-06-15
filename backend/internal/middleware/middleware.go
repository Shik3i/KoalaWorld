package middleware

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"
)

type logEntry struct {
	Timestamp  string `json:"timestamp"`
	Level      string `json:"level"`
	Method     string `json:"method"`
	Path       string `json:"path"`
	StatusCode int    `json:"status_code"`
	Duration   string `json:"duration"`
}

var logger = log.New(os.Stdout, "", 0)

func logJSON(entry logEntry) {
	entry.Timestamp = time.Now().UTC().Format(time.RFC3339)
	b, _ := json.Marshal(entry)
	logger.Println(string(b))
}

// responseWriter wraps http.ResponseWriter to capture the status code.
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func newResponseWriter(w http.ResponseWriter) *responseWriter {
	return &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Logging logs the HTTP method, path, status code, and request duration as JSON.
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := newResponseWriter(w)
		next.ServeHTTP(rw, r)
		logJSON(logEntry{
			Level:      "info",
			Method:     r.Method,
			Path:       r.URL.Path,
			StatusCode: rw.statusCode,
			Duration:   time.Since(start).String(),
		})
	})
}

// timingWriter wraps http.ResponseWriter to set the X-Response-Time header.
type timingWriter struct {
	http.ResponseWriter
	start time.Time
}

func (tw *timingWriter) WriteHeader(code int) {
	tw.Header().Set("X-Response-Time", time.Since(tw.start).String())
	tw.ResponseWriter.WriteHeader(code)
}

func (tw *timingWriter) Write(b []byte) (int, error) {
	if tw.Header().Get("X-Response-Time") == "" {
		tw.Header().Set("X-Response-Time", time.Since(tw.start).String())
	}
	return tw.ResponseWriter.Write(b)
}

// Timing sets the X-Response-Time header on every response.
func Timing(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tw := &timingWriter{ResponseWriter: w, start: time.Now()}
		next.ServeHTTP(tw, r)
	})
}

// RateLimit limits requests to maxRequests per second per client IP.
// Uses a simple token-bucket approach with a map and mutex.
type RateLimit struct {
	mu          sync.Mutex
	visitors    map[string]*visitor
	maxRequests int
	window      time.Duration
}

type visitor struct {
	tokens    int
	lastReset time.Time
}

func NewRateLimit(maxRequests int, window time.Duration) *RateLimit {
	return &RateLimit{
		visitors:    make(map[string]*visitor),
		maxRequests: maxRequests,
		window:      window,
	}
}

func (rl *RateLimit) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		rl.mu.Lock()
		v, exists := rl.visitors[ip]
		now := time.Now()
		if !exists || now.Sub(v.lastReset) > rl.window {
			v = &visitor{tokens: rl.maxRequests, lastReset: now}
			rl.visitors[ip] = v
		}
		if v.tokens <= 0 {
			rl.mu.Unlock()
			http.Error(w, `{"status":"error","data":"rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}
		v.tokens--
		rl.mu.Unlock()
		next.ServeHTTP(w, r)
	})
}
