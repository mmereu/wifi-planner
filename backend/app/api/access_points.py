import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..core.database import get_db
from ..models.models import AccessPoint
from ..schemas.schemas import AccessPointCreate, AccessPointResponse

router = APIRouter(tags=["access_points"])

@router.get("/api/floors/{floor_id}/access-points", response_model=list[AccessPointResponse])
async def list_aps(floor_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccessPoint).where(AccessPoint.floor_id == floor_id))
    return result.scalars().all()

@router.post("/api/floors/{floor_id}/access-points", response_model=AccessPointResponse)
async def create_ap_for_floor(floor_id: str, data: AccessPointCreate, db: AsyncSession = Depends(get_db)):
    payload = data.model_dump()
    payload["floor_id"] = floor_id
    ap = AccessPoint(id=str(uuid.uuid4()), **payload)
    db.add(ap)
    await db.commit()
    await db.refresh(ap)
    return ap

@router.post("/api/access-points", response_model=AccessPointResponse)
async def create_ap(data: AccessPointCreate, db: AsyncSession = Depends(get_db)):
    ap = AccessPoint(id=str(uuid.uuid4()), **data.model_dump())
    db.add(ap)
    await db.commit()
    await db.refresh(ap)
    return ap

@router.put("/api/access-points/{ap_id}", response_model=AccessPointResponse)
async def update_ap(ap_id: str, data: AccessPointCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccessPoint).where(AccessPoint.id == ap_id))
    ap = result.scalar_one_or_none()
    if not ap:
        raise HTTPException(404, "AP not found")
    for k, v in data.model_dump().items():
        setattr(ap, k, v)
    await db.commit()
    await db.refresh(ap)
    return ap

@router.delete("/api/access-points/{ap_id}")
async def delete_ap(ap_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AccessPoint).where(AccessPoint.id == ap_id))
    ap = result.scalar_one_or_none()
    if not ap:
        raise HTTPException(404, "AP not found")
    await db.delete(ap)
    await db.commit()
    return {"ok": True}
