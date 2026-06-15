package handlers

import (
	"koalaworld/internal/database"
	"net/http"
	"strconv"
	"strings"
)

// EventsHandler serves GET /api/events and GET /api/events/{type}.
type EventsHandler struct {
	DB *database.DB
}

func (h *EventsHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Extract optional type from path: /api/events/{type}
	// Supports both /api/events/{type} and /api/v1/events/{type}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	var typeFilter string
	lastPart := pathParts[len(pathParts)-1]
	// The last part is the type if it's not "events" (meaning the path ends with /events)
	if lastPart != "" && lastPart != "events" {
		typeFilter = lastPart
	} else {
		typeFilter = r.URL.Query().Get("type")
	}

	// Parse limit
	limitStr := r.URL.Query().Get("limit")
	limit := 1000
	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil && v > 0 {
			limit = v
		}
	}

	from := r.URL.Query().Get("from")
	to := r.URL.Query().Get("to")
	minMag := r.URL.Query().Get("min_mag")
	maxMag := r.URL.Query().Get("max_mag")

	if minMag != "" {
		if _, err := strconv.ParseFloat(minMag, 64); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid min_mag value")
			return
		}
	}
	if maxMag != "" {
		if _, err := strconv.ParseFloat(maxMag, 64); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid max_mag value")
			return
		}
	}

	searchQuery := r.URL.Query().Get("q")

	// Parse bbox
	var bbox []float64
	bboxStr := r.URL.Query().Get("bbox")
	if bboxStr != "" {
		parts := strings.Split(bboxStr, ",")
		if len(parts) == 4 {
			bbox = make([]float64, 0, 4)
			valid := true
			for _, p := range parts {
				v, err := strconv.ParseFloat(strings.TrimSpace(p), 64)
				if err != nil {
					valid = false
					break
				}
				bbox = append(bbox, v)
			}
			if !valid {
				writeError(w, http.StatusBadRequest, "Invalid bbox format; expected min_lon,min_lat,max_lon,max_lat")
				return
			}
		} else {
			writeError(w, http.StatusBadRequest, "Invalid bbox format; expected min_lon,min_lat,max_lon,max_lat")
			return
		}
	}

	events, err := h.DB.GetEvents(typeFilter, limit, from, to, bbox, minMag, maxMag, searchQuery)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch events")
		return
	}

	writeJSON(w, http.StatusOK, events)
}
