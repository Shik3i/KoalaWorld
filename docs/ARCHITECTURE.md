# System Architecture Overview

## 1. Proposed System Architecture
The KoalaWorld system employs a decoupled client-server architecture designed for high performance, low resource usage, and self-hosting capability. The core components are the Frontend visualization layer (Vite/Three.js), the Backend API service (Go), the persistence layer (SQLite), and the edge proxy (Caddy).

**Flow:**
1.  The user accesses the application via Caddy, which routes requests to the Go backend container.
2.  The frontend client interacts solely with the normalized public APIs provided by the Go backend.
3.  When new data is needed, the Go backend utilizes a modular Layer/Plugin System to fetch raw geo-data from external free feeds (e.g., USGS for earthquakes).
4.  This raw data is then processed and validated by the relevant plugin, upserted into the local SQLite database.
5.  The frontend queries the backend for visualization data, which pulls the pre-processed/cached results directly from SQLite, bypassing real-time external API calls during runtime.

## 2. Technology Selection Rationale
*   **Backend (Go):** Selected for its excellent performance profile, small memory footprint, and highly concurrent nature. Go is ideal for building fast, efficient APIs that minimize resource overhead—crucial for self-hosting on constrained VPS environments.
*   **Frontend (Vite + Three.js):** Vite provides extremely rapid development tooling and optimized builds, ensuring a lightweight asset bundle. Three.js is the industry standard for high-performance 3D rendering in the browser, allowing us to render complex global visualizations efficiently without heavy frameworks or large runtime dependencies.
*   **Database (SQLite):** Chosen specifically for its zero-configuration, file-based nature. This eliminates the need to run and maintain a separate database service (like PostgreSQL) within Docker Compose, drastically simplifying deployment into a single container structure.
*   **No ORM/Next.js:** Avoiding an ORM in favor of direct SQL interaction allows maximum control over query efficiency, which is critical for performance. Skipping Next.js ensures the frontend remains lean and focused solely on rendering Three.js assets without framework bloat.

## 3. Component Responsibilities
*   **Frontend (Three.js/Vite):** Responsible for user interaction, rendering the 3D globe model, managing camera movement, displaying geospatial layers based on API responses, and handling UI elements. It is strictly a visualization client.
*   **Backend (Go):** Acts as a robust data proxy, normalization layer, caching service, and synchronization engine. Its responsibilities include:
    1. Handling all external communication with public geo-feeds via the Layer/Plugin System.
    2.  Data validation and transformation (normalization).
    3.  Writing/reading data from SQLite.
    4.  Serving cached, ready-to-visualize JSON endpoints to the frontend.

## 4. Deployment Architecture
The architecture is designed around minimizing external dependencies:
*   **Containerization:** A single Docker container bundles the Go backend, necessary libraries, and potentially static assets (if pre-built).
*   **Reverse Proxy:** Caddy acts as the edge proxy, handling SSL termination, routing traffic to the internal Go service, and providing basic security/rate limiting. This keeps the core application focused solely on business logic.
*   **Data Storage:** The SQLite database file (`koalaworld.db`) resides in a mounted volume (`/data`), ensuring persistence across container restarts while keeping it outside the main image layers for easy backup.

## 5. Caching Strategy (In-Memory and Database)
1. Primary Cache (SQLite): The SQLite database itself serves as the primary persistent and temporal cache for all incoming geo-data. Instead of fetching raw data on every request, the frontend requests pre-aggregated/processed features from SQLite. This is optimized by minimizing redundant writes to the local database.

## 6. Feed Synchronization Strategy
Data synchronization is managed exclusively by the Go backend via a dedicated scheduler routine:
*   **Polling:** For time-sensitive feeds (e.g., earthquake updates), the backend will poll external APIs at defined intervals (e.g., every 5 minutes).
*   **Event-Driven/Webhook:** If an API supports webhooks, the backend should register for them to achieve near real-time updates, reducing polling load.
*   **Data Integrity:** Before upserting data into SQLite, it undergoes a normalization process (e.g., standardizing coordinate formats, ensuring uniform timezones) to maintain high data integrity across disparate external sources.

## 7. Future Scalability Considerations
While the MVP is designed for maximum simplicity and low overhead, future scalability could be addressed by:
1.  **Database Separation:** Migrating from SQLite (file-based, single writer limitation) to a clustered SQL solution like PostgreSQL or CockroachDB if concurrent write load increases significantly.
2.  **Microservices:** Decoupling the Feed Synchronization engine into its own worker service, allowing it to scale independently of the primary API serving layer.
3.  **CDN Integration:** Using a Content Delivery Network (CDN) for static frontend assets to offload traffic from the Go backend entirely.