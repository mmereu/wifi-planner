import cv2
import numpy as np
from typing import List, Tuple

def detect_walls_from_image(image_path: str) -> List[dict]:
    img = cv2.imread(image_path)
    if img is None:
        return []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 50, 150, apertureSize=3)
    h, w = img.shape[:2]
    min_len = max(30, min(w, h) * 0.05)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=80,
                             minLineLength=min_len, maxLineGap=10)
    walls = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            walls.append({
                "x1": float(x1), "y1": float(y1),
                "x2": float(x2), "y2": float(y2),
                "wall_type": "detected",
                "attenuation_db": 12.0
            })
    return walls
