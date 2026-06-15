package handlers

import (
	"koalaworld/internal/database"
	"net/http"
)

// ConfigHandler serves GET /api/config.
type ConfigHandler struct {
	DB *database.DB
}

func (h *ConfigHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	layers, err := h.DB.GetLayers()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch layers")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"layers": layers,
	})
}
