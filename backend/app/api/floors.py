import os, uuid, shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from ..core.database import get_db
from ..core.config import settings
from ..models.models import Floor, Wall
from ..schemas.schemas import FloorResponse, WallResponse
from ..services.floor_processor import process_floor_file, render_floor_thumbnail

router = APIRouter(tags=["floors"])


async def ensure_thumbnail_column(db: AsyncSession):
    """Add thumbnail_path column if missing (inline migration)."""
    try:
        await db.execute(text("ALTER TABLE floors ADD COLUMN thumbnail_path VARCHAR(512)"))
        await db.commit()
    except Exception:
        await db.rollback()


async def ensure_new_columns(db: AsyncSession):
    """Add pixels_per_meter, attenuation_5ghz and group_id columns if missing (inline migration)."""
    for stmt in [
        "ALTER TABLE floors ADD COLUMN pixels_per_meter FLOAT DEFAULT 0",
        "ALTER TABLE walls ADD COLUMN attenuation_5ghz FLOAT DEFAULT 0",
        "ALTER TABLE walls ADD COLUMN group_id VARCHAR(36)",
        "ALTER TABLE floors ADD COLUMN original_filename VARCHAR(512)",
    ]:
        try:
            await db.execute(text(stmt))
            await db.commit()
        except Exception:
            await db.rollback()


class ScaleUpdate(BaseModel):
    pixels_per_meter: float


@router.get("/api/projects/{project_id}/floors", response_model=list[FloorResponse])
async def list_floors(project_id: str, db: AsyncSession = Depends(get_db)):
    await ensure_thumbnail_column(db)
    await ensure_new_columns(db)
    result = await db.execute(select(Floor).where(Floor.project_id == project_id))
    return result.scalars().all()


@router.post("/api/projects/{project_id}/floors", response_model=FloorResponse)
async def create_floor(
    project_id: str,
    name: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    await ensure_thumbnail_column(db)
    await ensure_new_columns(db)
    floor_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1].lower().lstrip(".")
    upload_dir = os.path.join(settings.upload_dir, floor_id)
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"floor.{ext}")
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    floor = Floor(
        id=floor_id,
        project_id=project_id,
        name=name,
        file_path=file_path,
        file_type=ext,
        original_filename=file.filename,
    )
    db.add(floor)
    await db.commit()
    await db.refresh(floor)
    return floor


@router.post("/api/floors/{floor_id}/render", response_model=FloorResponse)
async def render_floor(floor_id: str, db: AsyncSession = Depends(get_db)):
    """Generate thumbnail image only — no wall detection."""
    await ensure_thumbnail_column(db)
    await ensure_new_columns(db)
    result = await db.execute(select(Floor).where(Floor.id == floor_id))
    floor = result.scalar_one_or_none()
    if not floor:
        raise HTTPException(404, "Floor not found")
    if not floor.file_path or not os.path.exists(floor.file_path):
        raise HTTPException(400, "No file uploaded for this floor")

    upload_dir = os.path.dirname(floor.file_path)
    rendered = await render_floor_thumbnail(floor.file_path, floor.file_type or "png", upload_dir)

    floor.width_px = rendered.get("width")
    floor.height_px = rendered.get("height")
    if rendered.get("image_path"):
        floor.thumbnail_path = rendered["image_path"]

    await db.commit()
    await db.refresh(floor)
    return floor


@router.post("/api/floors/{floor_id}/process", response_model=list[WallResponse])
async def process_floor(floor_id: str, db: AsyncSession = Depends(get_db)):
    await ensure_thumbnail_column(db)
    await ensure_new_columns(db)
    result = await db.execute(select(Floor).where(Floor.id == floor_id))
    floor = result.scalar_one_or_none()
    if not floor:
        raise HTTPException(404, "Floor not found")
    if not floor.file_path or not os.path.exists(floor.file_path):
        raise HTTPException(400, "No file uploaded for this floor")

    upload_dir = os.path.dirname(floor.file_path)
    processed = await process_floor_file(floor.file_path, floor.file_type or "png", upload_dir)

    await db.execute(Wall.__table__.delete().where(Wall.floor_id == floor_id))
    wall_fields = {"x1", "y1", "x2", "y2", "thickness", "wall_type", "attenuation_db", "group_id"}
    walls = []
    for w in processed["walls"]:
        filtered = {k: v for k, v in w.items() if k in wall_fields}
        wall = Wall(id=str(uuid.uuid4()), floor_id=floor_id, **filtered)
        db.add(wall)
        walls.append(wall)

    floor.processed = True
    floor.width_px = processed.get("width")
    floor.height_px = processed.get("height")
    if processed.get("image_path"):
        floor.thumbnail_path = processed["image_path"]

    await db.commit()
    for wall in walls:
        await db.refresh(wall)
    return walls


@router.put("/api/floors/{floor_id}/scale", response_model=FloorResponse)
async def update_floor_scale(floor_id: str, data: ScaleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Floor).where(Floor.id == floor_id))
    floor = result.scalar_one_or_none()
    if not floor:
        raise HTTPException(404, "Floor not found")
    floor.pixels_per_meter = data.pixels_per_meter
    await db.commit()
    await db.refresh(floor)
    return floor


@router.delete("/api/floors/{floor_id}")
async def delete_floor(floor_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Floor).where(Floor.id == floor_id))
    floor = result.scalar_one_or_none()
    if not floor:
        raise HTTPException(404, "Floor not found")
    await db.delete(floor)
    await db.commit()
    return {"ok": True}
