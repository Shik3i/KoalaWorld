import type { GlobeTheme } from '../themes/types';
import { getThemes, getCurrentTheme, applyGlobeTheme } from '../globe';

export interface SidebarCallbacks {
  onThemeChange: (themeId: string) => void;
  onLayerToggle: (layerId: string, visible: boolean) => void;
  onFilterApply: (filters: FilterValues) => void;
  onFilterReset: () => void;
}

export interface FilterValues {
  query: string;
  minMag: string;
  maxMag: string;
  dateFrom: string;
  dateTo: string;
}

export interface LayerState {
  id: string;
  label: string;
  visible: boolean;
  count?: number;
}

export interface SidebarStats {
  totalEvents: number;
  strongestMag: number | null;
  eventsInView: number;
}

function themeColor(theme: GlobeTheme): string {
  const c = theme.earthFallbackColor;
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return `rgb(${r},${g},${b})`;
}

function themeSecondaryColor(theme: GlobeTheme): string {
  const c = theme.gridColor;
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return `rgb(${r},${g},${b})`;
}

const STORAGE_KEY = 'koalaworld-sidebar-collapsed';

export function createSidebar(
  layers: LayerState[],
  filters: FilterValues,
  callbacks: SidebarCallbacks,
  stats?: SidebarStats
): HTMLElement {
  const isCollapsed = localStorage.getItem(STORAGE_KEY) === 'true';
  const themes = getThemes();
  let currentThemeId = getCurrentTheme().id;

  const container = document.createElement('div');
  container.className = 'kw-sidebar-container';
  container.setAttribute('role', 'complementary');
  container.setAttribute('aria-label', 'Sidebar');

  const expanded = document.createElement('div');
  expanded.className = 'kw-sidebar-panel kw-panel kw-scroll';
  expanded.classList.toggle('kw-sidebar-hidden', isCollapsed);
  expanded.setAttribute('tabindex', '0');

  const collapsed = document.createElement('div');
  collapsed.className = 'kw-sidebar-collapsed kw-panel';
  collapsed.classList.toggle('kw-sidebar-hidden', !isCollapsed);
  collapsed.setAttribute('aria-label', 'Sidebar collapsed');

  function saveCollapsed(state: boolean): void {
    localStorage.setItem(STORAGE_KEY, String(state));
  }

  function setCollapsed(state: boolean): void {
    expanded.classList.toggle('kw-sidebar-hidden', state);
    collapsed.classList.toggle('kw-sidebar-hidden', !state);
    saveCollapsed(state);
    if (!state) {
      expanded.focus();
    }
  }

  function toggleCollapsed(): void {
    const isHidden = expanded.classList.contains('kw-sidebar-hidden');
    setCollapsed(!isHidden);
  }

  // ---- EXPANDED PANEL ----

  // Header
  const header = document.createElement('div');
  header.className = 'kw-sidebar-header';

  const logo = document.createElement('div');
  logo.className = 'kw-sidebar-logo';
  const logoIcon = document.createElement('span');
  logoIcon.className = 'kw-sidebar-logo-icon';
  logoIcon.textContent = '\u{1F310}';
  const logoText = document.createElement('span');
  logoText.className = 'kw-sidebar-logo-text';
  logoText.textContent = 'KoalaWorld';
  logo.appendChild(logoIcon);
  logo.appendChild(logoText);
  header.appendChild(logo);

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'kw-btn kw-btn-icon kw-btn-ghost kw-sidebar-collapse-btn';
  collapseBtn.innerHTML = '\u2630';
  collapseBtn.setAttribute('aria-label', 'Collapse sidebar');
  collapseBtn.addEventListener('click', toggleCollapsed);
  header.appendChild(collapseBtn);

  expanded.appendChild(header);

  // Content wrapper
  const content = document.createElement('div');
  content.className = 'kw-sidebar-content';

  // Theme section
  const themesSection = document.createElement('div');
  themesSection.className = 'kw-sidebar-section';
  const themesTitle = document.createElement('div');
  themesTitle.className = 'kw-section-title';
  themesTitle.textContent = 'Theme';
  themesSection.appendChild(themesTitle);

  const themeGrid = document.createElement('div');
  themeGrid.className = 'kw-theme-grid';
  themeGrid.setAttribute('role', 'radiogroup');
  themeGrid.setAttribute('aria-label', 'Select globe theme');

  function renderThemes(): void {
    themeGrid.innerHTML = '';
    currentThemeId = getCurrentTheme().id;
    for (const theme of themes) {
      const item = document.createElement('button');
      item.className = 'kw-theme-item';
      item.setAttribute('role', 'radio');
      item.setAttribute('aria-checked', String(theme.id === currentThemeId));
      item.setAttribute('aria-label', theme.name);
      item.title = theme.name;

      const swatch = document.createElement('span');
      swatch.className = 'kw-theme-swatch';
      swatch.style.background = `linear-gradient(135deg, ${themeColor(theme)} 0%, ${themeSecondaryColor(theme)} 100%)`;

      const label = document.createElement('span');
      label.className = 'kw-theme-label';
      label.textContent = theme.name;

      item.appendChild(swatch);
      item.appendChild(label);

      if (theme.id === currentThemeId) {
        item.classList.add('kw-theme-active');
      }

      item.addEventListener('click', () => {
        applyGlobeTheme(theme.id);
        callbacks.onThemeChange(theme.id);
        renderThemes();
      });

      themeGrid.appendChild(item);
    }
  }
  renderThemes();
  themesSection.appendChild(themeGrid);
  content.appendChild(themesSection);

  const divider1 = document.createElement('div');
  divider1.className = 'kw-divider';
  content.appendChild(divider1);

  // Layers section
  const layersSection = document.createElement('div');
  layersSection.className = 'kw-sidebar-section';
  const layersTitle = document.createElement('div');
  layersTitle.className = 'kw-section-title';
  layersTitle.textContent = 'Layers';
  layersSection.appendChild(layersTitle);

  function buildLayerToggles(): void {
    while (layersSection.children.length > 1) {
      layersSection.removeChild(layersSection.lastChild!);
    }

    for (const layer of layers) {
      const toggle = document.createElement('label');
      toggle.className = 'kw-toggle';
      if (layer.count === 0) toggle.classList.add('kw-toggle-disabled');

      const track = document.createElement('span');
      track.className = 'kw-toggle-track';
      if (layer.visible) track.classList.add('active');

      const thumb = document.createElement('span');
      thumb.className = 'kw-toggle-thumb';
      track.appendChild(thumb);
      toggle.appendChild(track);

      const labelSpan = document.createElement('span');
      labelSpan.className = 'kw-toggle-label';
      labelSpan.textContent = layer.label + (layer.count === 0 ? ' (no data)' : '');
      toggle.appendChild(labelSpan);

      if (layer.count !== undefined && layer.count > 0) {
        const badge = document.createElement('span');
        badge.className = 'kw-badge';
        if (layer.count >= 100) badge.classList.add('kw-badge-high');
        else if (layer.count >= 10) badge.classList.add('kw-badge-medium');
        else badge.classList.add('kw-badge-low');
        badge.textContent = String(layer.count);
        toggle.appendChild(badge);
      }

      toggle.addEventListener('click', () => {
        const newVisible = !track.classList.contains('active');
        if (newVisible) {
          track.classList.add('active');
        } else {
          track.classList.remove('active');
        }
        callbacks.onLayerToggle(layer.id, newVisible);
      });

      layersSection.appendChild(toggle);
    }
  }

  buildLayerToggles();
  content.appendChild(layersSection);

  const divider2 = document.createElement('div');
  divider2.className = 'kw-divider';
  content.appendChild(divider2);

  // Filters section
  const filtersSection = document.createElement('div');
  filtersSection.className = 'kw-sidebar-section';
  const filtersTitle = document.createElement('div');
  filtersTitle.className = 'kw-section-title';
  filtersTitle.textContent = 'Filters';
  filtersSection.appendChild(filtersTitle);

  const currentFilters: FilterValues = { ...filters };

  const searchLabel = document.createElement('label');
  searchLabel.className = 'kw-label';
  searchLabel.textContent = 'Search';
  filtersSection.appendChild(searchLabel);

  const searchInput = document.createElement('input');
  searchInput.className = 'kw-input';
  searchInput.type = 'text';
  searchInput.placeholder = 'Search place...';
  searchInput.value = filters.query;
  searchInput.addEventListener('input', () => {
    currentFilters.query = searchInput.value;
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      callbacks.onFilterApply({ ...currentFilters });
    }
  });
  filtersSection.appendChild(searchInput);

  const magRow = document.createElement('div');
  magRow.className = 'kw-filter-row';

  const minMagWrap = document.createElement('div');
  minMagWrap.className = 'kw-filter-field';
  const minMagLabel = document.createElement('label');
  minMagLabel.className = 'kw-label';
  minMagLabel.textContent = 'Min Mag';
  const minMagInput = document.createElement('input');
  minMagInput.className = 'kw-input';
  minMagInput.type = 'number';
  minMagInput.placeholder = '0';
  minMagInput.min = '0';
  minMagInput.max = '10';
  minMagInput.step = '0.1';
  minMagInput.value = filters.minMag;
  minMagInput.addEventListener('input', () => {
    currentFilters.minMag = minMagInput.value;
  });
  minMagWrap.appendChild(minMagLabel);
  minMagWrap.appendChild(minMagInput);

  const maxMagWrap = document.createElement('div');
  maxMagWrap.className = 'kw-filter-field';
  const maxMagLabel = document.createElement('label');
  maxMagLabel.className = 'kw-label';
  maxMagLabel.textContent = 'Max Mag';
  const maxMagInput = document.createElement('input');
  maxMagInput.className = 'kw-input';
  maxMagInput.type = 'number';
  maxMagInput.placeholder = '10';
  maxMagInput.min = '0';
  maxMagInput.max = '10';
  maxMagInput.step = '0.1';
  maxMagInput.value = filters.maxMag;
  maxMagInput.addEventListener('input', () => {
    currentFilters.maxMag = maxMagInput.value;
  });
  maxMagWrap.appendChild(maxMagLabel);
  maxMagWrap.appendChild(maxMagInput);

  magRow.appendChild(minMagWrap);
  magRow.appendChild(maxMagWrap);
  filtersSection.appendChild(magRow);

  const dateRow = document.createElement('div');
  dateRow.className = 'kw-filter-row';

  const dateFromWrap = document.createElement('div');
  dateFromWrap.className = 'kw-filter-field';
  const dateFromLabel = document.createElement('label');
  dateFromLabel.className = 'kw-label';
  dateFromLabel.textContent = 'From';
  const dateFromInput = document.createElement('input');
  dateFromInput.className = 'kw-input';
  dateFromInput.type = 'date';
  dateFromInput.value = filters.dateFrom;
  dateFromInput.addEventListener('input', () => {
    currentFilters.dateFrom = dateFromInput.value;
  });
  dateFromWrap.appendChild(dateFromLabel);
  dateFromWrap.appendChild(dateFromInput);

  const dateToWrap = document.createElement('div');
  dateToWrap.className = 'kw-filter-field';
  const dateToLabel = document.createElement('label');
  dateToLabel.className = 'kw-label';
  dateToLabel.textContent = 'To';
  const dateToInput = document.createElement('input');
  dateToInput.className = 'kw-input';
  dateToInput.type = 'date';
  dateToInput.value = filters.dateTo;
  dateToInput.addEventListener('input', () => {
    currentFilters.dateTo = dateToInput.value;
  });
  dateToWrap.appendChild(dateToLabel);
  dateToWrap.appendChild(dateToInput);

  dateRow.appendChild(dateFromWrap);
  dateRow.appendChild(dateToWrap);
  filtersSection.appendChild(dateRow);

  const filterBtns = document.createElement('div');
  filterBtns.className = 'kw-filter-buttons';

  const applyBtn = document.createElement('button');
  applyBtn.className = 'kw-btn kw-btn-primary kw-btn-sm';
  applyBtn.textContent = 'Apply';
  applyBtn.addEventListener('click', () => {
    callbacks.onFilterApply({ ...currentFilters });
  });
  filterBtns.appendChild(applyBtn);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'kw-btn kw-btn-secondary kw-btn-sm';
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', () => {
    searchInput.value = '';
    minMagInput.value = '';
    maxMagInput.value = '';
    dateFromInput.value = '';
    dateToInput.value = '';
    currentFilters.query = '';
    currentFilters.minMag = '';
    currentFilters.maxMag = '';
    currentFilters.dateFrom = '';
    currentFilters.dateTo = '';
    callbacks.onFilterReset();
  });
  filterBtns.appendChild(resetBtn);

  filtersSection.appendChild(filterBtns);
  content.appendChild(filtersSection);

  // Stats section (always built, toggled visibility)
  const divider3 = document.createElement('div');
  divider3.className = 'kw-divider';
  content.appendChild(divider3);

  const statsSection = document.createElement('div');
  statsSection.className = 'kw-sidebar-section';
  const statsTitle = document.createElement('div');
  statsTitle.className = 'kw-section-title';
  statsTitle.textContent = 'Statistics';
  statsSection.appendChild(statsTitle);

  const statsGrid = document.createElement('div');
  statsGrid.className = 'kw-stats-grid';

  const totalVal = document.createElement('div');
  totalVal.className = 'kw-stat-value';
  const totalLbl = document.createElement('div');
  totalLbl.className = 'kw-stat-label';
  totalLbl.textContent = 'Total Events';

  const strongestVal = document.createElement('div');
  strongestVal.className = 'kw-stat-value';
  const strongestLbl = document.createElement('div');
  strongestLbl.className = 'kw-stat-label';
  strongestLbl.textContent = 'Strongest';

  const inViewVal = document.createElement('div');
  inViewVal.className = 'kw-stat-value';
  const inViewLbl = document.createElement('div');
  inViewLbl.className = 'kw-stat-label';
  inViewLbl.textContent = 'In View';

  function makeStatCard(valueEl: HTMLElement, labelEl: HTMLElement): HTMLDivElement {
    const card = document.createElement('div');
    card.className = 'kw-stat-card';
    card.appendChild(valueEl);
    card.appendChild(labelEl);
    return card;
  }

  statsGrid.appendChild(makeStatCard(totalVal, totalLbl));
  statsGrid.appendChild(makeStatCard(strongestVal, strongestLbl));
  statsGrid.appendChild(makeStatCard(inViewVal, inViewLbl));

  statsSection.appendChild(statsGrid);
  content.appendChild(statsSection);

  expanded.appendChild(content);

  // ---- COLLAPSED BAR ----

  const expandBtn = document.createElement('button');
  expandBtn.className = 'kw-btn kw-btn-icon kw-btn-ghost';
  expandBtn.innerHTML = '\u2630';
  expandBtn.setAttribute('aria-label', 'Expand sidebar');
  expandBtn.addEventListener('click', toggleCollapsed);
  collapsed.appendChild(expandBtn);

  const themeQuickBtn = document.createElement('button');
  themeQuickBtn.className = 'kw-btn kw-btn-icon kw-btn-ghost';
  themeQuickBtn.innerHTML = '\u{1F3A8}';
  themeQuickBtn.setAttribute('aria-label', 'Themes');
  themeQuickBtn.title = 'Themes';
  themeQuickBtn.addEventListener('click', () => {
    setCollapsed(false);
    themesSection.scrollIntoView({ behavior: 'smooth' });
  });
  collapsed.appendChild(themeQuickBtn);

  const layersQuickBtn = document.createElement('button');
  layersQuickBtn.className = 'kw-btn kw-btn-icon kw-btn-ghost';
  layersQuickBtn.innerHTML = '\u{1F4CA}';
  layersQuickBtn.setAttribute('aria-label', 'Layers');
  layersQuickBtn.title = 'Layers';
  layersQuickBtn.addEventListener('click', () => {
    setCollapsed(false);
    layersSection.scrollIntoView({ behavior: 'smooth' });
  });
  collapsed.appendChild(layersQuickBtn);

  const filterQuickBtn = document.createElement('button');
  filterQuickBtn.className = 'kw-btn kw-btn-icon kw-btn-ghost';
  filterQuickBtn.innerHTML = '\u{1F50D}';
  filterQuickBtn.setAttribute('aria-label', 'Filters');
  filterQuickBtn.title = 'Filters';
  filterQuickBtn.addEventListener('click', () => {
    setCollapsed(false);
    filtersSection.scrollIntoView({ behavior: 'smooth' });
  });
  collapsed.appendChild(filterQuickBtn);

  container.appendChild(expanded);
  container.appendChild(collapsed);

  expanded.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setCollapsed(true);
    }
  });

  function refreshStats(s: SidebarStats): void {
    totalVal.textContent = String(s.totalEvents);
    strongestVal.textContent = s.strongestMag != null ? s.strongestMag.toFixed(1) : 'N/A';
    inViewVal.textContent = String(s.eventsInView);
    const hasData = s.totalEvents > 0;
    divider3.style.display = hasData ? '' : 'none';
    statsSection.style.display = hasData ? '' : 'none';
  }

  if (stats) {
    refreshStats(stats);
  }

  (container as any).setCollapsed = setCollapsed;
  (container as any).toggleCollapsed = toggleCollapsed;
  (container as any).updateStats = (newStats: SidebarStats) => {
    refreshStats(newStats);
  };
  (container as any).updateLayerCounts = () => {
    buildLayerToggles();
  };

  return container;
}
