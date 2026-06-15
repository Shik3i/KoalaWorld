# KoalaWorld

[![CI](https://github.com/Shik3i/KoalaWorld/actions/workflows/ci.yml/badge.svg)](https://github.com/Shik3i/KoalaWorld/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Shik3i/KoalaWorld)](LICENSE)
[![Go Version](https://img.shields.io/github/go-mod/go-version/Shik3i/KoalaWorld)](backend/go.mod)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Self-hosted 3D geo-visualization service** — Go backend + SQLite, Three.js/Vite frontend. Visualize earthquakes, wildfires, and weather data on an interactive 3D globe.

## Features

- 🌍 Interactive 3D globe with Earth texture
- 🔴 Real-time earthquake markers (USGS feed)
- 🔥 Wildfire activity tracking (NASA FIRMS)
- 🌤️ Global weather conditions (Open-Meteo)
- 🗺️ Country borders overlay (Natural Earth)
- 🔍 Advanced search/filter by magnitude, date, location
- 🎨 Dark/Light theme toggle
- 📊 Live feed status panel
- 🐳 One-command Docker deployment

## Quick Start

```bash
docker compose up -d
```

Open http://localhost:8080.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design and rationale |
| [API Reference](docs/API.md) | REST endpoint documentation |
| [Database Schema](docs/DATABASE.md) | SQLite schema and queries |
| [Layer Architecture](docs/LAYERS.md) | Frontend layer system |
| [Data Feeds](docs/FEEDS.md) | External data sources |
| [Roadmap](docs/ROADMAP.md) | Development priorities |

## Development

### Backend (Go)

```bash
cd backend
go run ./cmd/koalaworld
```

### Frontend (Vite + TypeScript)

```bash
cd frontend
npm install
npm run dev      # Dev server with HMR at :5173
npm run build    # Production build
npm run typecheck # TypeScript type checking
```

### Production Build

```bash
cd frontend && npm run build
mkdir -p ../backend/web
cp -r dist/* ../backend/web/
cd ../backend && go build -o koalaworld ./cmd/koalaworld && ./koalaworld
```

### Docker

```bash
docker compose build
docker compose up -d
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `FIRMS_API_KEY` | — | NASA FIRMS API key for wildfire data |

## Testing

```bash
cd backend && go test ./... -v
cd frontend && npm run typecheck
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) © 2026 Shik3i
