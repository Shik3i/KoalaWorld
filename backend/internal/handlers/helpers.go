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
	json.NewEncoder(w).Encode(resp)
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
