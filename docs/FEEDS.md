# Public Geo-Data Feed Proposals

This document researches and proposes free public geo-data sources suitable for KoalaWorld's self-hosted implementation. The focus is on reliability, low latency, and permissive licensing.

## 🌍 Earthquake Data (USGS)
*   **Source Name:** United States Geological Survey (USGS) GeoHazards Data
*   **Purpose:** Provides real-time data on earthquakes worldwide, including magnitude, location, and time.
*   **Update Frequency:** Near Real-Time (updates as events occur).
*   **Authentication Required:** No for basic public API access.
*   **Licensing Considerations:** Generally open for non-commercial research/visualization; specific terms should be verified against the latest USGS usage policy.
*   **Implementation Difficulty:** Low to Medium. Requires careful parsing of JSON payloads and handling time zone conversions.

## 🔥 Wildfire Activity Data (NASA/MODIS or similar)
*   **Source Name:** NASA FIRMS (Fire Information for Resource Management System) / Satellite Imagery APIs
*   **Purpose:** Monitors active fires globally using satellite thermal data, crucial for environmental tracking.
*   **Update Frequency:** Daily to near-daily, depending on the specific satellite pass.
*   **Authentication Required:** Often requires API keys or adherence to strict data access protocols.
*   **Licensing Considerations:** Requires careful review of NASA's usage agreements, typically permissive but sometimes tied to research use.
*   **Implementation Difficulty:** Medium to High. Data often comes in complex geospatial formats (NetCDF/GeoTIFF) requiring specialized parsing before SQLite storage.

## 🌬️ Global Weather & Climate Data (OpenWeatherMap / ECMWF Public API)
*   **Source Name:** Open-source meteorological data feeds or public APIs from organizations like ECMWF (European Centre for Medium-Range Weather Forecasts).
*   **Purpose:** Provides current and forecasted weather conditions (temperature, pressure, wind speed) mapped geographically.
*   **Update Frequency:** Hourly to several times per day.
*   **Authentication Required:** Yes, most reliable commercial/research APIs require an API key, though some public feeds are available without one.
*   **Licensing Considerations:** Varies wildly; must select a feed with a very permissive license (CC-BY or similar).
*   **Implementation Difficulty:** Low to Medium. Data is typically provided in structured JSON formats suitable for direct processing.

## 💧 Environmental/Hydrological Data (NOAA APIs)
*   **Source Name:** National Oceanic and Atmospheric Administration (NOAA) Public Datasets
*   **Purpose:** Provides data on sea levels, currents, and hydrological events critical for coastal visualization.
*   **Update Frequency:** Variable (can be near real-time or daily snapshots).
*   **Authentication Required:** Generally No for public access portals.
*   **Licensing Considerations:** Usually highly permissive under government open data policies.
*   **Implementation Difficulty:** Medium. Requires dealing with potentially complex, large time-series datasets.