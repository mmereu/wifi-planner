from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from .core.database import create_tables
from .core.config import settings
from .api import projects, floors, walls, access_points, shelving_zones

app = FastAPI(title="Hamina Planner", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(floors.router)
app.include_router(walls.router)
app.include_router(access_points.router)
app.include_router(shelving_zones.router, prefix="/api")

os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

@app.on_event("startup")
async def startup():
    await create_tables()

@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}

@app.get("/api")
async def api_root():
    return {"message": "Hamina Planner API", "docs": "/docs"}
