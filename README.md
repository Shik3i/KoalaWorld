## KoalaWorld

Self-hosted 3D geo-visualization service with Go backend and Three.js frontend.

## Quick Start (Docker)

```bash
docker compose up -d
```

Open http://localhost:8080 in your browser.

## Local Development

### Backend (Go)

```bash
cd backend && go run ./cmd/koalaworld
```

Server starts on http://localhost:8080.

### Frontend (Vite + Three.js)

For development with hot-reload:

```bash
cd frontend && npm install && npm run dev
```

The Vite dev server runs on http://localhost:5173 and proxies `/api` requests to the Go backend on port 8080.

### Production Build

To build the frontend and serve it from the Go binary:

```bash
cd frontend && npm run build
mkdir -p ../backend/web
cp -r dist/* ../backend/web/
cd ../backend && go build -o koalaworld ./cmd/koalaworld && ./koalaworld
```

Then open http://localhost:8080.

## Docker

```bash
docker compose build
docker compose up -d
```

## Configuration

- Earthquake data: fetched from USGS on startup and refreshed periodically
- Database: SQLite stored at `./data/koalaworld.db`
- Frontend assets: served from `web/` directory alongside the binary