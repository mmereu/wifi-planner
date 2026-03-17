import os, uuid, shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from ..core.database import get_db
from ..core.config import settings
from ..models.models import Floor, Wall
from ..schemas.schemas import FloorResponse, WallResponse
from ..services.floor_processor import process_floor_file

router = APIRouter(tags=["floors"])


async def ensure_thumbnail_column(db: AsyncSession):
    """Add thumbnail_path column if missing (inline migration)."""
    try:
        await db.execute(text("ALTER TABLE floors ADD COLUMN thumbnail_path VARCHAR(512)"))
        await db.commit()
    except Exception:
        await db.rollback()


@router.get("/api/projects/{project_id}/floors", response_model=list[FloorResponse])
async def list_floors(project_id: str, db: AsyncSession = Depends(get_db)):
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
    )
    db.add(floor)
    await db.commit()
    await db.refresh(floor)
    return floor


@router.post("/api/floors/{floor_id}/process", response_model=list[WallResponse])
async def process_floor(floor_id: str, db: AsyncSession = Depends(get_db)):
    await ensure_thumbnail_column(db)
    result = await db.execute(select(Floor).where(Floor.id == floor_id))
    floor = result.scalar_one_or_none()
    if not floor:
        raise HTTPException(404, "Floor not found")
    if not floor.file_path or not os.path.exists(floor.file_path):
        raise HTTPException(400, "No file uploaded for this floor")

    upload_dir = os.path.dirname(floor.file_path)
    processed = await process_floor_file(floor.file_path, floor.file_type or "png", upload_dir)

    await db.execute(Wall.__table__.delete().where(Wall.floor_id == floor_id))
    walls = []
    for w in processed["walls"]:
        wall = Wall(id=str(uuid.uuid4()), floor_id=floor_id, **w)
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


@router.delete("/api/floors/{floor_id}")
async def delete_floor(floor_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Floor).where(Floor.id == floor_id))
    floor = result.scalar_one_or_none()
    if not floor:
        raise HTTPException(404, "Floor not found")
    await db.delete(floor)
    await db.commit()
    return {"ok": True}
