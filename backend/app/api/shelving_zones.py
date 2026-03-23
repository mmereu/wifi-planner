from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from ..core.database import get_db
from ..models.models import ShelvingZone, Floor
from ..schemas.schemas import ShelvingZoneCreate, ShelvingZoneResponse
from typing import List

router = APIRouter()

@router.get("/floors/{floor_id}/shelving-zones", response_model=List[ShelvingZoneResponse])
async def list_shelving_zones(floor_id: str, session: AsyncSession = Depends(get_db)):
    result = await session.execute(
        select(ShelvingZone).where(ShelvingZone.floor_id == floor_id)
    )
    return result.scalars().all()

@router.post("/floors/{floor_id}/shelving-zones", response_model=ShelvingZoneResponse)
async def create_shelving_zone(floor_id: str, data: ShelvingZoneCreate, session: AsyncSession = Depends(get_db)):
    floor = await session.get(Floor, floor_id)
    if not floor:
        raise HTTPException(status_code=404, detail="Floor not found")
    zone = ShelvingZone(floor_id=floor_id, **data.model_dump())
    session.add(zone)
    await session.commit()
    await session.refresh(zone)
    return zone

@router.delete("/shelving-zones/{zone_id}")
async def delete_shelving_zone(zone_id: str, session: AsyncSession = Depends(get_db)):
    zone = await session.get(ShelvingZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    await session.delete(zone)
    await session.commit()
    return {"ok": True}
