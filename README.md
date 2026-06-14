# KoalaWorld

KoalaWorld is a self-hosted 3D geo-visualization service. It renders a stylized interactive globe and allows users to enable geospatial information layers such as recent earthquakes, wildfires, natural events, weather-related data, and other free public geo-data feeds.

## Project Vision
The project's vision is to provide an accessible, real-time view of global events using open-source technology through a self-hosted solution. The development workflow adheres strictly to the constraint of utilizing only local Large Language Models (LLMs).

## Technical Direction (MVP)
*   **Deployment:** Small single Docker container running behind a Caddy reverse proxy.
*   **Backend:** Go language implementation.
*   **Frontend:** Vite + TypeScript + Three.js. No Next.js is used.
*   **Database:** SQLite, stored at `/data/koalaworld.db`. No separate Postgres/MySQL/Redis service for the MVP.
*   **Data Flow:** Public APIs are accessed exclusively through the backend. Data is normalized, upserted into SQLite, cached, and then visualized in the frontend. The frontend must never call third-party data APIs directly.
*   **CI/CD:** GitHub Actions will later be used to build and publish an optimized container image with supply-chain best practices (e.g., provenance/SBOM attestations).

## Technical Direction (MVP)
*   **Deployment:** Small single Docker container running behind a Caddy reverse proxy.
*   **Backend:** Go language implementation.
*   **Frontend:** Vite + TypeScript + Three.js. No Next.js is used.
*   **Database:** SQLite, stored at `/data/koalaworld.db`. No separate Postgres/MySQL/Redis service for the MVP.
*   **Data Flow:** Public APIs are accessed exclusively through the backend. Data is normalized, upserted into SQLite, cached, and then visualized in the frontend. The frontend must never call third-party data APIs directly.
*   **CI/CD:** GitHub Actions will later be used to build and publish an optimized container image with supply-chain best practices (e.g., provenance/SBOM attestations).

## Local LLM Commitment
This project is designed to operate using local Large Language Models only, ensuring privacy and self-sufficiency for its AI features.