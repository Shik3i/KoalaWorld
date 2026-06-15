# Layer Architecture — KoalaWorld MVP

This document defines the layered architecture of KoalaWorld's MVP implementation. Each layer has distinct responsibilities and interacts with adjacent layers through well-defined interfaces.

## 1. Architecture Overview

```
┌─────────────────────┐
│       Frontend       │   ← Three.js + Vite (browser-side)
│         Layer        │
├─────────────────────┤
│     API Gateway      │   ← Go HTTP handlers & middleware
│         Layer        │
├─────────────────────┤
│    Feed Processors   │   ← External data sources, plugins & adapters
│                        │
├─────────────────────┤
│       Database       │   ← SQLite (schema + queries)
│         Layer        │
└─────────────────────┘
```

Each layer is independent and decoupled. Layers communicate via function calls or HTTP endpoints, never directly accessing other layers' internal state.

## 2. Frontend Layer (Vite + TypeScript + Three.js)

The frontend runs in the browser and has no direct database access. It communicates exclusively with the Go backend through REST APIs.

### Responsibilities:
- Render an interactive globe using Three.js (sphere geometry, textures, lighting).
- Display layered geospatial markers from API responses (e.g., earthquake points on globe surface).
- Manage camera controls (OrbitControls for rotation/zoom).
- Handle user interactions (layer toggles, marker selection).

### Globe Geometry Source:
- **Base globe layer:** Three.js sphere geometry with Earth texture.
- **Country border layer:** Natural Earth outlines used for political boundaries.
- **Grid layer:** A projection grid displayed over the globe (e.g., latitude/longitude lines).
- **Earthquake event layer:** Geospatial markers rendered at earthquake locations from API responses.

### Frontend Structure:
```
src/
├── main.ts            # Entry point; bootstraps Three.js scene
├── globe.ts           # Globe creation & rendering logic
├── layers/
│   ├── country_borders.ts # Natural Earth outlines
│   ├── grid_layer.ts      # Coordinate grid layer
│   └── earthquake.ts      # Earthquake event layer (marker generation from API data)
├── api.ts             # HTTP client wrappers for backend endpoints
└── types.ts           # Shared TypeScript type definitions
```

## 3. API Gateway Layer (Go HTTP Handlers)

The Go backend exposes a REST API with defined endpoints. Each endpoint corresponds to a specific resource or layer capability.

### Endpoint Design:

| Method | Path               | Description                          |
|--------|---------------------|---------------------------------------|
| GET    | /api/layers         | List available layers                 |
| POST   | /api/layers/refresh | Trigger feed sync for all layers      |
| GET    | /api/events         | Return aggregated event data        |
| GET    | /api/events/:type   | Return events filtered by type        |
| GET    | /api/config         | Return current layer configuration    |

### Implementation Details:
- Use Go's `net/http` package (no routing framework).
- Implement request logging and timing via middleware.
- All endpoints return JSON responses with consistent structure: `{ "status": "ok", "data": <payload> }`.

## 4. Feed Processors Layer

External data sources are encapsulated as plugins in Go. Each plugin fetches, normalizes, and upserts data into SQLite.

### Plugin Interface:
```go
type FeedPlugin interface {
    Name() string
    Type() EventType // earthquake | wildfire | weather
    Fetch(ctx context.Context) ([]EventRecord, error)
    Normalize(record RawData) (EventRecord, bool)
    Upsert(records []EventRecord) error
}
```

### Existing Plugins (MVP):

| Plugin     | Source         | Update Frequency | Notes                                  |
|------------|----------------|------------------|----------------------------------------|
| Earthquake | USGS API       | Every 5 min      | Uses JSON feeds; simple coordinate normalization |

### Feed Synchronization:
- A scheduler runs at fixed intervals per plugin.
- Each plugin fetches raw data, normalizes it in-memory (no DB round-trip during normalization), then upserts results to SQLite.
- Failed syncs are logged but do not block subsequent requests or other plugins.

## 5. Database Layer (SQLite)

The SQLite database stores normalized event records with full schema details defined in DATABASE.md. For MVP, the key considerations are:

### Schema Design Highlights:
- **Events table:** Stores individual geospatial events with type classification and metadata.
- **Layers table:** Tracks which layers exist and their last-sync timestamps.
- Indices on `type`, `coordinates`, and `timestamp` columns for efficient queries used by the API layer.

## 6. Data Flow Summary: External → SQLite → Frontend

1. Feed plugin fetches raw data from external source (e.g., USGS earthquake feed).
2. Plugin normalizes coordinates, magnitudes, timestamps into structured records in-memory.
3. Batch upsert occurs via transactional writes to SQLite.
4. API layer queries SQLite for current event data on frontend request.
5. Frontend receives JSON payload and renders markers on globe.

No caching layer exists; SQLite is the sole persistent cache. The database file lives at `/app/data/koalaworld.db` inside the Docker container, mounted as a volume for persistence.
