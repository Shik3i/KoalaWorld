export function createMagnitudeLegend(): HTMLElement {
  const el = document.createElement('div');
  el.classList.add('kw-panel', 'kw-mag-legend');
  el.style.cssText = `
    position: fixed;
    bottom: 82px;
    left: 50%;
    transform: translateX(-50%);
    padding: 8px 16px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 14px;
    opacity: 0.7;
    transition: opacity 0.25s ease;
    z-index: var(--kw-z-legend, 115);
    pointer-events: auto;
  `;
  el.addEventListener('pointerenter', () => { el.style.opacity = '1'; });
  el.addEventListener('pointerleave', () => { el.style.opacity = '0.7'; });

  const items: { label: string; color: string; size: string }[] = [
    { label: '< 3.0', color: '#22c55e', size: '7px' },
    { label: '3.0\u20135.0', color: '#eab308', size: '9px' },
    { label: '5.0\u20136.0', color: '#f97316', size: '11px' },
    { label: '\u22656.0', color: '#ef4444', size: '13px' },
  ];

  for (const item of items) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 6px;';

    const dot = document.createElement('span');
    dot.style.cssText = `
      width: ${item.size};
      height: ${item.size};
      border-radius: 50%;
      background: ${item.color};
      flex-shrink: 0;
      box-shadow: 0 0 5px ${item.color}66;
    `;
    row.appendChild(dot);

    const label = document.createElement('span');
    label.textContent = item.label;
    label.style.cssText = 'font-size: 11px; color: var(--kw-text-secondary, #8b8fa8); font-weight: 500; white-space: nowrap;';
    row.appendChild(label);

    el.appendChild(row);
  }

  return el;
}
