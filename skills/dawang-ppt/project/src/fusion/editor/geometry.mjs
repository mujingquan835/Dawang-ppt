// Pure bounds math for direct manipulation on the 1920×1080 logical canvas.
export const HANDLES = ['nw','n','ne','e','se','s','sw','w'];
export const HANDLE_CURSORS = {n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize',ne:'nesw-resize',sw:'nesw-resize',nw:'nwse-resize',se:'nwse-resize'};

// Drag one handle by (dx,dy); the opposite edge or corner stays put.
export function resizeBounds(b, handle, dx, dy, {keepRatio = false, min = 20} = {}) {
  let left = b[0], top = b[1], right = b[0] + b[2], bottom = b[1] + b[3];
  if (handle.includes('w')) left = Math.min(left + dx, right - min);
  if (handle.includes('e')) right = Math.max(right + dx, left + min);
  if (handle.includes('n')) top = Math.min(top + dy, bottom - min);
  if (handle.includes('s')) bottom = Math.max(bottom + dy, top + min);
  if (!keepRatio || !(b[2] > 0 && b[3] > 0)) return [left, top, right - left, bottom - top];
  const horizontal = /[ew]/.test(handle), vertical = /[ns]/.test(handle);
  const sx = (right - left) / b[2], sy = (bottom - top) / b[3];
  let s = horizontal && vertical ? (Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy) : horizontal ? sx : sy;
  s = Math.max(s, min / b[2], min / b[3]);
  const w = b[2] * s, h = b[3] * s;
  // Corners anchor the opposite corner; edge handles keep the other axis centred.
  const x = handle.includes('w') ? b[0] + b[2] - w : handle.includes('e') ? b[0] : b[0] + (b[2] - w) / 2;
  const y = handle.includes('n') ? b[1] + b[3] - h : handle.includes('s') ? b[1] : b[1] + (b[3] - h) / 2;
  return [x, y, w, h];
}

// Lines worth aligning to: slide edges and centre, plus every other element's edges and centre.
export function snapTargets(boxes, width = 1920, height = 1080) {
  const x = [0, width / 2, width], y = [0, height / 2, height];
  for (const b of boxes) {
    if (!b || !b.every(Number.isFinite)) continue;
    x.push(b[0], b[0] + b[2] / 2, b[0] + b[2]);
    y.push(b[1], b[1] + b[3] / 2, b[1] + b[3]);
  }
  return {x, y};
}

const nearest = (candidates, lines, threshold) => {
  let best = null;
  for (const c of candidates) for (const t of lines) {
    const d = t - c;
    if (Math.abs(d) <= threshold && (best === null || Math.abs(d) < Math.abs(best))) best = d;
  }
  return best;
};
const hits = (candidates, lines) => [...new Set(lines.filter(t => candidates.some(c => Math.abs(c - t) < 0.5)))];

// handle=null snaps a move (all three lines per axis); a handle snaps only the edges it moves.
export function snapBounds(b, targets, {handle = null, threshold = 8, min = 20} = {}) {
  let [x, y, w, h] = b;
  if (!handle) {
    const dx = nearest([x, x + w / 2, x + w], targets.x, threshold), dy = nearest([y, y + h / 2, y + h], targets.y, threshold);
    if (dx !== null) x += dx;
    if (dy !== null) y += dy;
    return {bounds: [x, y, w, h], guides: {x: hits([x, x + w / 2, x + w], targets.x), y: hits([y, y + h / 2, y + h], targets.y)}};
  }
  const guides = {x: [], y: []};
  if (handle.includes('w') || handle.includes('e')) {
    const edge = handle.includes('w') ? x : x + w, d = nearest([edge], targets.x, threshold);
    if (d !== null && (handle.includes('w') ? w - d : w + d) >= min) { if (handle.includes('w')) { x += d; w -= d; } else w += d; guides.x.push(edge + d); }
  }
  if (handle.includes('n') || handle.includes('s')) {
    const edge = handle.includes('n') ? y : y + h, d = nearest([edge], targets.y, threshold);
    if (d !== null && (handle.includes('n') ? h - d : h + d) >= min) { if (handle.includes('n')) { y += d; h -= d; } else h += d; guides.y.push(edge + d); }
  }
  return {bounds: [x, y, w, h], guides};
}
