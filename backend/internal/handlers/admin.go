package handlers

import (
	"koalaworld/internal/database"
	"net/http"
	"strconv"
)

type AdminHandler struct {
	DB *database.DB
}

func (h *AdminHandler) GetSyncLogs(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil && v > 0 {
			limit = v
		}
	}

	logs, err := h.DB.GetSyncLogs(limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to fetch sync logs")
		return
	}

	writeJSON(w, http.StatusOK, logs)
}
