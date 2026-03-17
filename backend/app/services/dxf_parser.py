import ezdxf
import numpy as np
import subprocess
import tempfile
import shutil
import os
from typing import List, Dict, Any

def convert_dwg_to_dxf(dwg_path: str) -> str:
    """Convert DWG binary to DXF using dwg2dxf (libredwg). Returns DXF path."""
    dxf_path = dwg_path.replace(".dwg", ".dxf").replace(".DWG", ".dxf")
    try:
        result = subprocess.run(
            ["dwg2dxf", dwg_path, "-o", dxf_path],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0 and os.path.exists(dxf_path):
            return dxf_path
        # Also try without -o flag (outputs to same dir)
        result2 = subprocess.run(
            ["dwg2dxf", dwg_path],
            capture_output=True, text=True, timeout=60, cwd=os.path.dirname(dwg_path)
        )
        # dwg2dxf writes floor.r2000.dxf
        base = os.path.splitext(os.path.basename(dwg_path))[0]
        for candidate in [dxf_path, f"{os.path.dirname(dwg_path)}/{base}.r2000.dxf",
                          f"{os.path.dirname(dwg_path)}/{base}.dxf"]:
            if os.path.exists(candidate):
                return candidate
        return None
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print(f"dwg2dxf failed: {e}")
        return None

def parse_dxf_walls(file_path: str, file_type: str = "dxf") -> List[Dict[str, Any]]:
    """Parse DXF/DWG file and extract wall-like line entities."""
    actual_path = file_path
    
    # Convert DWG to DXF first if needed
    if file_type.lower() == "dwg" or file_path.lower().endswith(".dwg"):
        dxf_path = convert_dwg_to_dxf(file_path)
        if dxf_path:
            actual_path = dxf_path
            print(f"DWG converted to DXF: {dxf_path}")
        else:
            print("DWG conversion failed, returning empty walls")
            return []
    
    try:
        doc = ezdxf.readfile(actual_path)
    except Exception as e:
        try:
            doc, _ = ezdxf.recover.readfile(actual_path)
        except Exception as e2:
            print(f"ezdxf failed: {e} / {e2}")
            return []

    msp = doc.modelspace()
    lines = []

    for entity in msp:
        etype = entity.dxftype()
        try:
            if etype == "LINE":
                s = entity.dxf.start
                e = entity.dxf.end
                lines.append((s.x, s.y, e.x, e.y))
            elif etype in ("LWPOLYLINE", "POLYLINE"):
                pts = list(entity.get_points())
                if not pts:
                    pts = [(v.dxf.location.x, v.dxf.location.y) for v in entity.vertices]
                for i in range(len(pts) - 1):
                    lines.append((pts[i][0], pts[i][1], pts[i+1][0], pts[i+1][1]))
                if hasattr(entity.dxf, "closed") and entity.dxf.closed and len(pts) >= 2:
                    lines.append((pts[-1][0], pts[-1][1], pts[0][0], pts[0][1]))
        except Exception:
            continue

    if not lines:
        return []

    # Normalize to 1200x900 canvas
    xs = [x for x1,y1,x2,y2 in lines for x in (x1,x2)]
    ys = [y for x1,y1,x2,y2 in lines for y in (y1,y2)]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    w = max_x - min_x or 1
    h = max_y - min_y or 1
    scale = min(1200/w, 900/h)

    walls = []
    for x1, y1, x2, y2 in lines:
        nx1 = (x1 - min_x) * scale
        ny1 = (max_y - y1) * scale  # flip Y
        nx2 = (x2 - min_x) * scale
        ny2 = (max_y - y2) * scale
        length = ((nx2-nx1)**2 + (ny2-ny1)**2) ** 0.5
        if length > 2:  # skip tiny segments
            walls.append({
                "x1": round(nx1, 2), "y1": round(ny1, 2),
                "x2": round(nx2, 2), "y2": round(ny2, 2),
                "thickness": 1.0, "wall_type": "concrete", "attenuation_db": 12.0
            })

    print(f"DXF parsed: {len(walls)} walls from {len(lines)} segments")
    return walls
