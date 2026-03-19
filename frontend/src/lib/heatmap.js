/**
 * WiFi signal propagation heatmap generator.
 *
 * Supports two modes:
 *   - "coverage": best signal at each point (standard view)
 *   - "overlap":  how many APs cover each point above threshold
 *
 * Log-distance path loss model with ceiling height correction.
 */

const TX_POWER_DBM = 18;
const ANTENNA_GAIN_24 = 4.2;
const ANTENNA_GAIN_5 = 5.07;

const STRONG_SIGNAL = -65;
const WEAK_SIGNAL = -75;
const MIN_SIGNAL = -80;
const OVERLAP_THRESHOLD = -75; // AP counts as "covering" if signal >= this
const GRID_STEP = 8;

function indoorPathLoss(distMeters, freqMhz) {
  const ceilingHeight = 3.5;
  const d = Math.sqrt(distMeters * distMeters + ceilingHeight * ceilingHeight);
  const plRef = 20 * Math.log10(freqMhz) + 20 * Math.log10(0.001) + 32.44;
  const n = 3.5;
  const clutter = 0.3;
  return plRef + 10 * n * Math.log10(d) + clutter * distMeters;
}

function segmentsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
  const dx1 = ax2 - ax1, dy1 = ay2 - ay1;
  const dx2 = bx2 - bx1, dy2 = by2 - by1;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return false;
  const t = ((bx1 - ax1) * dy2 - (by1 - ay1) * dx2) / denom;
  const u = ((bx1 - ax1) * dy1 - (by1 - ay1) * dx1) / denom;
  return t > 0.001 && t < 0.999 && u > 0.001 && u < 0.999;
}

// ── Coverage colors ──────────────────────────────────────────────────────────
function signalToColor(dbm) {
  if (dbm < MIN_SIGNAL) return [0, 0, 0, 0];
  const clamped = Math.max(WEAK_SIGNAL, Math.min(STRONG_SIGNAL, dbm));
  const t = (clamped - WEAK_SIGNAL) / (STRONG_SIGNAL - WEAK_SIGNAL);

  let r, g, b;
  if (t > 0.6) {
    const s = (t - 0.6) / 0.4;
    r = Math.round(120 * (1 - s));
    g = Math.round(160 + 40 * s);
    b = 0;
  } else if (t > 0.3) {
    const s = (t - 0.3) / 0.3;
    r = Math.round(160 + (120 - 160) * s);
    g = Math.round(140 + 20 * s);
    b = 0;
  } else {
    const s = t / 0.3;
    r = Math.round(140 + 20 * s);
    g = Math.round(100 + 40 * s);
    b = Math.round(20 * (1 - s));
  }

  let alpha;
  if (dbm >= WEAK_SIGNAL) {
    alpha = Math.round(90 + 70 * t);
  } else {
    const fade = (dbm - MIN_SIGNAL) / (WEAK_SIGNAL - MIN_SIGNAL);
    alpha = Math.round(60 * fade * fade * fade);
  }
  return [r, g, b, alpha];
}

// ── Overlap colors ───────────────────────────────────────────────────────────
// 0 AP = transparent, 1 AP = blue, 2 AP = green (good roaming), 3+ AP = red (interference)
function overlapToColor(count) {
  if (count === 0) return [0, 0, 0, 0];
  if (count === 1) return [30, 100, 200, 120];    // Blue — single coverage
  if (count === 2) return [0, 180, 80, 140];       // Green — good overlap for roaming
  return [220, 40, 40, 150];                        // Red — too many APs, interference risk
}

// ── Core: compute signal per AP at each grid cell ────────────────────────────
function computeSignalGrid(width, height, accessPoints, walls, pixelsPerMeter, frequency) {
  const freqMhz = frequency === '5' ? 5200 : 2437;
  const antennaGain = frequency === '5' ? ANTENNA_GAIN_5 : ANTENNA_GAIN_24;
  const attenKey = frequency === '5' ? 'attenuation_5ghz' : 'attenuation_db';

  const wallData = walls.map(w => ({
    x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
    atten: parseFloat(w[attenKey] || w.attenuation_db || 5),
  }));

  const gridW = Math.ceil(width / GRID_STEP);
  const gridH = Math.ceil(height / GRID_STEP);
  const numAPs = accessPoints.length;

  // Store signal per AP per grid cell: apSignals[apIdx][gy * gridW + gx]
  const apSignals = [];
  for (let i = 0; i < numAPs; i++) {
    apSignals.push(new Float32Array(gridW * gridH).fill(MIN_SIGNAL - 10));
  }

  for (let gy = 0; gy < gridH; gy++) {
    const py = gy * GRID_STEP;
    for (let gx = 0; gx < gridW; gx++) {
      const px = gx * GRID_STEP;

      for (let ai = 0; ai < numAPs; ai++) {
        const ap = accessPoints[ai];
        const eirp = (ap.tx_power_dbm || TX_POWER_DBM) + antennaGain;
        const dx = px - ap.x;
        const dy = py - ap.y;
        const distPx = Math.sqrt(dx * dx + dy * dy);
        const distM = distPx / pixelsPerMeter;

        let loss = indoorPathLoss(distM, freqMhz);
        for (const w of wallData) {
          if (segmentsIntersect(ap.x, ap.y, px, py, w.x1, w.y1, w.x2, w.y2)) {
            loss += w.atten;
          }
        }

        apSignals[ai][gy * gridW + gx] = eirp - loss;
      }
    }
  }

  return { apSignals, gridW, gridH };
}

// ── Build best-signal grid + overlap count grid ──────────────────────────────
function buildGrids(apSignals, gridW, gridH) {
  const numAPs = apSignals.length;
  const bestGrid = new Float32Array(gridW * gridH).fill(MIN_SIGNAL - 1);
  const overlapGrid = new Uint8Array(gridW * gridH);

  for (let i = 0; i < gridW * gridH; i++) {
    let best = MIN_SIGNAL - 10;
    let count = 0;
    for (let ai = 0; ai < numAPs; ai++) {
      const sig = apSignals[ai][i];
      if (sig > best) best = sig;
      if (sig >= OVERLAP_THRESHOLD) count++;
    }
    bestGrid[i] = best;
    overlapGrid[i] = count;
  }

  return { bestGrid, overlapGrid };
}

// ── Render grid to ImageData with bilinear interpolation ─────────────────────
function renderGrid(width, height, grid, gridW, gridH, colorFn, isFloat) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y++) {
    const gy = y / GRID_STEP;
    const gy0 = Math.min(Math.floor(gy), gridH - 1);
    const gy1 = Math.min(gy0 + 1, gridH - 1);
    const ty = gy - gy0;

    for (let x = 0; x < width; x++) {
      const gx = x / GRID_STEP;
      const gx0 = Math.min(Math.floor(gx), gridW - 1);
      const gx1 = Math.min(gx0 + 1, gridW - 1);
      const tx = gx - gx0;

      let val;
      if (isFloat) {
        const v00 = grid[gy0 * gridW + gx0];
        const v10 = grid[gy0 * gridW + gx1];
        const v01 = grid[gy1 * gridW + gx0];
        const v11 = grid[gy1 * gridW + gx1];
        val = v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) +
              v01 * (1 - tx) * ty + v11 * tx * ty;
      } else {
        // For overlap (integer), use nearest neighbor
        val = grid[gy0 * gridW + gx0];
      }

      const [r, g, b, a] = colorFn(val);
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }

  return imageData;
}

/**
 * Generate heatmap ImageData.
 * @param {string} mode - "coverage" or "overlap"
 */
export function generateHeatmap(width, height, accessPoints, walls, pixelsPerMeter, frequency, mode = 'coverage') {
  if (!accessPoints.length || pixelsPerMeter <= 0) return null;

  const { apSignals, gridW, gridH } = computeSignalGrid(
    width, height, accessPoints, walls, pixelsPerMeter, frequency
  );

  const { bestGrid, overlapGrid } = buildGrids(apSignals, gridW, gridH);

  let imageData;
  if (mode === 'overlap') {
    imageData = renderGrid(width, height, overlapGrid, gridW, gridH, overlapToColor, false);
  } else {
    imageData = renderGrid(width, height, bestGrid, gridW, gridH, signalToColor, true);
  }

  return { imageData, grid: bestGrid, overlapGrid, gridW, gridH, gridStep: GRID_STEP };
}

/**
 * Sample signal strength at a pixel coordinate.
 */
export function sampleSignal(gridData, px, py) {
  if (!gridData) return null;
  const { grid, gridW, gridH, gridStep } = gridData;
  const gx = Math.min(Math.floor(px / gridStep), gridW - 1);
  const gy = Math.min(Math.floor(py / gridStep), gridH - 1);
  if (gx < 0 || gy < 0) return null;
  const val = grid[gy * gridW + gx];
  return val > MIN_SIGNAL - 1 ? Math.round(val) : null;
}

/**
 * Sample overlap count at a pixel coordinate.
 */
export function sampleOverlap(gridData, px, py) {
  if (!gridData || !gridData.overlapGrid) return null;
  const { overlapGrid, gridW, gridH, gridStep } = gridData;
  const gx = Math.min(Math.floor(px / gridStep), gridW - 1);
  const gy = Math.min(Math.floor(py / gridStep), gridH - 1);
  if (gx < 0 || gy < 0) return null;
  return overlapGrid[gy * gridW + gx];
}

export const HEATMAP_RANGE = { strong: STRONG_SIGNAL, weak: WEAK_SIGNAL, min: MIN_SIGNAL };
export const OVERLAP_LABELS = ['Nessuna copertura', '1 AP', '2 AP (roaming)', '3+ AP (interferenza)'];
export const OVERLAP_COLORS = ['transparent', '#1e64c8', '#00b450', '#dc2828'];
