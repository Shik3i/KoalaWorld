export function createMagnitudeLegend(): HTMLElement {
  const el = document.createElement('div');
  el.classList.add('kw-panel');
  el.style.cssText = `
    position: fixed;
    bottom: 60px;
    left: 16px;
    padding: 10px 14px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    opacity: 0.65;
    transition: opacity 0.25s ease;
    z-index: var(--kw-z-legend, 125);
  `;
  el.addEventListener('pointerenter', () => { el.style.opacity = '1'; });
  el.addEventListener('pointerleave', () => { el.style.opacity = '0.65'; });

  const items: { label: string; color: string; size: string }[] = [
    { label: '< 3.0', color: '#22c55e', size: '7px' },
    { label: '3.0 \u2013 5.0', color: '#eab308', size: '9px' },
    { label: '5.0 \u2013 6.0', color: '#f97316', size: '11px' },
    { label: '\u2265 6.0', color: '#ef4444', size: '13px' },
  ];

  for (const item of items) {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 10px;';

    const dot = document.createElement('span');
    dot.style.cssText = `
      width: ${item.size};
      height: ${item.size};
      border-radius: 50%;
      background: ${item.color};
      flex-shrink: 0;
      box-shadow: 0 0 6px ${item.color}44;
    `;
    row.appendChild(dot);

    const label = document.createElement('span');
    label.textContent = item.label;
    label.style.cssText = 'font-size: 11px; color: var(--kw-text-secondary, #8b8fa8); font-weight: 500;';
    row.appendChild(label);

    el.appendChild(row);
  }

  document.body.appendChild(el);
  return el;
}
