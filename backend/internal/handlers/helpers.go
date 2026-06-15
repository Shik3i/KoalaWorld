package handlers

import (
	"encoding/json"
	"net/http"
)

// writeJSON sends a success envelope with the given status code and data.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	resp := map[string]interface{}{
		"status": "ok",
		"data":   data,
	}
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}

// writeJSONWithTotal sends a success envelope with data and a total count.
func writeJSONWithTotal(w http.ResponseWriter, status int, data interface{}, total int) {
	w.Header().Set("Content-Type", "application/json")
	resp := map[string]interface{}{
		"status": "ok",
		"data":   data,
		"total":  total,
	}
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(resp); err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}
}

// writeError sends an error envelope with the given status code and message.
func writeError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	resp := map[string]interface{}{
		"status": "error",
		"data":   message,
	}
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(resp)
}
