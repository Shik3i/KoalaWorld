export interface BottomBarCallbacks {
  onTimeRangeChange: (from: string, to: string) => void;
  onPlayToggle: (playing: boolean) => void;
  onSpeedChange: (speed: number) => void;
}

export interface BottomBarState {
  minDate: string;
  maxDate: string;
  currentFrom: string;
  currentTo: string;
  playing: boolean;
  speed: number;
  eventTimestamps?: string[];
}

export function createBottomBar(
  callbacks: BottomBarCallbacks
): { element: HTMLElement; update: (state: BottomBarState) => void } {
  let state: BottomBarState = {
    minDate: '2000-01-01T00:00:00Z',
    maxDate: new Date().toISOString(),
    currentFrom: '2000-01-01T00:00:00Z',
    currentTo: new Date().toISOString(),
    playing: false,
    speed: 1,
  };

  const container = document.createElement('div');
  container.classList.add('kw-panel');
  container.style.cssText = `
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 16px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 150;
    min-width: 320px;
    max-width: 90vw;
  `;

  // Top row: play + speed + date labels
  const topRow = document.createElement('div');
  topRow.style.cssText = 'display: flex; align-items: center; gap: 10px;';

  const playBtn = document.createElement('button');
  playBtn.classList.add('kw-btn', 'kw-btn-icon');
  playBtn.textContent = '\u25B6';
  playBtn.title = 'Play/Pause time animation';
  playBtn.addEventListener('click', () => {
    state.playing = !state.playing;
    callbacks.onPlayToggle(state.playing);
    render();
  });

  const speedBtns = [1, 2, 5, 10];
  const speedContainer = document.createElement('div');
  speedContainer.style.cssText = 'display: flex; gap: 2px;';

  for (const speed of speedBtns) {
    const sBtn = document.createElement('button');
    sBtn.classList.add('kw-btn');
    sBtn.textContent = `${speed}x`;
    sBtn.style.cssText = 'padding: 4px 8px; font-size: 11px;';
    sBtn.addEventListener('click', () => {
      state.speed = speed;
      callbacks.onSpeedChange(speed);
      render();
    });
    sBtn.dataset.speed = String(speed);
    speedContainer.appendChild(sBtn);
  }

  const dateDisplay = document.createElement('span');
  dateDisplay.style.cssText = 'font-size: 11px; color: #999; margin-left: auto; white-space: nowrap;';

  topRow.appendChild(playBtn);
  topRow.appendChild(speedContainer);
  topRow.appendChild(dateDisplay);
  container.appendChild(topRow);

  // Timeline track
  const trackWrapper = document.createElement('div');
  trackWrapper.style.cssText = 'position: relative; height: 40px;';

  // Sparkline canvas
  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0.3; pointer-events: none;';
  sparkCanvas.width = 600;
  sparkCanvas.height = 40;
  trackWrapper.appendChild(sparkCanvas);

  // Track background
  const track = document.createElement('div');
  track.style.cssText = `
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 6px;
    background: rgba(255,255,255,0.08);
    border-radius: 3px;
  `;
  trackWrapper.appendChild(track);

  // Filled track
  const filledTrack = document.createElement('div');
  filledTrack.style.cssText = `
    position: absolute;
    bottom: 0;
    height: 6px;
    background: rgba(68,136,255,0.4);
    border-radius: 3px;
    pointer-events: none;
  `;
  trackWrapper.appendChild(filledTrack);

  // Range from handle
  const handleFrom = document.createElement('div');
  handleFrom.style.cssText = `
    position: absolute;
    bottom: -4px;
    width: 14px;
    height: 14px;
    background: #4488ff;
    border-radius: 50%;
    cursor: pointer;
    z-index: 2;
    border: 2px solid #fff;
    box-shadow: 0 0 4px rgba(0,0,0,0.4);
  `;
  trackWrapper.appendChild(handleFrom);

  // Range to handle
  const handleTo = document.createElement('div');
  handleTo.style.cssText = `
    position: absolute;
    bottom: -4px;
    width: 14px;
    height: 14px;
    background: #4488ff;
    border-radius: 50%;
    cursor: pointer;
    z-index: 2;
    border: 2px solid #fff;
    box-shadow: 0 0 4px rgba(0,0,0,0.4);
  `;
  trackWrapper.appendChild(handleTo);

  container.appendChild(trackWrapper);

  // Current date label below track
  const dateLabel = document.createElement('div');
  dateLabel.style.cssText = 'text-align: center; font-size: 11px; color: #aaa;';
  container.appendChild(dateLabel);

  // Dragging logic
  let dragging: 'from' | 'to' | null = null;

  function getFractionFromEvent(e: MouseEvent | TouchEvent): number {
    const rect = track.getBoundingClientRect();
    let clientX: number;
    if ('touches' in e) {
      clientX = e.touches[0]?.clientX ?? 0;
    } else {
      clientX = e.clientX;
    }
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function fractionToDate(fraction: number): string {
    const min = new Date(state.minDate).getTime();
    const max = new Date(state.maxDate).getTime();
    const range = max - min;
    return new Date(min + fraction * range).toISOString();
  }

  function dateToFraction(dateStr: string): number {
    const min = new Date(state.minDate).getTime();
    const max = new Date(state.maxDate).getTime();
    const range = max - min;
    if (range === 0) return 0;
    return (new Date(dateStr).getTime() - min) / range;
  }

  function onDragStart(e: MouseEvent | TouchEvent, which: 'from' | 'to') {
    e.preventDefault();
    dragging = which;
  }

  function onDragMove(e: MouseEvent | Event) {
    if (!dragging) return;
    const evt = e as MouseEvent | TouchEvent;
    const fraction = getFractionFromEvent(evt);
    const dateStr = fractionToDate(fraction);

    if (dragging === 'from') {
      const toFrac = dateToFraction(state.currentTo);
      if (fraction >= toFrac) return;
      state.currentFrom = dateStr;
    } else {
      const fromFrac = dateToFraction(state.currentFrom);
      if (fraction <= fromFrac) return;
      state.currentTo = dateStr;
    }
    callbacks.onTimeRangeChange(state.currentFrom, state.currentTo);
    render();
  }

  function onDragEnd() {
    dragging = null;
  }

  handleFrom.addEventListener('mousedown', (e) => onDragStart(e, 'from'));
  handleFrom.addEventListener('touchstart', (e) => onDragStart(e, 'from'), { passive: false });
  handleTo.addEventListener('mousedown', (e) => onDragStart(e, 'to'));
  handleTo.addEventListener('touchstart', (e) => onDragStart(e, 'to'), { passive: false });

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('mouseup', onDragEnd);
  document.addEventListener('touchend', onDragEnd);

  // Responsive
  function reposition() {
    if (window.innerWidth < 600) {
      container.style.left = '8px';
      container.style.right = '8px';
      container.style.transform = 'none';
      container.style.minWidth = 'auto';
    } else {
      container.style.left = '50%';
      container.style.right = 'auto';
      container.style.transform = 'translateX(-50%)';
      container.style.minWidth = '500px';
    }
  }
  window.addEventListener('resize', reposition);

  function drawSparkline(timestamps: string[]) {
    const canvas = sparkCanvas;
    const rect = track.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = 40 * (window.devicePixelRatio || 1);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = '40px';

    const ctx = canvas.getContext('2d');
    if (!ctx || timestamps.length === 0) return;

    const min = new Date(state.minDate).getTime();
    const max = new Date(state.maxDate).getTime();
    const range = max - min;
    if (range === 0) return;

    const bucketCount = Math.min(100, Math.max(20, Math.floor(canvas.width / 4)));
    const buckets = new Array(bucketCount).fill(0);

    for (const ts of timestamps) {
      const t = new Date(ts).getTime();
      const idx = Math.floor(((t - min) / range) * bucketCount);
      if (idx >= 0 && idx < bucketCount) {
        buckets[idx]++;
      }
    }

    const maxCount = Math.max(1, ...buckets);
    const barWidth = canvas.width / bucketCount;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#4488ff';

    for (let i = 0; i < bucketCount; i++) {
      const barH = (buckets[i] / maxCount) * 30;
      ctx.fillRect(i * barWidth, 40 - barH, barWidth - 1, barH);
    }
  }

  function render() {
    const fromFrac = dateToFraction(state.currentFrom);
    const toFrac = dateToFraction(state.currentTo);

    // Update handles
    const trackWidth = track.getBoundingClientRect().width;
    handleFrom.style.left = `${fromFrac * 100}%`;
    handleTo.style.left = `${toFrac * 100}%`;

    // Update filled track
    filledTrack.style.left = `${fromFrac * 100}%`;
    filledTrack.style.width = `${(toFrac - fromFrac) * 100}%`;

    // Date display
    const fromStr = new Date(state.currentFrom).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const toStr = new Date(state.currentTo).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    dateDisplay.textContent = `${fromStr} \u2014 ${toStr}`;

    // Current date label
    const midFrac = (fromFrac + toFrac) / 2;
    const midDate = fractionToDate(midFrac);
    dateLabel.textContent = new Date(midDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Play button
    playBtn.textContent = state.playing ? '\u23F8' : '\u25B6';

    // Speed buttons
    const sBtns = speedContainer.querySelectorAll('button');
    sBtns.forEach((btn) => {
      const b = btn as HTMLButtonElement;
      const spd = parseInt(b.dataset.speed || '1', 10);
      b.style.background = spd === state.speed ? 'rgba(68,136,255,0.25)' : '';
      b.style.borderColor = spd === state.speed ? 'rgba(68,136,255,0.4)' : '';
    });

    // Sparkline
    if (state.eventTimestamps && state.eventTimestamps.length > 0) {
      requestAnimationFrame(() => drawSparkline(state.eventTimestamps!));
    }

    void trackWidth;
  }

  document.body.appendChild(container);

  function update(newState: BottomBarState) {
    state = newState;
    reposition();
    render();
  }

  reposition();
  render();

  return { element: container, update };
}
