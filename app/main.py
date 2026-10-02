import os
import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import books, circulation, patrons, fines, stats, firebase, auth

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("sonam")

app = FastAPI(
    title="Sonam Institutional Library Management System",
    description="Executive-grade, archival-standard Library Management System with Firebase integration.",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files & templates directories
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

try:
    STATIC_DIR.mkdir(exist_ok=True)
    TEMPLATES_DIR.mkdir(exist_ok=True)
except Exception:
    pass

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

from app.routers import auth, books, circulation, patrons, fines, stats, firebase, supabase

# Mount API Routers
app.include_router(auth.router)
app.include_router(books.router)
app.include_router(circulation.router)
app.include_router(patrons.router)
app.include_router(fines.router)
app.include_router(stats.router)
app.include_router(firebase.router)
app.include_router(supabase.router)

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = TEMPLATES_DIR / "index.html"
    if not index_file.exists():
        return HTMLResponse("<h1>Sonam LMS Initialization in progress...</h1>", status_code=200)
    return FileResponse(index_file)

@app.get("/health")
def health_check():
    return {
        "status": "operational",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
