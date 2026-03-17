from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class FloorCreate(BaseModel):
    name: str
    project_id: str

class FloorResponse(BaseModel):
    id: str
    project_id: str
    name: str
    file_path: Optional[str]
    thumbnail_path: Optional[str]
    file_type: Optional[str]
    width_px: Optional[int]
    height_px: Optional[int]
    scale_factor: float
    processed: bool
    created_at: datetime
    model_config = {"from_attributes": True}

class WallCreate(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    thickness: float = 1.0
    wall_type: str = "concrete"
    attenuation_db: float = 12.0

class WallResponse(BaseModel):
    id: str
    floor_id: str
    x1: float
    y1: float
    x2: float
    y2: float
    thickness: float
    wall_type: str
    attenuation_db: float
    model_config = {"from_attributes": True}

class AccessPointCreate(BaseModel):
    name: str
    model: str = "AP3000"
    x: float
    y: float
    tx_power_dbm: float = 20.0
    frequency_ghz: float = 5.0

class AccessPointResponse(BaseModel):
    id: str
    floor_id: str
    name: str
    model: str
    x: float
    y: float
    tx_power_dbm: float
    frequency_ghz: float
    model_config = {"from_attributes": True}
