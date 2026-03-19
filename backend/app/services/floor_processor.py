"""
Floor plan processing pipeline.

For PDF/images: tries DeepFloorplan AI first, falls back to OpenCV.
For DXF/DWG: uses layer-based + heuristic wall extraction.
"""
import os
import logging
import numpy as np
from .pdf_parser import parse_pdf_walls
from .dxf_parser import parse_dxf_walls
from .wall_detector import detect_walls_from_image
from .deepfloorplan_client import detect_walls_deepfloorplan

logger = logging.getLogger(__name__)


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


async def render_floor_thumbnail(file_path: str, file_type: str, upload_dir: str) -> dict:
    """Render floor plan to PNG thumbnail only — no wall detection."""
    if file_type == "pdf":
        from .pdf_parser import parse_pdf_walls
        parsed = parse_pdf_walls(file_path, upload_dir)
        return {
            "width": parsed.get("width", 800),
            "height": parsed.get("height", 600),
            "image_path": parsed.get("image_path"),
        }
    elif file_type in ("png", "jpg", "jpeg", "tiff", "webp"):
        import cv2
        img = cv2.imread(file_path)
        if img is not None:
            h, w = img.shape[:2]
            return {"width": w, "height": h, "image_path": file_path}
        return {"width": 800, "height": 600, "image_path": file_path}
    elif file_type in ("dxf", "dwg"):
        # For CAD files, render a blank canvas (walls come from manual drawing or process)
        png_path = os.path.join(upload_dir, "floor_raster.png")
        import cv2
        img = np.ones((900, 1200, 3), dtype=np.uint8) * 245
        cv2.putText(img, "CAD file - use wall tools", (300, 450),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (150, 150, 150), 2)
        cv2.imwrite(png_path, img)
        return {"width": 1200, "height": 900, "image_path": png_path}
    return {"width": 800, "height": 600, "image_path": None}


async def process_floor_file(file_path: str, file_type: str, upload_dir: str) -> dict:
    result = {"walls": [], "width": 800, "height": 600, "image_path": None, "method": "none"}

    if file_type == "pdf":
        result = await _process_pdf(file_path, upload_dir)

    elif file_type in ("dxf", "dwg"):
        result = await _process_cad(file_path, file_type, upload_dir)

    elif file_type in ("png", "jpg", "jpeg", "tiff", "webp"):
        result = await _process_image(file_path)

    logger.info(
        f"Processed {file_type}: {len(result['walls'])} walls, "
        f"method={result.get('method', '?')}, size={result['width']}x{result['height']}"
    )
    return result


async def _process_pdf(file_path: str, upload_dir: str) -> dict:
    """Process PDF: render to PNG, then try AI detection, fallback to vector/CV."""
    parsed = parse_pdf_walls(file_path, upload_dir)
    image_path = parsed.get("image_path")
    width = parsed.get("width", 800)
    height = parsed.get("height", 600)

    # Try DeepFloorplan AI on the rendered PNG
    if image_path and os.path.exists(image_path):
        ai_walls = await detect_walls_deepfloorplan(image_path)
        if ai_walls and len(ai_walls) >= 4:
            # Scale AI walls (512x512 output) to actual image dimensions
            import cv2
            actual_img = cv2.imread(image_path)
            if actual_img is not None:
                ah, aw = actual_img.shape[:2]
                scale_x = aw / 512.0
                scale_y = ah / 512.0
                for w in ai_walls:
                    w["x1"] *= scale_x
                    w["y1"] *= scale_y
                    w["x2"] *= scale_x
                    w["y2"] *= scale_y
                return {
                    "walls": ai_walls, "width": aw, "height": ah,
                    "image_path": image_path, "method": "deepfloorplan",
                }

    # Fallback: use PDF vector extraction
    vector_walls = parsed.get("walls", [])
    if vector_walls:
        return {
            "walls": vector_walls, "width": width, "height": height,
            "image_path": image_path, "method": "pdf_vector",
        }

    # Fallback: OpenCV on rendered PNG
    if image_path and os.path.exists(image_path):
        cv_walls = detect_walls_from_image(image_path)
        return {
            "walls": cv_walls, "width": width, "height": height,
            "image_path": image_path, "method": "opencv",
        }

    return {"walls": [], "width": width, "height": height, "image_path": image_path, "method": "none"}


async def _process_cad(file_path: str, file_type: str, upload_dir: str) -> dict:
    """Process DXF/DWG with smart layer-based parsing."""
    parsed = parse_dxf_walls(file_path, file_type)
    walls = parsed.get("walls", [])
    width = parsed.get("width", 1200)
    height = parsed.get("height", 900)
    method = parsed.get("method", "unknown")

    # Generate PNG rendering
    png_path = os.path.join(upload_dir, "floor_raster.png")
    if walls:
        render_walls_to_png(walls, width, height, png_path)
    else:
        # Empty walls — render a placeholder
        import cv2
        img = np.ones((height, width, 3), dtype=np.uint8) * 245
        cv2.putText(img, "No walls detected", (width // 4, height // 2),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.0, (150, 150, 150), 2)
        cv2.imwrite(png_path, img)

    return {
        "walls": walls, "width": width, "height": height,
        "image_path": png_path, "method": f"cad_{method}",
    }


async def _process_image(file_path: str) -> dict:
    """Process raster image: try AI first, fallback to OpenCV."""
    import cv2
    img = cv2.imread(file_path)
    if img is None:
        return {"walls": [], "width": 800, "height": 600, "image_path": file_path, "method": "error"}

    height, width = img.shape[:2]

    # Try DeepFloorplan AI
    ai_walls = await detect_walls_deepfloorplan(file_path)
    if ai_walls and len(ai_walls) >= 4:
        scale_x = width / 512.0
        scale_y = height / 512.0
        for w in ai_walls:
            w["x1"] *= scale_x
            w["y1"] *= scale_y
            w["x2"] *= scale_x
            w["y2"] *= scale_y
        return {
            "walls": ai_walls, "width": width, "height": height,
            "image_path": file_path, "method": "deepfloorplan",
        }

    # Fallback: improved OpenCV
    cv_walls = detect_walls_from_image(file_path)
    return {
        "walls": cv_walls, "width": width, "height": height,
        "image_path": file_path, "method": "opencv",
    }
