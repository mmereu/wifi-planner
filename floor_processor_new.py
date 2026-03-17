import os
import numpy as np
from .pdf_parser import parse_pdf_walls
from .dxf_parser import parse_dxf_walls
from .wall_detector import detect_walls_from_image


def render_walls_to_png(walls: list, width: int, height: int, output_path: str):
    """Render wall lines onto a light-grey PNG image for DXF/DWG files."""
    import cv2
    img = np.ones((height, width, 3), dtype=np.uint8) * 245
    for w in walls:
        pt1 = (int(w.get("x1", 0)), int(w.get("y1", 0)))
        pt2 = (int(w.get("x2", 0)), int(w.get("y2", 0)))
        thickness = max(1, int(w.get("thickness", 1)))
        cv2.line(img, pt1, pt2, (40, 40, 40), thickness)
    cv2.imwrite(output_path, img)
    return output_path


async def process_floor_file(file_path: str, file_type: str, upload_dir: str) -> dict:
    result = {"walls": [], "width": 800, "height": 600, "image_path": None}

    if file_type == "pdf":
        parsed = parse_pdf_walls(file_path, upload_dir)
        result["walls"] = parsed.get("walls", [])
        result["width"] = parsed.get("width", 800)
        result["height"] = parsed.get("height", 600)
        result["image_path"] = parsed.get("image_path")
        if not result["walls"] and result["image_path"]:
            result["walls"] = detect_walls_from_image(result["image_path"])

    elif file_type in ("dxf", "dwg"):
        parsed = parse_dxf_walls(file_path)
        result["walls"] = parsed.get("walls", [])
        result["width"] = parsed.get("width", 1200)
        result["height"] = parsed.get("height", 900)
        # Generate a PNG rendering of the DXF walls as background image
        png_path = os.path.join(upload_dir, "floor_raster.png")
        render_walls_to_png(result["walls"], result["width"], result["height"], png_path)
        result["image_path"] = png_path

    elif file_type in ("png", "jpg", "jpeg", "tiff", "webp"):
        result["walls"] = detect_walls_from_image(file_path)
        result["image_path"] = file_path
        import cv2
        img = cv2.imread(file_path)
        if img is not None:
            result["height"], result["width"] = img.shape[:2]

    return result
