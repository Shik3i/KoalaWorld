import type { GeoEvent } from '../types';

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export interface LayerControl {
  id: string;
  label: string;
  visible: boolean;
}

export interface FilterState {
  query: string;
  minMag: string;
  maxMag: string;
  dateFrom: string;
  dateTo: string;
}

export function createLayerUI(
  controls: LayerControl[],
  onToggle: (id: string, visible: boolean) => void
): HTMLDivElement {
  const container = document.createElement('div');
  container.classList.add('koala-ui');
  container.style.cssText = `
    position: absolute;
    top: 16px;
    right: 16px;
    background: rgba(0,0,0,0.7);
    padding: 12px 16px;
    border-radius: 8px;
    color: #ccc;
    font-family: sans-serif;
    font-size: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 100;
    user-select: none;
  `;

  const title = document.createElement('div');
  title.textContent = 'Layers';
  title.style.cssText = 'font-weight: bold; color: #fff; margin-bottom: 4px;';
  container.appendChild(title);

  for (const ctrl of controls) {
    const label = document.createElement('label');
    label.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer;';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = ctrl.visible;
    checkbox.setAttribute('aria-label', `Toggle ${ctrl.label} layer`);
    checkbox.addEventListener('change', () => onToggle(ctrl.id, checkbox.checked));

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(ctrl.label));
    container.appendChild(label);
  }

  // Drag & drop reordering
  let dragItem: HTMLLabelElement | null = null;
  container.querySelectorAll('label').forEach(label => {
    (label as HTMLLabelElement).draggable = true;
    (label as HTMLLabelElement).addEventListener('dragstart', (e) => {
      dragItem = label as HTMLLabelElement;
      e.dataTransfer!.effectAllowed = 'move';
    });
    (label as HTMLLabelElement).addEventListener('dragover', (e) => {
      e.preventDefault();
      if (dragItem && dragItem !== label) {
        const rect = label.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const mouseY = (e as DragEvent).clientY;
        if (mouseY < mid) {
          container.insertBefore(dragItem, label);
        } else {
          container.insertBefore(dragItem, label.nextSibling);
        }
      }
    });
    (label as HTMLLabelElement).addEventListener('dragend', () => {
      dragItem = null;
      // Update controls order based on DOM order
      const newOrder: string[] = [];
      container.querySelectorAll('label').forEach(l => {
        const cb = l.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (cb) {
          const ctrl = controls.find(c => c.label === l.textContent?.trim());
          if (ctrl) newOrder.push(ctrl.id);
        }
      });
      // Reorder controls array
      if (newOrder.length === controls.length) {
        controls.sort((a, b) => newOrder.indexOf(a.id) - newOrder.indexOf(b.id));
      }
    });
  });

  function reposition() {
    if (window.innerWidth < 600) {
      container.style.top = 'auto';
      container.style.bottom = '16px';
      container.style.right = '16px';
      container.style.left = '16px';
      container.style.flexDirection = 'row';
      container.style.flexWrap = 'wrap';
    } else {
      container.style.top = '16px';
      container.style.bottom = 'auto';
      container.style.right = '16px';
      container.style.left = 'auto';
      container.style.flexDirection = 'column';
      container.style.flexWrap = 'nowrap';
    }
  }
  window.addEventListener('resize', reposition);
  reposition();

  return container;
}

export function createPopup(): { show: (event: GeoEvent, x: number, y: number) => void; hide: () => void } {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed;
    display: none;
    background: rgba(0,0,0,0.85);
    color: #fff;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: sans-serif;
    font-size: 13px;
    line-height: 1.5;
    z-index: 200;
    pointer-events: none;
    max-width: 280px;
    border: 1px solid rgba(255,255,255,0.15);
    touch-action: none;
  `;
  document.body.appendChild(el);

  function show(event: GeoEvent, x: number, y: number) {
    const place = (event.metadata as any)?.place || 'Unknown location';
    const url = (event.metadata as any)?.url;
    const mag = event.magnitude != null ? event.magnitude.toFixed(1) : 'N/A';
    const depth = event.depth_km != null ? event.depth_km.toFixed(1) + ' km' : 'N/A';
    const time = event.timestamp ? new Date(event.timestamp).toLocaleString() : 'N/A';

    el.innerHTML = `
      <div style="font-weight:bold;margin-bottom:4px;">${escapeHtml(place)}</div>
      <div>Magnitude: ${mag}</div>
      <div>Depth: ${depth}</div>
      <div>Time: ${time}</div>
      ${url ? `<div style="margin-top:4px;"><a href="${url}" target="_blank" style="color:#66aaff;pointer-events:auto;">View on USGS ↗</a></div>` : ''}
    `;
    el.style.display = 'block';
    el.style.left = (x + 12) + 'px';
    el.style.top = (y - 10) + 'px';

    const rect = el.getBoundingClientRect();
    if (rect.right > window.innerWidth) el.style.left = (x - rect.width - 12) + 'px';
    if (rect.bottom > window.innerHeight) el.style.top = (y - rect.height - 10) + 'px';
  }

  function hide() {
    el.style.display = 'none';
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.style.display !== 'none') hide();
  });

  return { show, hide };
}

export function createFilterUI(
  filters: FilterState,
  onChange: (filters: FilterState) => void,
  onApply: () => void
): HTMLDivElement {
  const container = document.createElement('div');
  container.classList.add('koala-ui');
  container.style.cssText = `
    position: absolute;
    top: 180px;
    right: 16px;
    background: rgba(0,0,0,0.7);
    padding: 12px 16px;
    border-radius: 8px;
    color: #ccc;
    font-family: sans-serif;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 100;
    user-select: none;
    min-width: 200px;
  `;
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Event filters');

  const title = document.createElement('div');
  title.textContent = 'Filters';
  title.style.cssText = 'font-weight: bold; color: #fff; margin-bottom: 4px;';
  container.appendChild(title);

  const fields: { label: string; key: keyof FilterState; type: string; placeholder: string }[] = [
    { label: 'Search place', key: 'query', type: 'text', placeholder: 'e.g. Tokyo' },
    { label: 'Min magnitude', key: 'minMag', type: 'number', placeholder: '' },
    { label: 'Max magnitude', key: 'maxMag', type: 'number', placeholder: '' },
    { label: 'From date', key: 'dateFrom', type: 'date', placeholder: '' },
    { label: 'To date', key: 'dateTo', type: 'date', placeholder: '' },
  ];

  const inputs: HTMLInputElement[] = [];

  for (const field of fields) {
    const label = document.createElement('label');
    label.style.cssText = 'display: flex; flex-direction: column; gap: 2px; font-size: 12px;';

    const span = document.createElement('span');
    span.textContent = field.label;
    label.appendChild(span);

    const input = document.createElement('input');
    input.type = field.type;
    input.placeholder = field.placeholder;
    input.value = (filters[field.key] as string) || '';
    input.style.cssText = `
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 4px;
      color: #fff;
      padding: 4px 8px;
      font-size: 13px;
      outline: none;
    `;
    input.addEventListener('input', () => {
      onChange({ ...filters, [field.key]: input.value });
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onApply(); });

    label.appendChild(input);
    container.appendChild(label);
    inputs.push(input);
  }

  const applyBtn = document.createElement('button');
  applyBtn.textContent = 'Apply';
  applyBtn.style.cssText = `
    background: #4488ff;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    margin-top: 4px;
  `;
  applyBtn.addEventListener('click', onApply);
  container.appendChild(applyBtn);

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear';
  clearBtn.style.cssText = `
    background: rgba(255,255,255,0.1);
    color: #ccc;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
  `;
  clearBtn.addEventListener('click', () => {
    const cleared: FilterState = { query: '', minMag: '', maxMag: '', dateFrom: '', dateTo: '' };
    onChange(cleared);
    inputs.forEach(inp => inp.value = '');
    onApply();
  });
  container.appendChild(clearBtn);

  function repositionFilters() {
    if (window.innerWidth < 600) {
      container.style.top = 'auto';
      container.style.bottom = '80px';
      container.style.right = '16px';
      container.style.left = '16px';
      container.style.minWidth = 'auto';
    } else {
      container.style.top = '180px';
      container.style.bottom = 'auto';
      container.style.right = '16px';
      container.style.left = 'auto';
      container.style.minWidth = '200px';
    }
  }
  window.addEventListener('resize', repositionFilters);
  repositionFilters();

  return container;
}

export function createThemeToggle(
  currentTheme: 'dark' | 'light',
  onToggle: (theme: 'dark' | 'light') => void
): HTMLDivElement {
  const container = document.createElement('div');
  container.classList.add('koala-ui');
  container.style.cssText = `
    position: absolute;
    top: 16px;
    left: 16px;
    background: rgba(0,0,0,0.7);
    padding: 8px 12px;
    border-radius: 8px;
    color: #ccc;
    font-family: sans-serif;
    font-size: 13px;
    z-index: 100;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 8px;
  `;

  const label = document.createElement('span');
  label.textContent = 'Theme:';
  container.appendChild(label);

  const btn = document.createElement('button');
  btn.textContent = currentTheme === 'dark' ? '☀️ Light' : '🌙 Dark';
  btn.style.cssText = `
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 4px;
    color: #fff;
    padding: 4px 10px;
    cursor: pointer;
    font-size: 13px;
  `;
  btn.addEventListener('click', () => {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    onToggle(next);
  });
  container.appendChild(btn);

  return container;
}

export function applyTheme(theme: 'dark' | 'light') {
  if (theme === 'light') {
    document.body.style.backgroundColor = '#f0f0f0';
    document.querySelectorAll('.koala-ui').forEach(el => {
      (el as HTMLElement).style.background = 'rgba(255,255,255,0.85)';
      (el as HTMLElement).style.color = '#333';
    });
    document.querySelectorAll('.koala-ui input, .koala-ui button').forEach(el => {
      (el as HTMLElement).style.color = '#333';
    });
    document.querySelectorAll('[role="dialog"]').forEach(el => {
      (el as HTMLElement).style.background = 'rgba(255,255,255,0.95)';
      (el as HTMLElement).style.color = '#333';
    });
  } else {
    document.body.style.backgroundColor = '#000';
    document.querySelectorAll('.koala-ui').forEach(el => {
      (el as HTMLElement).style.background = 'rgba(0,0,0,0.7)';
      (el as HTMLElement).style.color = '#ccc';
    });
    document.querySelectorAll('.koala-ui input, .koala-ui button').forEach(el => {
      (el as HTMLElement).style.color = '#ccc';
    });
    document.querySelectorAll('[role="dialog"]').forEach(el => {
      (el as HTMLElement).style.background = 'rgba(30,30,30,0.95)';
      (el as HTMLElement).style.color = '#fff';
    });
  }
  localStorage.setItem('koalaworld-theme', theme);
}

export function createAdminPanel(
  getStatus: () => { layers: { type: string; enabled: boolean; lastSync: string | null }[] }
): HTMLDivElement {
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = '📊 Status';
  toggleBtn.style.cssText = `
    position: absolute;
    bottom: 16px;
    right: 16px;
    background: rgba(0,0,0,0.7);
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 8px;
    color: #ccc;
    padding: 8px 14px;
    cursor: pointer;
    font-family: sans-serif;
    font-size: 13px;
    z-index: 100;
  `;

  const panel = document.createElement('div');
  panel.style.cssText = `
    position: absolute;
    bottom: 60px;
    right: 16px;
    background: rgba(0,0,0,0.85);
    padding: 12px 16px;
    border-radius: 8px;
    color: #ccc;
    font-family: monospace;
    font-size: 12px;
    z-index: 100;
    display: none;
    min-width: 250px;
    border: 1px solid rgba(255,255,255,0.15);
  `;

  function refresh() {
    const status = getStatus();
    let html = '<div style="font-weight:bold;margin-bottom:8px;color:#fff;">Feed Status</div>';
    for (const layer of status.layers) {
      const dot = layer.enabled ? '🟢' : '🔴';
      const sync = layer.lastSync ? new Date(layer.lastSync).toLocaleString() : 'never';
      html += `<div>${dot} ${layer.type} — last sync: ${sync}</div>`;
    }
    html += `<div style="margin-top:8px;color:#888;">Last updated: ${new Date().toLocaleTimeString()}</div>`;
    panel.innerHTML = html;
  }

  toggleBtn.addEventListener('click', () => {
    if (panel.style.display === 'none') {
      refresh();
      panel.style.display = 'block';
    } else {
      panel.style.display = 'none';
    }
  });

  setInterval(() => {
    if (panel.style.display !== 'none') refresh();
  }, 30000);

  const wrapper = document.createElement('div');
  wrapper.appendChild(toggleBtn);
  wrapper.appendChild(panel);
  return wrapper;
}

export function createEventModal(): { show: (event: GeoEvent) => void; hide: () => void } {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 300;
  `;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) hide(); });

  const modal = document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-label', 'Event details');
  modal.style.cssText = `
    background: rgba(30,30,30,0.95);
    color: #fff;
    border-radius: 12px;
    padding: 24px;
    max-width: 480px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    font-family: sans-serif;
    font-size: 14px;
    line-height: 1.6;
    border: 1px solid rgba(255,255,255,0.15);
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  `;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.setAttribute('aria-label', 'Close modal');
  closeBtn.style.cssText = `
    float: right;
    background: none;
    border: none;
    color: #999;
    font-size: 24px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  `;
  closeBtn.addEventListener('click', hide);
  modal.appendChild(closeBtn);

  const content = document.createElement('div');
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function show(event: GeoEvent) {
    const meta = event.metadata as Record<string, unknown>;
    const place = (meta?.place as string) || 'Unknown location';
    const url = (meta?.url as string) || '';
    const mag = event.magnitude != null ? event.magnitude.toFixed(2) : 'N/A';
    const depth = event.depth_km != null ? event.depth_km.toFixed(1) + ' km' : 'N/A';
    const time = event.timestamp ? new Date(event.timestamp).toLocaleString() : 'N/A';
    const source = event.source || 'N/A';
    const type = event.type || 'N/A';

    content.innerHTML = `
      <h2 style="margin:0 0 12px;font-size:18px;">${escapeHtml(place)}</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 8px;color:#999;">Magnitude</td><td style="padding:4px 8px;">${mag}</td></tr>
        <tr><td style="padding:4px 8px;color:#999;">Depth</td><td style="padding:4px 8px;">${depth}</td></tr>
        <tr><td style="padding:4px 8px;color:#999;">Time</td><td style="padding:4px 8px;">${time}</td></tr>
        <tr><td style="padding:4px 8px;color:#999;">Source</td><td style="padding:4px 8px;">${escapeHtml(source)}</td></tr>
        <tr><td style="padding:4px 8px;color:#999;">Type</td><td style="padding:4px 8px;">${escapeHtml(type)}</td></tr>
        <tr><td style="padding:4px 8px;color:#999;">Latitude</td><td style="padding:4px 8px;">${event.latitude.toFixed(4)}</td></tr>
        <tr><td style="padding:4px 8px;color:#999;">Longitude</td><td style="padding:4px 8px;">${event.longitude.toFixed(4)}</td></tr>
      </table>
      ${url ? `<div style="margin-top:12px;"><a href="${url}" target="_blank" style="color:#66aaff;">View on USGS ↗</a></div>` : ''}
      <button style="margin-top:16px;width:100%;padding:8px;background:#4488ff;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;" onclick="this.closest('[role=dialog]').parentElement.style.display='none'">Close</button>
    `;
    overlay.style.display = 'flex';
  }

  function hide() {
    overlay.style.display = 'none';
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.style.display !== 'none') hide();
  });

  return { show, hide };
}

export function createLoadingIndicator(): { show: () => void; hide: () => void } {
  const el = document.createElement('div');
  el.id = 'koala-loading';
  el.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.75);
    color: #fff;
    padding: 16px 24px;
    border-radius: 8px;
    font-family: sans-serif;
    font-size: 14px;
    z-index: 500;
    display: none;
    pointer-events: none;
  `;
  el.textContent = 'Loading events...';
  document.body.appendChild(el);

  return {
    show: () => { el.style.display = 'block'; },
    hide: () => { el.style.display = 'none'; },
  };
}

export function createOfflineBanner(): HTMLDivElement {
  const el = document.createElement('div');
  el.id = 'koala-offline';
  el.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #e74c3c;
    color: #fff;
    text-align: center;
    padding: 8px;
    font-family: sans-serif;
    font-size: 13px;
    z-index: 999;
    display: none;
  `;
  el.textContent = '⚠️ Backend offline — some features may be unavailable';
  document.body.appendChild(el);
  return el;
}

export function createAPIStatusMonitor(online: () => void, offline: () => void): { start: () => void; stop: () => void } {
  let interval: ReturnType<typeof setInterval> | null = null;
  let lastOnline = true;

  async function check() {
    try {
      const res = await fetch('/api/healthz');
      if (res.ok) {
        if (!lastOnline) { lastOnline = true; online(); }
      } else {
        if (lastOnline) { lastOnline = false; offline(); }
      }
    } catch {
      if (lastOnline) { lastOnline = false; offline(); }
    }
  }

  return {
    start: () => { interval = setInterval(check, 15000); check(); },
    stop: () => { if (interval) clearInterval(interval); },
  };
}

export function createTimelineSlider(
  minDate: string,
  maxDate: string,
  onChange: (from: string, to: string) => void
): HTMLDivElement {
  const container = document.createElement('div');
  container.classList.add('koala-ui');
  container.style.cssText = `
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.7);
    padding: 12px 16px;
    border-radius: 8px;
    color: #ccc;
    font-family: sans-serif;
    font-size: 12px;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 12px;
    user-select: none;
    min-width: 300px;
    max-width: 90vw;
  `;

  const label = document.createElement('span');
  label.textContent = 'Time:';
  label.style.cssText = 'font-size: 12px; color: #999; white-space: nowrap;';
  container.appendChild(label);

  const rangeFrom = document.createElement('input');
  rangeFrom.type = 'range';
  rangeFrom.min = '0';
  rangeFrom.max = '100';
  rangeFrom.value = '0';
  container.appendChild(rangeFrom);

  const dateLabel = document.createElement('span');
  dateLabel.style.cssText = 'font-size: 11px; color: #999; min-width: 160px; text-align: center;';
  dateLabel.textContent = `${minDate} — ${maxDate}`;
  container.appendChild(dateLabel);

  const rangeTo = document.createElement('input');
  rangeTo.type = 'range';
  rangeTo.min = '0';
  rangeTo.max = '100';
  rangeTo.value = '100';
  container.appendChild(rangeTo);

  function update() {
    const f = parseInt(rangeFrom.value) / 100;
    const t = parseInt(rangeTo.value) / 100;
    if (f > t) { rangeFrom.value = rangeTo.value; return; }
    const min = new Date(minDate).getTime();
    const max = new Date(maxDate).getTime();
    const range = max - min;
    const fromDate = new Date(min + f * range).toISOString();
    const toDate = new Date(min + t * range).toISOString();
    dateLabel.textContent = `${fromDate.slice(0, 10)} — ${toDate.slice(0, 10)}`;
    onChange(fromDate, toDate);
  }

  rangeFrom.addEventListener('input', update);
  rangeTo.addEventListener('input', update);

  // Responsive
  function repositionSlider() {
    if (window.innerWidth < 600) {
      container.style.left = '16px';
      container.style.right = '16px';
      container.style.transform = 'none';
      container.style.minWidth = 'auto';
    } else {
      container.style.left = '50%';
      container.style.right = 'auto';
      container.style.transform = 'translateX(-50%)';
      container.style.minWidth = '300px';
    }
  }
  window.addEventListener('resize', repositionSlider);
  repositionSlider();

  return container;
}
