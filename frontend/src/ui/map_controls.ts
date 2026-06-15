export interface MapControlsCallbacks {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFullscreen: () => void;
}

const CSS = `
.mc-container {
  position: fixed;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px;
  border-radius: 24px;
  z-index: var(--kw-z-map-controls, 110);
}
.mc-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.04);
  color: var(--kw-text-secondary, #8b8fa8);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: var(--kw-font, 'Inter', sans-serif);
  position: relative;
}
.mc-btn:hover {
  background: rgba(255,255,255,0.1);
  color: var(--kw-text, #e8eaf0);
  transform: scale(1.08);
  box-shadow: 0 0 12px rgba(59,130,246,0.15);
}
.mc-btn:active {
  transform: scale(0.95);
}
.mc-btn::after {
  content: attr(data-tooltip);
  position: absolute;
  right: 52px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(10,12,24,0.92);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.08);
  color: var(--kw-text, #e8eaf0);
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 11px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
  font-weight: 500;
}
.mc-btn:hover::after {
  opacity: 1;
}
@media (max-width: 600px) {
  .mc-container {
    top: auto;
    bottom: 16px;
    right: 14px;
    transform: none;
    flex-direction: row;
    gap: 6px;
    border-radius: 20px;
  }
  .mc-btn::after {
    display: none;
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

export function createMapControls(callbacks: MapControlsCallbacks): HTMLElement {
  ensureStyles();

  const container = document.createElement('div');
  container.className = 'mc-container kw-panel';

  const btns: { label: string; action: () => void; tooltip: string }[] = [
    { label: '+', action: callbacks.onZoomIn, tooltip: 'Zoom in' },
    { label: '\u2212', action: callbacks.onZoomOut, tooltip: 'Zoom out' },
    { label: '\u2302', action: callbacks.onReset, tooltip: 'Reset view' },
    { label: '\u26F6', action: callbacks.onFullscreen, tooltip: 'Fullscreen' },
  ];

  for (const btn of btns) {
    const b = document.createElement('button');
    b.className = 'mc-btn';
    b.textContent = btn.label;
    b.setAttribute('data-tooltip', btn.tooltip);
    b.setAttribute('aria-label', btn.tooltip);
    b.addEventListener('click', btn.action);
    container.appendChild(b);
  }

  document.body.appendChild(container);
  return container;
}
