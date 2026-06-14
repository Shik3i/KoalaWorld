# KoalaWorld Development Roadmap

## 🎯 Phase 1: Minimum Viable Product (MVP) - Core Visualization & Data Integration
**Goal:** Achieve a functional, self-hosted interactive globe displaying basic geo-data from one or two key feeds.
*   **Milestones:**
    1.  Setup core Go backend API and SQLite persistence layer.
    2.  Implement initial Three.js globe rendering (static background).
    3.  Integrate a single, simple data feed (e.g., Earthquake/Seismic activity).
    4.  Backend processes raw data -> normalizes -> stores in SQLite.
    5.  Frontend successfully displays markers on the 3D globe based on SQLite queries.

## ✨ Phase 2: Feature Expansion & Robustness (Stretch Goals)
**Goal:** Increase feature richness, robustness, and visualization depth.
*   **Milestones:**
    1.  Integrate multiple diverse geo-data feeds (Earthquakes, Wildfires).
    2.  Implement advanced visualization layers (heatmaps, custom polygons).
    3.  Optimize data synchronization scheduler for reliability and efficiency.
    4.  Refine Caddy configuration for better routing and security headers.

## 🚀 Phase 3: Optimization & Ecosystem Maturity (Future Ideas)
**Goal:** Perfecting performance, deployment quality, and community interaction.
*   **Ideas:**
    1.  Implement advanced search/filtering capabilities on the frontend based on SQLite data.
    2.  Introduce theme customization options for users via a configuration file.
    3.  Develop full CI/CD pipeline with automated provenance attestations (SBOM) using GitHub Actions.
    4.  Add administrative tools/UI to monitor feed synchronization status and database health.

## ⚖️ Priority Matrix Summary
| Feature | Impact | Complexity | Priority | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| MVP Data Flow (BE -> SQLite -> FE) | High | Medium | **MVP** | Core value proposition; establishes the data pipeline. |
| Basic Globe Rendering (FE) | High | Low | **MVP** | Essential foundation of the visualization product. |
| Earthquakes Integration | High | Medium | Phase 1 | Addresses the core use case for the MVP and provides immediate, impactful visual feedback. |
| Multi-Feed Expansion | High | Medium | Phase 2 | Increases utility by adding diverse layers (Wildfires, etc.). |
| Advanced UI Filters | Medium | Medium | Phase 2 | Improves user experience once core data is stable. |
| CI/CD & Provenance | Medium | High | Phase 3 | Critical for long-term open-source health but not required for first functional release. |

## ⚖️ Prioritization Justification
Priorities are determined by balancing **Impact** (how much value the feature brings to the user) against **Implementation Complexity** (the engineering effort required). The MVP is heavily weighted towards immediate core utility (Earthquakes visualization) before expanding scope. Phase 3 tasks, such as CI/CD, are high complexity but low necessity for initial product viability.