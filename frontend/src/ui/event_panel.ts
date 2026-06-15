import type { GeoEvent } from '../types';

export interface EventPanelCallbacks {
  onEventClick: (event: GeoEvent) => void;
  onEventHover: (event: GeoEvent | null) => void;
  onPageChange: (page: number) => void;
  onExportCSV: () => void;
}

export interface EventPanelState {
  events: GeoEvent[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  loading: boolean;
  sortBy: 'magnitude' | 'time' | 'depth' | 'location';
  sortDir: 'asc' | 'desc';
}

function formatRelativeTime(isoString: string): string {
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

function getMagnitudeClass(mag: number): string {
  if (mag < 3) return 'kw-badge-low';
  if (mag < 5) return 'kw-badge-medium';
  if (mag < 6) return 'kw-badge-high';
  return 'kw-badge-severe';
}

function formatLocation(place: string): string {
  if (place.length <= 30) return place;
  return place.slice(0, 28) + '\u2026';
}

function sortEvents(events: GeoEvent[], sortBy: EventPanelState['sortBy'], sortDir: EventPanelState['sortDir']): GeoEvent[] {
  const sorted = [...events];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'magnitude':
        cmp = (a.magnitude ?? 0) - (b.magnitude ?? 0);
        break;
      case 'time':
        cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        break;
      case 'depth':
        cmp = (a.depth_km ?? 0) - (b.depth_km ?? 0);
        break;
      case 'location': {
        const placeA = ((a.metadata as Record<string, unknown> | undefined)?.place as string) || '';
        const placeB = ((b.metadata as Record<string, unknown> | undefined)?.place as string) || '';
        cmp = placeA.localeCompare(placeB);
        break;
      }
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
  return sorted;
}

const VIRTUAL_SCROLL_THRESHOLD = 200;
const ROW_HEIGHT = 44;
const BUFFER_ROWS = 10;

function createRow(ev: GeoEvent, callbacks: EventPanelCallbacks): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = `
    display: grid;
    grid-template-columns: 56px 1fr 56px 80px;
    gap: 4px;
    padding: 10px 16px;
    align-items: center;
    cursor: pointer;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    transition: background 0.15s;
    height: ${ROW_HEIGHT}px;
    box-sizing: border-box;
  `;
  row.dataset.eventId = String(ev.id);

  row.addEventListener('click', () => callbacks.onEventClick(ev));
  row.addEventListener('pointerenter', () => callbacks.onEventHover(ev));
  row.addEventListener('pointerleave', () => callbacks.onEventHover(null));
  row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.05)'; });
  row.addEventListener('mouseleave', () => { row.style.background = ''; });

  const magBadge = document.createElement('span');
  const magClass = getMagnitudeClass(ev.magnitude ?? 0);
  magBadge.classList.add('kw-badge', magClass);
  magBadge.textContent = ev.magnitude != null ? ev.magnitude.toFixed(1) : 'N/A';

  const loc = document.createElement('span');
  const place = ((ev.metadata as Record<string, unknown> | undefined)?.place as string) || 'Unknown';
  loc.textContent = formatLocation(place);
  loc.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px;';

  const depth = document.createElement('span');
  depth.textContent = ev.depth_km != null ? ev.depth_km.toFixed(0) + ' km' : '-';
  depth.style.cssText = 'font-size: 12px; color: #aaa;';

  const time = document.createElement('span');
  time.textContent = formatRelativeTime(ev.timestamp);
  time.style.cssText = 'font-size: 12px; color: #aaa;';

  row.appendChild(magBadge);
  row.appendChild(loc);
  row.appendChild(depth);
  row.appendChild(time);

  return row;
}

export function createEventPanel(
  callbacks: EventPanelCallbacks
): { element: HTMLElement; update: (state: EventPanelState) => void; toggle: () => void; setOpen: (open: boolean) => void } {
  let isOpen = false;
  let state: EventPanelState = {
    events: [],
    totalCount: 0,
    currentPage: 1,
    pageSize: 100,
    loading: false,
    sortBy: 'time',
    sortDir: 'desc',
  };

  let sortedEvents: GeoEvent[] = [];
  let scrollRafId: number | null = null;

  const toggleBtn = document.createElement('button');
  toggleBtn.classList.add('kw-btn');
  toggleBtn.textContent = '\uD83D\uDCCB Events';
  toggleBtn.style.cssText = `
    position: fixed;
    bottom: 62px;
    right: 16px;
    z-index: var(--kw-z-event-panel-toggle, 140);
  `;

  const panel = document.createElement('div');
  panel.classList.add('kw-panel', 'kw-scrollbar');
  panel.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 380px;
    height: 100vh;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    box-shadow: -4px 0 24px rgba(0,0,0,0.3);
    z-index: var(--kw-z-event-panel, 145);
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
  `;

  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';

  const title = document.createElement('span');
  title.textContent = 'Events';
  title.style.cssText = 'font-weight: 600; font-size: 15px; color: #fff;';

  const badge = document.createElement('span');
  badge.classList.add('kw-badge');
  badge.style.cssText = 'background: rgba(68,136,255,0.2); color: #4488ff; font-size: 11px;';

  titleRow.appendChild(title);
  titleRow.appendChild(badge);
  header.appendChild(titleRow);

  const closeBtn = document.createElement('button');
  closeBtn.classList.add('kw-btn', 'kw-btn-icon');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = 'font-size: 18px;';
  closeBtn.setAttribute('aria-label', 'Close panel');
  closeBtn.addEventListener('click', () => setOpen(false));

  header.appendChild(closeBtn);
  panel.appendChild(header);

  const colHeader = document.createElement('div');
  colHeader.style.cssText = `
    display: grid;
    grid-template-columns: 56px 1fr 56px 80px;
    gap: 4px;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  `;

  const columns: { key: EventPanelState['sortBy']; label: string }[] = [
    { key: 'magnitude', label: 'Mag' },
    { key: 'location', label: 'Location' },
    { key: 'depth', label: 'Depth' },
    { key: 'time', label: 'Time' },
  ];

  for (const col of columns) {
    const colBtn = document.createElement('button');
    colBtn.classList.add('kw-btn');
    colBtn.textContent = col.label;
    colBtn.style.cssText = `
      background: none;
      border: none;
      color: #888;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      padding: 4px;
      cursor: pointer;
      text-align: left;
    `;
    colBtn.setAttribute('aria-label', `Sort by ${col.label}`);
    colBtn.dataset.sortKey = col.key;

    colBtn.addEventListener('click', () => {
      const key = col.key;
      if (state.sortBy === key) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortBy = key;
        state.sortDir = 'desc';
      }
      state.currentPage = 1;
      render();
    });

    colHeader.appendChild(colBtn);
  }

  panel.appendChild(colHeader);

  const tableBody = document.createElement('div');
  tableBody.style.cssText = `
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  `;

  function renderEmpty() {
    tableBody.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#666;gap:12px;padding:40px;">
        <span style="font-size:48px;">\uD83D\uDCED</span>
        <span style="font-size:14px;">No events match your filters</span>
      </div>
    `;
  }

  function renderSkeleton() {
    let html = '';
    for (let i = 0; i < 8; i++) {
      html += `
        <div style="display:grid;grid-template-columns:56px 1fr 56px 80px;gap:4px;padding:10px 16px;align-items:center;">
          <div class="kw-skeleton" style="height:20px;"></div>
          <div class="kw-skeleton" style="height:16px;"></div>
          <div class="kw-skeleton" style="height:16px;"></div>
          <div class="kw-skeleton" style="height:16px;"></div>
        </div>
      `;
    }
    tableBody.innerHTML = html;
  }

  function renderPagination() {
    const totalPages = Math.max(1, Math.ceil(state.totalCount / state.pageSize));
    const pag = document.createElement('div');
    pag.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 10px 16px;
      border-top: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    `;

    const prevBtn = document.createElement('button');
    prevBtn.classList.add('kw-btn');
    prevBtn.textContent = '\u2190 Previous';
    prevBtn.disabled = state.currentPage <= 1;
    prevBtn.style.cssText = prevBtn.disabled ? 'opacity:0.4;' : '';
    prevBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        callbacks.onPageChange(state.currentPage);
        render();
      }
    });

    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
    pageInfo.style.cssText = 'font-size: 12px; color: #999;';

    const nextBtn = document.createElement('button');
    nextBtn.classList.add('kw-btn');
    nextBtn.textContent = 'Next \u2192';
    nextBtn.disabled = state.currentPage >= totalPages;
    nextBtn.style.cssText = nextBtn.disabled ? 'opacity:0.4;' : '';
    nextBtn.addEventListener('click', () => {
      if (state.currentPage < totalPages) {
        state.currentPage++;
        callbacks.onPageChange(state.currentPage);
        render();
      }
    });

    pag.appendChild(prevBtn);
    pag.appendChild(pageInfo);
    pag.appendChild(nextBtn);
    return pag;
  }

  function renderExportBtn(): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.classList.add('kw-btn');
    btn.textContent = 'Export CSV';
    btn.style.cssText = 'margin: 0 16px 8px;';
    btn.addEventListener('click', () => {
      const sorted = sortEvents(state.events, state.sortBy, state.sortDir);
      const headerRow = 'Magnitude,Location,Depth (km),Time,Latitude,Longitude,Source';
      const rows = sorted.map((ev) => {
        const place = ((ev.metadata as Record<string, unknown> | undefined)?.place as string) || '';
        return [
          ev.magnitude ?? '',
          `"${place.replace(/"/g, '""')}"`,
          ev.depth_km ?? '',
          ev.timestamp,
          ev.latitude.toFixed(4),
          ev.longitude.toFixed(4),
          ev.source,
        ].join(',');
      });
      const csv = [headerRow, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `koalaworld-events-${new Date().toISOString().slice(0, 10)}.csv`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      callbacks.onExportCSV();
    });
    return btn;
  }

  function renderAllRows() {
    const frag = document.createDocumentFragment();
    for (const ev of sortedEvents) {
      frag.appendChild(createRow(ev, callbacks));
    }
    tableBody.appendChild(frag);
    tableBody.scrollTop = 0;
  }

  function renderVirtualRows() {
    tableBody.innerHTML = '';

    const scrollTop = tableBody.scrollTop;
    const viewportHeight = tableBody.clientHeight || 400;

    const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
    const endIdx = Math.min(sortedEvents.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER_ROWS);

    const topSpacer = document.createElement('div');
    topSpacer.style.height = `${startIdx * ROW_HEIGHT}px`;
    topSpacer.style.flexShrink = '0';
    tableBody.appendChild(topSpacer);

    const frag = document.createDocumentFragment();
    for (let i = startIdx; i < endIdx; i++) {
      frag.appendChild(createRow(sortedEvents[i], callbacks));
    }
    tableBody.appendChild(frag);

    const bottomSpacer = document.createElement('div');
    bottomSpacer.style.height = `${(sortedEvents.length - endIdx) * ROW_HEIGHT}px`;
    bottomSpacer.style.flexShrink = '0';
    tableBody.appendChild(bottomSpacer);
  }

  function renderBody() {
    tableBody.innerHTML = '';
    if (state.loading) {
      renderSkeleton();
    } else if (state.events.length === 0) {
      renderEmpty();
    } else if (sortedEvents.length > VIRTUAL_SCROLL_THRESHOLD) {
      renderVirtualRows();
    } else {
      renderAllRows();
    }
  }

  function updateFooter() {
    const oldPag = panel.querySelector('[data-pagination]');
    if (oldPag) oldPag.remove();
    const oldExport = panel.querySelector('[data-export]');
    if (oldExport) oldExport.remove();

    if (!state.loading && state.events.length > 0) {
      const exportBtn = renderExportBtn();
      exportBtn.dataset.export = '1';
      panel.appendChild(exportBtn);

      const pagination = renderPagination();
      pagination.dataset.pagination = '1';
      panel.appendChild(pagination);
    }
  }

  function render() {
    badge.textContent = String(state.totalCount);

    const headerBtns = colHeader.querySelectorAll('button');
    headerBtns.forEach((btn) => {
      const el = btn as HTMLButtonElement;
      const key = el.dataset.sortKey as EventPanelState['sortBy'];
      let label = el.textContent || '';
      label = label.replace(/ [\u25BC\u25B2]$/, '');
      if (key === state.sortBy) {
        label += ' ' + (state.sortDir === 'asc' ? '\u25B2' : '\u25BC');
      }
      el.textContent = label;
      el.style.color = key === state.sortBy ? '#4488ff' : '#888';
    });

    sortedEvents = sortEvents(state.events, state.sortBy, state.sortDir);
    renderBody();
    updateFooter();
  }

  function onTableScroll() {
    if (sortedEvents.length > VIRTUAL_SCROLL_THRESHOLD && scrollRafId === null) {
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null;
        renderBody();
      });
    }
  }

  tableBody.addEventListener('scroll', onTableScroll, { passive: true });

  function setOpen(open: boolean) {
    isOpen = open;
    if (open) {
      panel.style.transform = 'translateX(0)';
      toggleBtn.style.display = 'none';
    } else {
      panel.style.transform = 'translateX(100%)';
      toggleBtn.style.display = '';
    }
  }

  function toggle() {
    setOpen(!isOpen);
  }

  toggleBtn.addEventListener('click', () => setOpen(true));

  function reposition() {
    if (window.innerWidth < 768) {
      panel.style.top = 'auto';
      panel.style.bottom = '0';
      panel.style.left = '0';
      panel.style.right = '0';
      panel.style.width = '100%';
      panel.style.height = '60vh';
      panel.style.borderRadius = '16px 16px 0 0';
      if (!isOpen) {
        panel.style.transform = 'translateY(100%)';
      }
      toggleBtn.style.bottom = '110px';
    } else {
      panel.style.top = '0';
      panel.style.bottom = 'auto';
      panel.style.left = 'auto';
      panel.style.right = '0';
      panel.style.width = '380px';
      panel.style.height = '100vh';
      panel.style.borderRadius = '0';
      if (!isOpen) {
        panel.style.transform = 'translateX(100%)';
      }
      toggleBtn.style.bottom = '62px';
    }
  }
  window.addEventListener('resize', reposition);

  document.body.appendChild(panel);
  document.body.appendChild(toggleBtn);

  function update(newState: EventPanelState) {
    state = newState;
    render();
  }

  reposition();

  return { element: panel, update, toggle, setOpen };
}
