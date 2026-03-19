"""
Improved wall detection from raster images using OpenCV.

Improvements over original:
  - Adaptive thresholding for varied image quality
  - Line merging to reduce fragmentation
  - Angle snapping (walls are mostly 0°/90°)
  - Minimum length relative to image size
"""
import cv2
import numpy as np
import math
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)


def detect_walls_from_image(image_path: str) -> List[Dict]:
    """Detect wall-like lines from a floor plan image."""
    img = cv2.imread(image_path)
    if img is None:
        logger.error(f"Cannot read image: {image_path}")
        return []

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Adaptive preprocessing based on image characteristics
    walls = _detect_with_adaptive(gray, h, w)

    if not walls:
        # Fallback to original Canny + Hough
        walls = _detect_with_canny(gray, h, w)

    # Snap near-horizontal/vertical lines
    walls = _snap_angles(walls, tolerance_deg=3.0)

    # Merge collinear nearby segments
    walls = _merge_segments(walls, angle_tol=5.0, gap_tol=max(10, min(w, h) * 0.02))

    logger.info(f"Wall detector: {len(walls)} walls from {w}x{h} image")
    return walls


def _detect_with_adaptive(gray: np.ndarray, h: int, w: int) -> List[Dict]:
    """Use adaptive thresholding — better for scanned plans with uneven lighting."""
    # Binary threshold to isolate dark lines on light background
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    binary = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, blockSize=15, C=8
    )

    # Morphological cleanup — keep only thick/long structures (walls)
    # Horizontal kernel
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (max(15, w // 40), 1))
    h_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, h_kernel)

    # Vertical kernel
    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, max(15, h // 40)))
    v_lines = cv2.morphologyEx(binary, cv2.MORPH_OPEN, v_kernel)

    # Combine
    combined = cv2.bitwise_or(h_lines, v_lines)

    # Also detect diagonal walls via standard edge detection
    edges = cv2.Canny(blurred, 50, 150, apertureSize=3)
    combined = cv2.bitwise_or(combined, edges)

    min_len = max(30, min(w, h) * 0.05)
    lines = cv2.HoughLinesP(
        combined, rho=1, theta=np.pi / 180,
        threshold=60, minLineLength=int(min_len), maxLineGap=10
    )

    return _lines_to_dicts(lines)


def _detect_with_canny(gray: np.ndarray, h: int, w: int) -> List[Dict]:
    """Original Canny + Hough approach as fallback."""
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150, apertureSize=3)
    min_len = max(30, min(w, h) * 0.05)
    lines = cv2.HoughLinesP(
        edges, 1, np.pi / 180, threshold=80,
        minLineLength=int(min_len), maxLineGap=10
    )
    return _lines_to_dicts(lines)


def _lines_to_dicts(lines) -> List[Dict]:
    if lines is None:
        return []
    walls = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        walls.append({
            "x1": float(x1), "y1": float(y1),
            "x2": float(x2), "y2": float(y2),
            "wall_type": "detected", "attenuation_db": 12.0,
        })
    return walls


def _snap_angles(walls: List[Dict], tolerance_deg: float = 3.0) -> List[Dict]:
    """Snap lines that are nearly horizontal or vertical."""
    for w in walls:
        angle = math.degrees(math.atan2(w["y2"] - w["y1"], w["x2"] - w["x1"])) % 180
        if angle < tolerance_deg or angle > 180 - tolerance_deg:
            # Nearly horizontal — force same Y
            avg_y = (w["y1"] + w["y2"]) / 2
            w["y1"] = avg_y
            w["y2"] = avg_y
        elif abs(angle - 90) < tolerance_deg:
            # Nearly vertical — force same X
            avg_x = (w["x1"] + w["x2"]) / 2
            w["x1"] = avg_x
            w["x2"] = avg_x
    return walls


def _merge_segments(
    walls: List[Dict], angle_tol: float = 5.0, gap_tol: float = 15.0
) -> List[Dict]:
    """Merge collinear segments that are close together."""
    if len(walls) < 2:
        return walls

    def angle_deg(w):
        return math.degrees(math.atan2(w["y2"] - w["y1"], w["x2"] - w["x1"])) % 180

    merged = list(walls)
    changed = True
    max_iter = 10
    while changed and max_iter > 0:
        max_iter -= 1
        changed = False
        new_merged = []
        used = set()
        for i in range(len(merged)):
            if i in used:
                continue
            current = merged[i]
            for j in range(i + 1, len(merged)):
                if j in used:
                    continue
                ai, aj = angle_deg(current), angle_deg(merged[j])
                adiff = min(abs(ai - aj), 180 - abs(ai - aj))
                if adiff > angle_tol:
                    continue
                eps_i = [(current["x1"], current["y1"]), (current["x2"], current["y2"])]
                eps_j = [(merged[j]["x1"], merged[j]["y1"]), (merged[j]["x2"], merged[j]["y2"])]
                min_gap = min(
                    math.hypot(a[0] - b[0], a[1] - b[1])
                    for a in eps_i for b in eps_j
                )
                if min_gap <= gap_tol:
                    used.add(j)
                    changed = True
                    pts = eps_i + eps_j
                    max_dist = 0
                    best_pair = (pts[0], pts[1])
                    for a in range(len(pts)):
                        for b in range(a + 1, len(pts)):
                            d = math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1])
                            if d > max_dist:
                                max_dist = d
                                best_pair = (pts[a], pts[b])
                    current = {
                        "x1": best_pair[0][0], "y1": best_pair[0][1],
                        "x2": best_pair[1][0], "y2": best_pair[1][1],
                        "wall_type": current.get("wall_type", "detected"),
                        "attenuation_db": 12.0,
                    }
            new_merged.append(current)
        merged = new_merged

    return merged
