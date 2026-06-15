import type { GeoEvent } from './types';

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
    checkbox.addEventListener('change', () => onToggle(ctrl.id, checkbox.checked));

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(ctrl.label));
    container.appendChild(label);
  }

  return container;
}

export function createPopup(): { show: (event: GeoEvent, x: number, y: number) => void; hide: () => void } {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute;
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

  function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

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
  } else {
    document.body.style.backgroundColor = '#000';
    document.querySelectorAll('.koala-ui').forEach(el => {
      (el as HTMLElement).style.background = 'rgba(0,0,0,0.7)';
      (el as HTMLElement).style.color = '#ccc';
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
