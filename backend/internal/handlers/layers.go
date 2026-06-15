package handlers

import (
	"encoding/json"
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
		json.NewDecoder(r.Body).Decode(&req)
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
