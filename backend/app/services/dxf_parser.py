"""
DXF/DWG parser with intelligent wall extraction.

Strategy priority:
  1. Layer-based filtering (NCS/ISO standard layer names + common variants)
  2. Polylines with width > 0 (almost always walls)
  3. Parallel line pair detection (geometric heuristic)
  4. Fallback: all long lines (original behavior)
"""
import ezdxf
import subprocess
import math
import re
import os
import logging
from typing import List, Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

# ── Layer name patterns that indicate walls ──────────────────────────────
WALL_LAYER_PATTERNS = [
    re.compile(r"(?i)^A[-_.]?WALL"),         # NCS: A-WALL, A_WALL, A.WALL
    re.compile(r"(?i)^S[-_.]?WALL"),         # Structural walls
    re.compile(r"(?i)^I[-_.]?WALL"),         # Interior walls
    re.compile(r"(?i)^AR[-_.]?WALL"),        # Architectural walls
    re.compile(r"(?i)^WALL"),                # Direct "WALL" prefix
    re.compile(r"(?i)[-_.]WALL[-_.]"),       # Contains -WALL- segment
    re.compile(r"(?i)WALLS?$"),              # Ends with WALL or WALLS
    re.compile(r"(?i)^MUR[IO]?$"),           # Italian: MURO, MURI
    re.compile(r"(?i)^PARETI"),              # Italian: PARETI
    re.compile(r"(?i)^WAND"),               # German: WAND, WÄNDE
    re.compile(r"(?i)^MAUER"),              # German: MAUER
    re.compile(r"(?i)^CLOISON"),            # French: CLOISON
    re.compile(r"(?i)PARTITION"),            # Partitions
    re.compile(r"(?i)^A[-_.]FLOR[-_.]WALL"), # Floor plan walls
]

# Layers to EXCLUDE even if they match (hatching, patterns, text)
EXCLUDE_LAYER_PATTERNS = [
    re.compile(r"(?i)PATT"),     # Pattern/hatch fills
    re.compile(r"(?i)HATCH"),
    re.compile(r"(?i)TEXT"),
    re.compile(r"(?i)DIM"),      # Dimensions
    re.compile(r"(?i)ANNO"),     # Annotations
    re.compile(r"(?i)SYMB"),     # Symbols
    re.compile(r"(?i)FURN"),     # Furniture
    re.compile(r"(?i)ELEC"),     # Electrical
    re.compile(r"(?i)PLMB"),     # Plumbing
    re.compile(r"(?i)FIXT"),     # Fixtures
]


def is_wall_layer(layer_name: str) -> bool:
    """Check if a layer name indicates wall geometry."""
    if any(p.search(layer_name) for p in EXCLUDE_LAYER_PATTERNS):
        return False
    return any(p.search(layer_name) for p in WALL_LAYER_PATTERNS)


def convert_dwg_to_dxf(dwg_path: str) -> Optional[str]:
    """Convert DWG to DXF using dwg2dxf (libredwg)."""
    dxf_path = dwg_path.replace(".dwg", ".dxf").replace(".DWG", ".dxf")
    try:
        result = subprocess.run(
            ["dwg2dxf", dwg_path, "-o", dxf_path],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0 and os.path.exists(dxf_path):
            return dxf_path
        subprocess.run(
            ["dwg2dxf", dwg_path],
            capture_output=True, text=True, timeout=60,
            cwd=os.path.dirname(dwg_path)
        )
        base = os.path.splitext(os.path.basename(dwg_path))[0]
        for candidate in [
            dxf_path,
            os.path.join(os.path.dirname(dwg_path), f"{base}.r2000.dxf"),
            os.path.join(os.path.dirname(dwg_path), f"{base}.dxf"),
        ]:
            if os.path.exists(candidate):
                return candidate
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        logger.error(f"dwg2dxf failed: {e}")
        return None


def _extract_lines_from_entity(entity) -> List[Tuple[float, float, float, float]]:
    """Extract line segments from a DXF entity."""
    segments = []
    etype = entity.dxftype()
    try:
        if etype == "LINE":
            s = entity.dxf.start
            e = entity.dxf.end
            segments.append((s.x, s.y, e.x, e.y))
        elif etype == "LWPOLYLINE":
            pts = list(entity.get_points(format="xy"))
            for i in range(len(pts) - 1):
                segments.append((pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
            if entity.closed and len(pts) >= 2:
                segments.append((pts[-1][0], pts[-1][1], pts[0][0], pts[0][1]))
        elif etype == "POLYLINE":
            pts = [(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices]
            for i in range(len(pts) - 1):
                segments.append((pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
            if getattr(entity.dxf, "flags", 0) & 1 and len(pts) >= 2:
                segments.append((pts[-1][0], pts[-1][1], pts[0][0], pts[0][1]))
    except Exception:
        pass
    return segments


def _extract_wide_polylines(msp) -> List[Tuple[float, float, float, float]]:
    """Extract segments from polylines that have width (almost always walls)."""
    segments = []
    for entity in msp.query("LWPOLYLINE"):
        try:
            has_width = False
            const_w = getattr(entity.dxf, "const_width", 0)
            if const_w and const_w > 0:
                has_width = True
            else:
                for _, _, start_w, end_w, _ in entity.get_points(format="xyseb"):
                    if start_w > 0 or end_w > 0:
                        has_width = True
                        break
            if has_width:
                segments.extend(_extract_lines_from_entity(entity))
        except Exception:
            continue
    return segments


def _find_parallel_pairs(
    lines: List[Tuple[float, float, float, float]],
    min_dist: float = 80,
    max_dist: float = 400,
    angle_tol: float = 2.0,
) -> List[Tuple[float, float, float, float]]:
    """Find parallel line pairs that likely form wall boundaries.
    Returns centerlines of detected wall pairs."""
    angle_tol_rad = math.radians(angle_tol)
    enriched = []
    for x1, y1, x2, y2 in lines:
        dx, dy = x2 - x1, y2 - y1
        length = math.hypot(dx, dy)
        if length < 50:
            continue
        angle = math.atan2(dy, dx)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        enriched.append((x1, y1, x2, y2, angle, length, mx, my))

    centerlines = []
    used = set()
    for i, (x1a, y1a, x2a, y2a, aa, la, mxa, mya) in enumerate(enriched):
        if i in used:
            continue
        best_j = None
        best_dist = max_dist + 1
        for j, (x1b, y1b, x2b, y2b, ab, lb, mxb, myb) in enumerate(enriched):
            if j <= i or j in used:
                continue
            # Check parallel
            diff = abs(aa - ab) % math.pi
            if diff > angle_tol_rad and abs(diff - math.pi) > angle_tol_rad:
                continue
            # Perpendicular distance
            num = abs((y2a - y1a) * mxb - (x2a - x1a) * myb + x2a * y1a - y2a * x1a)
            den = math.hypot(y2a - y1a, x2a - x1a)
            dist = num / den if den > 0 else float("inf")
            if min_dist <= dist <= max_dist and dist < best_dist:
                # Check overlap (midpoints should be close along the line direction)
                proj_dist = abs((mxb - mxa) * math.cos(aa) + (myb - mya) * math.sin(aa))
                if proj_dist < max(la, lb) * 0.8:
                    best_j = j
                    best_dist = dist
        if best_j is not None:
            used.add(i)
            used.add(best_j)
            b = enriched[best_j]
            # Centerline = average of the two lines
            cx1 = (x1a + b[0]) / 2
            cy1 = (y1a + b[1]) / 2
            cx2 = (x2a + b[2]) / 2
            cy2 = (y2a + b[3]) / 2
            centerlines.append((cx1, cy1, cx2, cy2))

    return centerlines


def _normalize_coords(
    lines: List[Tuple[float, float, float, float]],
    target_w: int = 1200,
    target_h: int = 900,
    min_length: float = 2.0,
) -> Tuple[List[Dict[str, Any]], int, int]:
    """Normalize coordinates to fit a target canvas, flip Y, return walls + dimensions."""
    if not lines:
        return [], target_w, target_h

    xs = [x for x1, y1, x2, y2 in lines for x in (x1, x2)]
    ys = [y for x1, y1, x2, y2 in lines for y in (y1, y2)]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    w = max_x - min_x or 1
    h = max_y - min_y or 1
    scale = min(target_w / w, target_h / h)

    out_w = int(w * scale)
    out_h = int(h * scale)

    walls = []
    for x1, y1, x2, y2 in lines:
        nx1 = (x1 - min_x) * scale
        ny1 = (max_y - y1) * scale
        nx2 = (x2 - min_x) * scale
        ny2 = (max_y - y2) * scale
        length = math.hypot(nx2 - nx1, ny2 - ny1)
        if length > min_length:
            walls.append({
                "x1": round(nx1, 2), "y1": round(ny1, 2),
                "x2": round(nx2, 2), "y2": round(ny2, 2),
                "thickness": 1.0, "wall_type": "concrete", "attenuation_db": 12.0,
            })

    return walls, max(out_w, 100), max(out_h, 100)


def parse_dxf_walls(file_path: str, file_type: str = "dxf") -> Dict[str, Any]:
    """Parse DXF/DWG file and extract walls using layered strategy.

    Returns dict with keys: walls, width, height, method, layers_found.
    """
    actual_path = file_path

    # ── DWG → DXF conversion ──
    if file_type.lower() == "dwg" or file_path.lower().endswith(".dwg"):
        dxf_path = convert_dwg_to_dxf(file_path)
        if dxf_path:
            actual_path = dxf_path
            logger.info(f"DWG converted to DXF: {dxf_path}")
        else:
            logger.error("DWG conversion failed")
            return {"walls": [], "width": 1200, "height": 900, "method": "error"}

    # ── Read DXF ──
    try:
        doc = ezdxf.readfile(actual_path)
    except Exception:
        try:
            doc, _ = ezdxf.recover.readfile(actual_path)
        except Exception as e2:
            logger.error(f"ezdxf failed: {e2}")
            return {"walls": [], "width": 1200, "height": 900, "method": "error"}

    msp = doc.modelspace()

    # Log all layers for diagnostics
    all_layers = {layer.dxf.name for layer in doc.layers}
    wall_layers = {name for name in all_layers if is_wall_layer(name)}
    logger.info(f"DXF layers ({len(all_layers)}): {sorted(all_layers)}")
    logger.info(f"Wall layers detected: {sorted(wall_layers)}")

    # ── Strategy 1: Layer-based extraction ──
    if wall_layers:
        lines = []
        for entity in msp:
            if entity.dxf.layer in wall_layers:
                lines.extend(_extract_lines_from_entity(entity))
        if lines:
            walls, w, h = _normalize_coords(lines)
            logger.info(f"Strategy LAYER: {len(walls)} walls from layers {sorted(wall_layers)}")
            return {
                "walls": walls, "width": w, "height": h,
                "method": "layer", "layers_found": sorted(wall_layers),
            }

    # ── Strategy 2: Wide polylines ──
    wide_lines = _extract_wide_polylines(msp)
    if wide_lines:
        walls, w, h = _normalize_coords(wide_lines)
        logger.info(f"Strategy WIDE_POLYLINE: {len(walls)} walls")
        return {
            "walls": walls, "width": w, "height": h,
            "method": "wide_polyline", "layers_found": [],
        }

    # ── Strategy 3: Parallel line pair detection ──
    all_lines = []
    for entity in msp:
        all_lines.extend(_extract_lines_from_entity(entity))

    if all_lines:
        centerlines = _find_parallel_pairs(all_lines)
        if len(centerlines) >= 4:  # Need at least a few wall pairs to be meaningful
            walls, w, h = _normalize_coords(centerlines)
            logger.info(f"Strategy PARALLEL_PAIRS: {len(walls)} walls from {len(all_lines)} total segments")
            return {
                "walls": walls, "width": w, "height": h,
                "method": "parallel_pairs", "layers_found": [],
            }

    # ── Strategy 4: Fallback — all long lines (filter short/tiny) ──
    if all_lines:
        # Only keep lines longer than 5% of bounding box diagonal
        xs = [x for x1, y1, x2, y2 in all_lines for x in (x1, x2)]
        ys = [y for x1, y1, x2, y2 in all_lines for y in (y1, y2)]
        diag = math.hypot(max(xs) - min(xs), max(ys) - min(ys)) or 1
        min_len = diag * 0.03
        long_lines = [
            (x1, y1, x2, y2) for x1, y1, x2, y2 in all_lines
            if math.hypot(x2 - x1, y2 - y1) >= min_len
        ]
        walls, w, h = _normalize_coords(long_lines, min_length=5.0)
        logger.info(f"Strategy FALLBACK: {len(walls)} walls from {len(long_lines)}/{len(all_lines)} segments (min_len={min_len:.1f})")
        return {
            "walls": walls, "width": w, "height": h,
            "method": "fallback", "layers_found": [],
        }

    return {"walls": [], "width": 1200, "height": 900, "method": "empty"}
