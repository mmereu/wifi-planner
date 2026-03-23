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
    original_filename: Optional[str] = None
    width_px: Optional[int]
    height_px: Optional[int]
    scale_factor: float
    pixels_per_meter: float
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
    attenuation_5ghz: float = 0.0
    floor_id: Optional[str] = None
    group_id: Optional[str] = None

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
    attenuation_5ghz: float = 0.0
    group_id: Optional[str] = None
    model_config = {"from_attributes": True}

class ShelvingZoneCreate(BaseModel):
    x: float
    y: float
    width: float
    height: float
    zone_type: str = "shelf_full"
    attenuation_db: float = 12.0
    attenuation_5ghz: float = 20.0
    label: Optional[str] = None

class ShelvingZoneResponse(BaseModel):
    id: str
    floor_id: str
    x: float
    y: float
    width: float
    height: float
    zone_type: str
    attenuation_db: float
    attenuation_5ghz: float
    label: Optional[str] = None
    model_config = {"from_attributes": True}

class AccessPointCreate(BaseModel):
    name: str
    model: str = "AP3000"
    x: float
    y: float
    tx_power_dbm: float = 20.0
    frequency_ghz: float = 5.0
    floor_id: Optional[str] = None

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
