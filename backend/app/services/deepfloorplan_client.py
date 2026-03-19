"""
Client for TF2DeepFloorplan service.

Sends floor plan images to the DeepFloorplan container and extracts
wall line segments from the returned segmentation mask.
"""
import os
import logging
import httpx
import cv2
import numpy as np
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

DEEPFLOORPLAN_URL = os.environ.get("DEEPFLOORPLAN_URL", "http://deepfloorplan:1111")
TIMEOUT = 120.0  # seconds


async def detect_walls_deepfloorplan(image_path: str) -> Optional[List[Dict[str, Any]]]:
    """Send an image to DeepFloorplan and extract wall coordinates.

    Returns list of wall dicts with x1,y1,x2,y2 or None if service unavailable.
    """
    if not os.path.exists(image_path):
        logger.error(f"Image not found: {image_path}")
        return None

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            # Check service health
            try:
                health = await client.get(f"{DEEPFLOORPLAN_URL}/", timeout=5.0)
                if health.status_code != 200:
                    logger.warning("DeepFloorplan service not available")
                    return None
            except Exception:
                logger.warning("DeepFloorplan service not reachable")
                return None

            # Send image for inference — colorize=1 so walls are white [255,255,255]
            with open(image_path, "rb") as f:
                resp = await client.post(
                    f"{DEEPFLOORPLAN_URL}/upload",
                    files={"file": (os.path.basename(image_path), f, "image/png")},
                    data={"postprocess": "1", "colorize": "1"},
                )

            if resp.status_code != 200:
                logger.error(f"DeepFloorplan returned {resp.status_code}")
                return None

            # Decode response JPEG into numpy array
            img_array = np.frombuffer(resp.content, dtype=np.uint8)
            img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
            if img is None:
                logger.error("Failed to decode DeepFloorplan response")
                return None

            return _extract_walls_from_mask(img)

    except Exception as e:
        logger.error(f"DeepFloorplan error: {e}")
        return None


def _extract_walls_from_mask(img: np.ndarray) -> List[Dict[str, Any]]:
    """Extract wall line segments from a colorized segmentation mask.

    Walls are white/near-white pixels [>240, >240, >240].
    """
    h, w = img.shape[:2]

    # Extract wall mask — walls are white in colorized output
    wall_mask = np.all(img > 240, axis=2).astype(np.uint8) * 255

    # Also check for black walls (some colorize variants use black)
    if cv2.countNonZero(wall_mask) < 100:
        wall_mask_alt = np.all(img < 15, axis=2).astype(np.uint8) * 255
        if cv2.countNonZero(wall_mask_alt) > cv2.countNonZero(wall_mask):
            wall_mask = wall_mask_alt

    if cv2.countNonZero(wall_mask) < 50:
        logger.warning("No wall pixels detected in DeepFloorplan output")
        return []

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    wall_mask = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Skeletonize to get 1px-wide lines
    skeleton = cv2.ximgproc.thinning(wall_mask) if hasattr(cv2, "ximgproc") else _simple_skeleton(wall_mask)

    # Hough line detection on skeleton
    min_len = max(15, min(w, h) * 0.03)
    lines = cv2.HoughLinesP(
        skeleton, rho=1, theta=np.pi / 180,
        threshold=25, minLineLength=int(min_len), maxLineGap=8
    )

    walls = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            walls.append({
                "x1": float(x1), "y1": float(y1),
                "x2": float(x2), "y2": float(y2),
                "wall_type": "ai_detected", "attenuation_db": 12.0,
                "thickness": 1.0,
            })

    # Merge collinear segments that are close together
    walls = _merge_collinear_walls(walls)

    logger.info(f"DeepFloorplan: extracted {len(walls)} wall segments")
    return walls


def _simple_skeleton(mask: np.ndarray) -> np.ndarray:
    """Simple morphological skeletonization fallback."""
    skeleton = np.zeros_like(mask)
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))
    temp = mask.copy()
    while True:
        eroded = cv2.erode(temp, element)
        opened = cv2.dilate(eroded, element)
        diff = cv2.subtract(temp, opened)
        skeleton = cv2.bitwise_or(skeleton, diff)
        temp = eroded.copy()
        if cv2.countNonZero(temp) == 0:
            break
    return skeleton


def _merge_collinear_walls(
    walls: List[Dict[str, Any]],
    angle_tol: float = 5.0,
    gap_tol: float = 15.0,
) -> List[Dict[str, Any]]:
    """Merge wall segments that are nearly collinear and close together."""
    import math

    if len(walls) < 2:
        return walls

    def angle_deg(w):
        return math.degrees(math.atan2(w["y2"] - w["y1"], w["x2"] - w["x1"])) % 180

    def length(w):
        return math.hypot(w["x2"] - w["x1"], w["y2"] - w["y1"])

    merged = list(walls)
    changed = True
    while changed:
        changed = False
        new_merged = []
        used = set()
        for i in range(len(merged)):
            if i in used:
                continue
            best_j = None
            for j in range(i + 1, len(merged)):
                if j in used:
                    continue
                ai, aj = angle_deg(merged[i]), angle_deg(merged[j])
                adiff = min(abs(ai - aj), 180 - abs(ai - aj))
                if adiff > angle_tol:
                    continue
                # Check endpoint gap
                endpoints_i = [(merged[i]["x1"], merged[i]["y1"]), (merged[i]["x2"], merged[i]["y2"])]
                endpoints_j = [(merged[j]["x1"], merged[j]["y1"]), (merged[j]["x2"], merged[j]["y2"])]
                min_gap = min(
                    math.hypot(a[0] - b[0], a[1] - b[1])
                    for a in endpoints_i for b in endpoints_j
                )
                if min_gap <= gap_tol:
                    best_j = j
                    break
            if best_j is not None:
                used.add(best_j)
                changed = True
                # Merge: take the two farthest endpoints
                pts = [
                    (merged[i]["x1"], merged[i]["y1"]),
                    (merged[i]["x2"], merged[i]["y2"]),
                    (merged[best_j]["x1"], merged[best_j]["y1"]),
                    (merged[best_j]["x2"], merged[best_j]["y2"]),
                ]
                max_dist = 0
                best_pair = (pts[0], pts[1])
                for a in range(len(pts)):
                    for b in range(a + 1, len(pts)):
                        d = math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1])
                        if d > max_dist:
                            max_dist = d
                            best_pair = (pts[a], pts[b])
                new_merged.append({
                    "x1": best_pair[0][0], "y1": best_pair[0][1],
                    "x2": best_pair[1][0], "y2": best_pair[1][1],
                    "wall_type": "ai_detected", "attenuation_db": 12.0,
                    "thickness": 1.0,
                })
            else:
                new_merged.append(merged[i])
        merged = new_merged

    return merged
