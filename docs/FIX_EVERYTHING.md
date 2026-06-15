# Complete Fix Prompt — KoalaWorld Production Polish

You are fixing KoalaWorld. The current state is broken in multiple ways. Fix EVERYTHING below. No shortcuts, no half-fixes. Read all files, understand the code, fix it properly.

## BUG 1: Filters don't actually filter
**Files:** `frontend/src/main.ts`

Current code has `buildQueryParams()` that merges `filterState` with mode-based params. But when user clicks "Reset" in sidebar, `onFilterReset` is called, which resets `filterState` AND calls `fetchAndDisplayEarthquakes()`. However, `buildQueryParams()` also applies mode-specific filters (`currentMode === 'top'` adds `min_mag=6`, etc.). So even with filters cleared, the mode still restricts data.

Also, `buildQueryParams()` has logic that IGNORES `filterState.dateFrom`/`dateTo` when mode is `today`/`week`/`month`. This means sidebar date filters are silently overridden.

**Fix:** 
- Sidebar date filters should ALWAYS take priority over mode defaults
- When mode changes, update the sidebar filter values to reflect the mode, don't silently override them
- `buildQueryParams()` should: mode sets defaults → sidebar filters override → send to API
- Reset button should reset to mode defaults, not empty

## BUG 2: Wildfire layer shows 0 data
**Files:** `backend/internal/plugin/wildfire.go`, `frontend/src/main.ts`

Wildfire requires `FIRMS_API_KEY` env var. Without it, 0 events. But the frontend still shows it as a layer option, and the layer toggle does nothing.

**Fix:**
- Don't show wildfire (and weather if 0 data) in layer toggles if no data exists
- OR better: make the frontend check if there's data before showing the layer
- Add a `count` to each layer state from the API
- Hide layers with 0 count from the sidebar
- OR: show them but disabled with "(no data)" label

## BUG 3: Country borders are fragmented/wrong
**Files:** `frontend/src/layers/country_borders.ts`

The current code fetches from `unpkg.com/world-atlas@2/countries-110m.json`. This CDN can be unreliable, or the TopoJSON→Three.js conversion might have issues with the worldGroup rotation (borders use absolute coordinates on the sphere surface, and worldGroup rotation should rotate them correctly, but check that border vertices are at correct radius).

**Fix:**
- Verify the URL works: curl it and check JSON structure
- If CDN is down, embed a minimal fallback or use a different source
- Check that border vertices are at radius 2.005 (same as globe radius with slight offset)
- Verify TopoJSON feature extraction: `topojson.feature(world, world.objects.countries)` must work
- Add error handling: if borders fail to load, log clearly and don't crash
- Make borders part of worldGroup (they already should be via `worldGroup.add(group)` in main.ts)

## BUG 4: UI elements overlapping
**Files:** Multiple UI files

Current layout problems:
- Event panel toggle (📋 Events) at bottom-right-60px  
- Admin status button at bottom-right-16px
- Mode bar centered at bottom
- Magnitude legend centered below mode bar
- On mobile: everything collides

**Fix with exact positions:**
```
BOTTOM-RIGHT COLUMN (stacked vertically, 12px gap):
  ┌──────────────┐
  │  📋 Events    │  bottom: 62px, right: 16px, z: 140
  └──────────────┘
  ┌──────────────┐
  │  📊 Status    │  bottom: 16px, right: 16px, z: 130
  └──────────────┘

BOTTOM-CENTER (horizontal strip, no overlap):
  ┌──────────────────────────────────────────┐
  │  <3 ●  3-5 ●  5-6 ●  ≥6 ●               │  LEGEND: bottom: 82px
  └──────────────────────────────────────────┘
  ┌──────────────────────────────────────────┐
  │  [Live] [Top] [Today] [Week] [Month] ▼   │  MODE BAR: bottom: 16px
  └──────────────────────────────────────────┘

LEFT SIDE:
  ┌────────────┐
  │  SIDEBAR    │  top: 8px, left: 8px, height: calc(100vh - 120px)
  │  340px      │  (leaves room for bottom elements)
  └────────────┘

RIGHT EDGE:
  ┌────────────┐
  │  ZOOM + │   │  MAP CONTROLS: right: 16px, top: 50%, translateY(-50%)
  │  ZOOM − │   │
  │  RESET  │   │
  │  ⛶ FS   │   │
  └────────────┘
```

**Exact CSS for each element — copy these into the component files:**

### Admin button (legacy.ts createAdminPanel):
```css
position: fixed;
bottom: 16px;
right: 16px;
z-index: 130;
/* Panel opens ABOVE the button: */
/* Panel: position: fixed; bottom: 56px; right: 16px; z-index: 130; */
```

### Event panel toggle (event_panel.ts):
```css
position: fixed;
bottom: 62px;
right: 16px;
z-index: 140;
```

### Map controls (map_controls.ts):
```css
position: fixed;
right: 20px;
top: 50%;
transform: translateY(-50%);
z-index: 110;
```

### Magnitude legend:
```css
position: fixed;
bottom: 82px;
left: 50%;
transform: translateX(-50%);
z-index: 115;
```

### Mode bar:
```css
position: fixed;
bottom: 16px;
left: 50%;
transform: translateX(-50%);
z-index: 120;
```

### Sidebar (base.css .kw-sidebar-container):
```css
position: fixed;
top: 12px;
left: 12px;
max-height: calc(100vh - 130px);
z-index: 100;
```

### Info panel:
```css
position: fixed;
top: 40px;
right: 12px;
width: 380px;
max-height: calc(100vh - 160px);
z-index: 150;
```

### CSS Z-INDEX MASTER LIST (add to variables.css):
```css
--kw-z-sidebar: 100;
--kw-z-map-controls: 110;
--kw-z-legend: 115;
--kw-z-mode-bar: 120;
--kw-z-admin: 130;
--kw-z-event-panel-toggle: 140;
--kw-z-event-panel: 145;
--kw-z-info-panel: 150;
--kw-z-modal: 300;
--kw-z-loading: 500;
--kw-z-banner: 999;
```

## BUG 5: Country borders don't render or are broken
**Debug steps:**
1. Open browser console, check for errors loading `unpkg.com/world-atlas@2/countries-110m.json`
2. Check that `createCountryBorders()` is called and the group is added to `worldGroup`
3. Verify the TopoJSON library is installed: `npm ls topojson-client`
4. The borders are at radius 2.005 — make sure this matches the globe radius (2.0) with slight offset

## BUG 6: No loading/error state feedback
When filters return 0 results, the globe shows nothing but no message tells the user why.

**Fix:** Add a small toast/notification in the bottom-center that says:
- "No events match your filters" when results are empty
- "Loading..." during fetch
- "API error — retrying..." on failure

## BUG 7: Stats in sidebar don't update
**Fix:** The sidebar's `updateStats` method must rebuild the stats DOM. Currently it only sets a local variable. Find the `.kw-stats-grid` element and update its innerHTML.

## VERIFICATION CHECKLIST (run after all fixes):
1. `cd frontend && npx tsc --noEmit` — zero errors
2. `cd backend && go build ./... && go test ./...` — all pass
3. `docker compose up -d --build` — container starts, health check passes
4. Open http://localhost:8080 — verify visually:
   - Sidebar on left, not overlapping
   - Legend centered at bottom, readable
   - Mode bar below legend, centered
   - Two buttons stacked bottom-right, not overlapping
   - Event panel slides from right without covering buttons
   - Globe rotates with borders, grid, plates all rotating together
   - Click an earthquake → info panel appears
   - Change mode → data refreshes
   - Clear filters → all data shows
   - Country borders visible (check Pacific Ring of Fire outline)
