from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import lifespan_manager
from routes import health, libri, user, admin

app = FastAPI(
    title="BooksLibrary API",
    description="API per la gestione di una libreria privata",
    version="1.0.0",
    lifespan=lifespan_manager
)

# Configurazione CORS per permettere comunicazione con frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://frontend:5173", "http://app.localhost"],  # Vite default port, container name e Traefik
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Includi i router
app.include_router(health.router)
app.include_router(libri.router)
app.include_router(user.router)
app.include_router(admin.router)
