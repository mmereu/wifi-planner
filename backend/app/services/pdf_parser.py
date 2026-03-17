import fitz  # PyMuPDF
import os
from typing import List
from PIL import Image

RENDER_SCALE = 2.0  # PNG rendered at 2x for quality

def parse_pdf_walls(pdf_path: str, output_dir: str) -> dict:
    """Extract walls from PDF - try vector first, fallback to raster."""
    walls = []
    image_path = None

    try:
        doc = fitz.open(pdf_path)
        page = doc[0]
        paths = page.get_drawings()
        w, h = page.rect.width, page.rect.height

        for path in paths:
            for item in path.get("items", []):
                if item[0] == "l":  # line segment
                    x1, y1 = item[1].x, item[1].y
                    x2, y2 = item[2].x, item[2].y
                    length = ((x2-x1)**2 + (y2-y1)**2) ** 0.5
                    if length > 10:
                        # Scale coords to match PNG rendered at RENDER_SCALE
                        walls.append({
                            "x1": x1 * RENDER_SCALE,
                            "y1": y1 * RENDER_SCALE,
                            "x2": x2 * RENDER_SCALE,
                            "y2": y2 * RENDER_SCALE,
                            "wall_type": "pdf_vector",
                            "attenuation_db": 12.0,
                            "thickness": 1.0,
                        })

        # Always render PNG at 2x
        mat = fitz.Matrix(RENDER_SCALE, RENDER_SCALE)
        pix = page.get_pixmap(matrix=mat)
        image_path = os.path.join(output_dir, "floor_raster.png")
        pix.save(image_path)
        png_w, png_h = pix.width, pix.height

        if not walls:
            doc.close()
            return {"walls": [], "image_path": image_path, "method": "raster",
                    "width": png_w, "height": png_h}

        doc.close()
        return {"walls": walls, "image_path": image_path, "method": "vector",
                "width": png_w, "height": png_h}

    except Exception as e:
        return {"walls": [], "image_path": None, "method": "error", "error": str(e)}
