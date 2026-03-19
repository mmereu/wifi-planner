import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from ..core.database import get_db
from ..models.models import Wall
from ..schemas.schemas import WallCreate, WallResponse

router = APIRouter(tags=["walls"])

@router.get("/api/floors/{floor_id}/walls", response_model=list[WallResponse])
async def list_walls(floor_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Wall).where(Wall.floor_id == floor_id))
    return result.scalars().all()

@router.post("/api/floors/{floor_id}/walls", response_model=WallResponse)
async def create_wall_for_floor(floor_id: str, data: WallCreate, db: AsyncSession = Depends(get_db)):
    payload = data.model_dump()
    payload["floor_id"] = floor_id
    wall = Wall(id=str(uuid.uuid4()), **payload)
    db.add(wall)
    await db.commit()
    await db.refresh(wall)
    return wall

@router.post("/api/walls", response_model=WallResponse)
async def create_wall(data: WallCreate, db: AsyncSession = Depends(get_db)):
    wall = Wall(id=str(uuid.uuid4()), **data.model_dump())
    db.add(wall)
    await db.commit()
    await db.refresh(wall)
    return wall

@router.put("/api/walls/{wall_id}", response_model=WallResponse)
async def update_wall(wall_id: str, data: WallCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Wall).where(Wall.id == wall_id))
    wall = result.scalar_one_or_none()
    if not wall:
        raise HTTPException(404, "Wall not found")
    for k, v in data.model_dump().items():
        setattr(wall, k, v)
    await db.commit()
    await db.refresh(wall)
    return wall

@router.delete("/api/walls/{wall_id}")
async def delete_wall(wall_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Wall).where(Wall.id == wall_id))
    wall = result.scalar_one_or_none()
    if not wall:
        raise HTTPException(404, "Wall not found")
    await db.delete(wall)
    await db.commit()
    return {"ok": True}


@router.delete("/api/wall-groups/{group_id}")
async def delete_wall_group(group_id: str, db: AsyncSession = Depends(get_db)):
    """Delete all walls that belong to a group."""
    await db.execute(delete(Wall).where(Wall.group_id == group_id))
    await db.commit()
    return {"ok": True}
