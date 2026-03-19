import uuid
from datetime import datetime
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, Text, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base

def gen_uuid():
    return str(uuid.uuid4())

class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    floors: Mapped[list["Floor"]] = relationship(back_populates="project", cascade="all, delete-orphan")

class Floor(Base):
    __tablename__ = "floors"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(512))
    thumbnail_path: Mapped[str | None] = mapped_column(String(512))
    file_type: Mapped[str | None] = mapped_column(String(20))
    original_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)
    width_px: Mapped[int | None] = mapped_column(Integer)
    height_px: Mapped[int | None] = mapped_column(Integer)
    scale_factor: Mapped[float] = mapped_column(Float, default=1.0)
    pixels_per_meter: Mapped[float] = mapped_column(Float, default=0.0)
    processed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    project: Mapped["Project"] = relationship(back_populates="floors")
    walls: Mapped[list["Wall"]] = relationship(back_populates="floor", cascade="all, delete-orphan")
    access_points: Mapped[list["AccessPoint"]] = relationship(back_populates="floor", cascade="all, delete-orphan")

class Wall(Base):
    __tablename__ = "walls"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    floor_id: Mapped[str] = mapped_column(ForeignKey("floors.id"))
    x1: Mapped[float] = mapped_column(Float)
    y1: Mapped[float] = mapped_column(Float)
    x2: Mapped[float] = mapped_column(Float)
    y2: Mapped[float] = mapped_column(Float)
    thickness: Mapped[float] = mapped_column(Float, default=1.0)
    wall_type: Mapped[str] = mapped_column(String(50), default="concrete")
    attenuation_db: Mapped[float] = mapped_column(Float, default=12.0)
    attenuation_5ghz: Mapped[float] = mapped_column(Float, default=0.0)
    group_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    floor: Mapped["Floor"] = relationship(back_populates="walls")

class AccessPoint(Base):
    __tablename__ = "access_points"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    floor_id: Mapped[str] = mapped_column(ForeignKey("floors.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    model: Mapped[str] = mapped_column(String(100), default="AP3000")
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    tx_power_dbm: Mapped[float] = mapped_column(Float, default=20.0)
    frequency_ghz: Mapped[float] = mapped_column(Float, default=5.0)
    extra: Mapped[dict | None] = mapped_column(JSON)
    floor: Mapped["Floor"] = relationship(back_populates="access_points")
