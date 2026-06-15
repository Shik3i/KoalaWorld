import type { GeoEvent } from '../types';

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatMagnitudeClass(mag: number): string {
  if (mag < 3) return 'kw-badge-low';
  if (mag < 5) return 'kw-badge-medium';
  if (mag < 6) return 'kw-badge-high';
  return 'kw-badge-severe';
}

function getTempBadgeClass(tempC: number | undefined): string {
  if (tempC === undefined) return 'kw-badge-low';
  if (tempC < 0) return 'kw-badge-low';
  if (tempC < 20) return 'kw-badge-medium';
  if (tempC < 35) return 'kw-badge-high';
  return 'kw-badge-severe';
}

function getRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

const CSS = `
.ip-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: 380px;
  max-width: 100vw;
  height: 100vh;
  transform: translateX(100%);
  opacity: 0;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
  padding: 22px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  z-index: var(--kw-z-info-panel, 150);
  border-radius: 14px 0 0 14px;
  box-sizing: border-box;
}
.ip-panel.ip-open {
  transform: translateX(0);
  opacity: 1;
}
.ip-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--kw-text-muted, #555872);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}
.ip-close:hover {
  background: rgba(255,255,255,0.06);
  color: var(--kw-text, #e8eaf0);
}
.ip-content {
  margin-top: 36px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  flex: 1;
}
.ip-content::-webkit-scrollbar {
  width: 4px;
}
.ip-content::-webkit-scrollbar-track {
  background: transparent;
}
.ip-content::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.08);
  border-radius: 2px;
}
.ip-place {
  font-size: 17px;
  font-weight: 600;
  color: var(--kw-text, #e8eaf0);
  letter-spacing: -0.01em;
  line-height: 1.3;
  margin: 0 0 2px;
}
.ip-mag-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.ip-mag-badge {
  font-size: 28px;
  font-weight: 700;
  padding: 6px 14px;
  border-radius: 8px;
  font-family: var(--kw-font-mono, monospace);
  letter-spacing: -0.02em;
}
.ip-mag-badge.ip-mag-low { box-shadow: 0 0 12px rgba(34,197,94,0.2); }
.ip-mag-badge.ip-mag-medium { box-shadow: 0 0 12px rgba(234,179,8,0.2); }
.ip-mag-badge.ip-mag-high { box-shadow: 0 0 12px rgba(249,115,22,0.2); }
.ip-mag-badge.ip-mag-severe { box-shadow: 0 0 16px rgba(239,68,68,0.25); }
.ip-mag-label {
  color: var(--kw-text-muted, #555872);
  font-size: 14px;
  font-weight: 500;
}
.ip-details {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.ip-detail-row {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.ip-detail-key {
  color: var(--kw-text-muted, #555872);
  font-size: 13px;
  width: 90px;
  flex-shrink: 0;
  text-transform: uppercase;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
}
.ip-detail-value {
  color: var(--kw-text, #e8eaf0);
  font-size: 13px;
  font-family: var(--kw-font-mono, monospace);
}
.ip-actions {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ip-link {
  color: #3b82f6;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: color 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.ip-link:hover {
  color: #60a5fa;
}
.ip-copy-btn {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
  color: var(--kw-text-secondary, #8b8fa8);
  padding: 8px 14px;
  border-radius: 7px;
  font-size: 13px;
  cursor: pointer;
  font-family: var(--kw-font, 'Inter', sans-serif);
  font-weight: 500;
  transition: all 0.15s ease;
  text-align: center;
}
.ip-copy-btn:hover {
  background: rgba(255,255,255,0.08);
  color: var(--kw-text, #e8eaf0);
  border-color: rgba(255,255,255,0.12);
}
.ip-copy-btn.ip-copied {
  background: rgba(34,197,94,0.12);
  border-color: rgba(34,197,94,0.25);
  color: #22c55e;
}
@media (max-width: 768px) {
  .ip-panel {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 70vh;
    border-radius: 16px 16px 0 0;
    transform: translateY(100%);
  }
  .ip-panel.ip-open {
    transform: translateY(0);
  }
}
`;

let styleEl: HTMLStyleElement | null = null;

function ensureStyles(): void {
  if (styleEl) return;
  styleEl = document.createElement('style');
  styleEl.textContent = CSS;
  document.head.appendChild(styleEl);
}

export function createInfoPanel(): { element: HTMLElement; show: (event: GeoEvent) => void; hide: () => void } {
  ensureStyles();

  const panel = document.createElement('div');
  panel.className = 'ip-panel kw-panel';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ip-close';
  closeBtn.innerHTML = '\u00D7';
  closeBtn.setAttribute('aria-label', 'Close panel');
  closeBtn.addEventListener('click', hide);

  const content = document.createElement('div');
  content.className = 'ip-content';

  panel.appendChild(closeBtn);
  panel.appendChild(content);

  let isOpen = false;

  function show(event: GeoEvent): void {
    const meta = event.metadata as Record<string, unknown> | undefined;
    const source = event.source || 'N/A';
    const lat = event.latitude.toFixed(4);
    const lng = event.longitude.toFixed(4);

    let bodyHtml = '';

    if (event.type === 'weather') {
      const city = (meta?.city as string) || 'Unknown';
      const temp = meta?.temperature_2m as number | undefined;
      const humidity = meta?.relative_humidity_2m as number | undefined;
      const windSpeed = meta?.wind_speed_10m as number | undefined;
      const weatherCode = meta?.weather_code as number | undefined;
      const tempClass = getTempBadgeClass(temp);
      const tempGlowClass = tempClass.replace('kw-badge', 'ip-mag');

      bodyHtml = `
        <h3 class="ip-place">${escapeHtml(city)}</h3>
        <div class="ip-mag-row">
          <span class="kw-badge ${tempClass} ip-mag-badge ${tempGlowClass}">${temp != null ? temp.toFixed(1) + '\u00B0C' : 'N/A'}</span>
          <span class="ip-mag-label">Temperature</span>
        </div>
        <div class="ip-details">
          <div class="ip-detail-row">
            <span class="ip-detail-key">Humidity</span>
            <span class="ip-detail-value">${humidity != null ? humidity.toFixed(0) + '%' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Wind Speed</span>
            <span class="ip-detail-value">${windSpeed != null ? windSpeed.toFixed(1) + ' km/h' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Weather Code</span>
            <span class="ip-detail-value">${weatherCode != null ? String(weatherCode) : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Source</span>
            <span class="ip-detail-value">${escapeHtml(source)}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Latitude</span>
            <span class="ip-detail-value">${lat}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Longitude</span>
            <span class="ip-detail-value">${lng}</span>
          </div>
        </div>
        <div class="ip-actions">
          <button class="ip-copy-btn" id="kw-copy-link">📋 Copy coordinates</button>
        </div>
      `;
    } else if (event.type === 'wildfire') {
      const confidence = (meta?.confidence as string) || 'N/A';
      const frp = meta?.frp as number | undefined;
      const satellite = (meta?.satellite as string) || 'N/A';
      const brightness = meta?.brightness as number | undefined;

      bodyHtml = `
        <h3 class="ip-place">Wildfire</h3>
        <div class="ip-mag-row">
          <span class="kw-badge kw-badge-severe ip-mag-badge ip-mag-severe">${frp != null ? frp.toFixed(1) + ' MW' : 'N/A'}</span>
          <span class="ip-mag-label">FRP</span>
        </div>
        <div class="ip-details">
          <div class="ip-detail-row">
            <span class="ip-detail-key">Confidence</span>
            <span class="ip-detail-value">${escapeHtml(confidence)}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Brightness</span>
            <span class="ip-detail-value">${brightness != null ? brightness.toFixed(1) + ' K' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Satellite</span>
            <span class="ip-detail-value">${escapeHtml(satellite)}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Latitude</span>
            <span class="ip-detail-value">${lat}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Longitude</span>
            <span class="ip-detail-value">${lng}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Source</span>
            <span class="ip-detail-value">${escapeHtml(source)}</span>
          </div>
        </div>
        <div class="ip-actions">
          <button class="ip-copy-btn" id="kw-copy-link">📋 Copy coordinates</button>
        </div>
      `;
    } else if (event.type === 'air_quality') {
      const city = (meta?.city as string) || 'Unknown';
      const euAQI = meta?.european_aqi as number | undefined;
      const usAQI = meta?.us_aqi as number | undefined;
      const pm25 = meta?.pm2_5 as number | undefined;
      const pm10 = meta?.pm10 as number | undefined;
      const ozone = meta?.ozone as number | undefined;
      const no2 = meta?.nitrogen_dioxide as number | undefined;

      bodyHtml = `
        <h3 class="ip-place">${escapeHtml(city)}</h3>
        <div class="ip-mag-row">
          <span class="kw-badge ${euAQI != null && euAQI > 60 ? 'kw-badge-severe' : euAQI != null && euAQI > 40 ? 'kw-badge-high' : euAQI != null && euAQI > 20 ? 'kw-badge-medium' : 'kw-badge-low'} ip-mag-badge">${euAQI != null ? euAQI.toFixed(0) : 'N/A'}</span>
          <span class="ip-mag-label">European AQI</span>
        </div>
        <div class="ip-details">
          <div class="ip-detail-row">
            <span class="ip-detail-key">US AQI</span>
            <span class="ip-detail-value">${usAQI != null ? usAQI.toFixed(0) : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">PM2.5</span>
            <span class="ip-detail-value">${pm25 != null ? pm25.toFixed(1) + ' µg/m³' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">PM10</span>
            <span class="ip-detail-value">${pm10 != null ? pm10.toFixed(1) + ' µg/m³' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Ozone</span>
            <span class="ip-detail-value">${ozone != null ? ozone.toFixed(1) + ' µg/m³' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">NO₂</span>
            <span class="ip-detail-value">${no2 != null ? no2.toFixed(1) + ' µg/m³' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Latitude</span>
            <span class="ip-detail-value">${lat}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Longitude</span>
            <span class="ip-detail-value">${lng}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Source</span>
            <span class="ip-detail-value">${escapeHtml(source)}</span>
          </div>
        </div>
        <div class="ip-actions">
          <button class="ip-copy-btn" id="kw-copy-link">📋 Copy coordinates</button>
        </div>
      `;
    } else if (event.type === 'iss') {
      const name = (meta?.name as string) || 'ISS';
      const altitude = meta?.altitude as number | undefined;
      const velocity = meta?.velocity as number | undefined;

      bodyHtml = `
        <h3 class="ip-place">${escapeHtml(name)}</h3>
        <div class="ip-mag-row">
          <span class="kw-badge kw-badge-medium ip-mag-badge ip-mag-medium">●</span>
          <span class="ip-mag-label">Live</span>
        </div>
        <div class="ip-details">
          <div class="ip-detail-row">
            <span class="ip-detail-key">Altitude</span>
            <span class="ip-detail-value">${altitude != null ? altitude.toFixed(1) + ' km' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Velocity</span>
            <span class="ip-detail-value">${velocity != null ? velocity.toFixed(1) + ' km/h' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Latitude</span>
            <span class="ip-detail-value">${lat}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Longitude</span>
            <span class="ip-detail-value">${lng}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Source</span>
            <span class="ip-detail-value">${escapeHtml(source)}</span>
          </div>
        </div>
        <div class="ip-actions">
          <button class="ip-copy-btn" id="kw-copy-link">📋 Copy coordinates</button>
        </div>
      `;
    } else if (event.type === 'marine') {
      const city = (meta?.city as string) || 'Unknown';
      const waveHeight = meta?.wave_height as number | undefined;
      const waveDir = meta?.wave_direction as number | undefined;
      const swellHeight = meta?.swell_wave_height as number | undefined;
      const swellDir = meta?.swell_wave_direction as number | undefined;
      const seaTemp = meta?.sea_surface_temperature as number | undefined;

      bodyHtml = `
        <h3 class="ip-place">${escapeHtml(city)}</h3>
        <div class="ip-mag-row">
          <span class="kw-badge ${(waveHeight ?? 0) > 3 ? 'kw-badge-severe' : (waveHeight ?? 0) > 1.5 ? 'kw-badge-high' : 'kw-badge-medium'} ip-mag-badge">${waveHeight != null ? waveHeight.toFixed(1) + 'm' : 'N/A'}</span>
          <span class="ip-mag-label">Wave Height</span>
        </div>
        <div class="ip-details">
          <div class="ip-detail-row">
            <span class="ip-detail-key">Wave Dir</span>
            <span class="ip-detail-value">${waveDir != null ? waveDir.toFixed(0) + '°' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Swell Height</span>
            <span class="ip-detail-value">${swellHeight != null ? swellHeight.toFixed(1) + 'm' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Swell Dir</span>
            <span class="ip-detail-value">${swellDir != null ? swellDir.toFixed(0) + '°' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Sea Temp</span>
            <span class="ip-detail-value">${seaTemp != null ? seaTemp.toFixed(1) + '°C' : 'N/A'}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Latitude</span>
            <span class="ip-detail-value">${lat}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Longitude</span>
            <span class="ip-detail-value">${lng}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Source</span>
            <span class="ip-detail-value">${escapeHtml(source)}</span>
          </div>
        </div>
        <div class="ip-actions">
          <button class="ip-copy-btn" id="kw-copy-link">📋 Copy coordinates</button>
        </div>
      `;
    } else {
      const place = (meta?.place as string) || 'Unknown location';
      const url = (meta?.url as string) || '';
      const mag = event.magnitude != null ? event.magnitude.toFixed(2) : 'N/A';
      const magNum = event.magnitude ?? 0;
      const depth = event.depth_km != null ? event.depth_km.toFixed(1) + ' km' : 'N/A';
      const timeFull = event.timestamp ? new Date(event.timestamp).toLocaleString() : 'N/A';
      const timeRel = event.timestamp ? getRelativeTime(event.timestamp) : '';
      const magClass = formatMagnitudeClass(magNum);
      const magGlowClass = magClass.replace('kw-badge', 'ip-mag');

      bodyHtml = `
        <h3 class="ip-place">${escapeHtml(place)}</h3>
        <div class="ip-mag-row">
          <span class="kw-badge ${magClass} ip-mag-badge ${magGlowClass}">${mag}</span>
          <span class="ip-mag-label">Magnitude</span>
        </div>
        <div class="ip-details">
          <div class="ip-detail-row">
            <span class="ip-detail-key">Depth</span>
            <span class="ip-detail-value">${depth}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Time</span>
            <span class="ip-detail-value">${timeFull}${timeRel ? ' (' + timeRel + ')' : ''}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Latitude</span>
            <span class="ip-detail-value">${lat}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Longitude</span>
            <span class="ip-detail-value">${lng}</span>
          </div>
          <div class="ip-detail-row">
            <span class="ip-detail-key">Source</span>
            <span class="ip-detail-value">${escapeHtml(source)}</span>
          </div>
        </div>
        <div class="ip-actions">
          ${url ? `<a href="${url}" target="_blank" rel="noopener" class="ip-link">View on USGS \u2192</a>` : ''}
          <button class="ip-copy-btn" id="kw-copy-link">\uD83D\uDCCB Copy coordinates</button>
        </div>
      `;
    }

    content.innerHTML = bodyHtml;

    const copyBtn = content.querySelector('#kw-copy-link') as HTMLButtonElement | null;
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(`${lat}, ${lng}`).then(() => {
          copyBtn.textContent = '\u2714 Copied!';
          copyBtn.classList.add('ip-copied');
          setTimeout(() => {
            copyBtn.textContent = '\uD83D\uDCCB Copy coordinates';
            copyBtn.classList.remove('ip-copied');
          }, 2000);
        }).catch(() => {
          copyBtn.textContent = 'Copy failed';
          setTimeout(() => {
            copyBtn.textContent = '\uD83D\uDCCB Copy coordinates';
          }, 2000);
        });
      });
    }

    panel.classList.add('ip-open');
    isOpen = true;
  }

  function hide(): void {
    panel.classList.remove('ip-open');
    isOpen = false;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && isOpen) {
      hide();
    }
  }
  document.addEventListener('keydown', onKeydown);

  document.body.appendChild(panel);

  return { element: panel, show, hide };
}
