package middleware

import (
	"log"
	"net/http"
	"time"
)

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

// Logging logs the HTTP method, path, status code, and request duration.
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := newResponseWriter(w)
		next.ServeHTTP(rw, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, rw.statusCode, time.Since(start))
	})
}

// timingWriter wraps http.ResponseWriter to set the X-Response-Time header
// before the response is written.
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
