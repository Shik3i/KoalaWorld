# API Design — KoalaWorld MVP

This document defines all REST API endpoints for the KoalaWorld MVP, including request/response formats, content types, and implementation notes.

## General Conventions

- All endpoints return JSON with `Content-Type: application/json`.
- Responses follow a consistent envelope pattern for future extensibility: `{ "status": "ok" | "error", "data": <payload> }`.
- Timestamps use ISO 8601 format (`2024-01-01T00:00:00Z`).
- Coordinates are stored and returned as floating-point degrees (latitude, longitude).

## Authentication

No authentication is required for MVP. All endpoints are public. Rate limiting may be added later via Caddy middleware but is not part of MVP scope.

---

## Endpoint Reference

### GET /api/healthz

Simple health check endpoint. Returns a 200 OK response with no dependencies.

**Response:**
```json
{
  "status": "ok"
}
```

### GET /api/layers

Returns all available layers and their sync status.

**Response:**
```json
{
  "status": "ok",
  "data": [
    {"id": 1, "type": "earthquake", "enabled": true, "last_sync": "2024-01-15T06:30:00Z"},
    {"id": 2, "type": "wildfire", "enabled": false, "last_sync": null}
  ]
}
```

### GET /api/config

Returns the current configuration state including available layers and sync status.

**Response:**
```json
{
  "status": "ok",
  "data": {
    "layers": [
      {"type": "earthquake", "enabled": true, "last_sync": "2024-01-15T06:30:00Z"},
      {"type": "wildfire", "enabled": false, "last_sync": null}
    ]
  }
}
```

### POST /api/layers/refresh

Triggers a full feed sync across all enabled plugins. Non-blocking; returns immediately.

**Request:** (body optional)
```json
{"layers": ["earthquake", "wildfire"]}
```

**Response:**
```json
{
  "status": "ok",
  "data": {
    "sync_status": "running",
    "message": "Feed sync initiated for layers: earthquake, wildfire"
  }
}
```

### GET /api/events

Returns all events from SQLite, optionally filtered by type. Supports optional query parameters.

**Query Parameters:**
- `limit` (optional): Maximum number of results (default: 1000, max: 10000).
- `from` (optional): ISO 8601 timestamp; only return events after this time.
- `to` (optional): ISO 8601 timestamp; only return events before this time.
- `type` (optional): Filter by event type (`earthquake`, etc.). If omitted, returns all types.
- `bbox` (optional): Bounding box array: `[min_lon, min_lat, max_lon, max_lat]` for spatial filtering.

**Response:**
```json
{
  "status": "ok",
  "data": [
    {
      "id": 42,
      "type": "earthquake",
      "source": "USGS",
      "external_id": "us7000abcdef",
      "latitude": 35.6895,
      "longitude": 139.6917,
      "magnitude": 6.5,
      "depth_km": 30.0,
      "timestamp": "2024-01-15T06:30:00Z",
      "updated_at": "2024-01-15T06:30:00Z",
      "metadata": {"place": "Tokyo Bay"}
    }
  ]
}
```

### GET /api/events/earthquake

Returns earthquake events specifically. Equivalent to `GET /api/events?type=earthquake`.

**Response:** Same structure as `/api/events` response.

---

## Backend Implementation Notes

### Request Flow:
1. Go HTTP handler parses request (query parameters or JSON body).
2. Handler queries SQLite using raw SQL via `database/sql` package.
3. Results are mapped to response structs and returned as JSON via `handlers/helpers.go`.
4. Feed plugins run on a scheduler goroutine, not tied to request timing.

### Response Envelope:
Every endpoint returns the consistent envelope pattern. Error responses include a status field but embed error details in the data payload for clarity.

### Content Negotiation:
No content negotiation; all endpoints serve JSON only. No XML or protobuf support in MVP.
