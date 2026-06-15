package handlers

import (
	"encoding/json"
	"fmt"
	"koalaworld/internal/database"
	"net/http"
	"strings"
)

// LayersHandler serves GET /api/layers and POST /api/layers/refresh.
type LayersHandler struct {
	DB          *database.DB
	SyncTrigger func(layers []string)
}

func (h *LayersHandler) GetLayers(w http.ResponseWriter, r *http.Request) {
	layers, err := h.DB.GetLayers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch layers")
		return
	}

	writeJSON(w, http.StatusOK, layers)
}

func (h *LayersHandler) RefreshLayers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Layers []string `json:"layers"`
	}

	// Body is optional; parse errors are ignored (default to empty).
	if r.Body != nil {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "Invalid JSON body")
			return
		}
	}

	layerNames := req.Layers
	if len(layerNames) == 0 {
		// Default to all enabled layers.
		allLayers, err := h.DB.GetLayers()
		if err == nil {
			for _, l := range allLayers {
				layerNames = append(layerNames, l.Type)
			}
		}
	}

	message := "Feed sync initiated for layers: " + strings.Join(layerNames, ", ")
	if len(layerNames) == 0 {
		message = "Feed sync initiated — no layers specified"
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"sync_status": "running",
		"message":     message,
	})

	if h.SyncTrigger != nil {
		go h.SyncTrigger(layerNames)
	}
}

func (h *LayersHandler) UpdateLayer(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Extract layer type from path: /api/v1/layers/{type}
	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	var layerType string
	if len(pathParts) >= 3 && pathParts[2] != "" {
		// v1 route: api/v1/layers/{type} → parts = ["api", "v1", "layers", "{type}"] (len=4)
		// old route: api/layers/{type} → parts = ["api", "layers", "{type}"] (len=3)
		if pathParts[1] == "v1" && len(pathParts) >= 4 {
			layerType = pathParts[3]
		} else if pathParts[1] != "v1" && len(pathParts) >= 3 {
			layerType = pathParts[2]
		}
	}

	if layerType == "" {
		writeError(w, http.StatusBadRequest, "Missing layer type in path")
		return
	}

	var req struct {
		Enabled *bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid JSON body")
		return
	}
	if req.Enabled == nil {
		writeError(w, http.StatusBadRequest, "Missing 'enabled' field")
		return
	}

	if err := h.DB.UpsertLayer(layerType, *req.Enabled, nil); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update layer")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"type":    layerType,
		"enabled": fmt.Sprintf("%t", *req.Enabled),
	})
}
