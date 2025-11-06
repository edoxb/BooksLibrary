from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
from bson import ObjectId
from bson.errors import InvalidId
import os
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, ConfigDict
from auth import get_current_user

# Configurazione MongoDB
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://admin:password123@mongodb:27017/bookslibrary?authSource=admin")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "bookslibrary")

# Client MongoDB globale
mongo_client: MongoClient = None
database = None
executor = ThreadPoolExecutor(max_workers=4)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: connetti a MongoDB
    global mongo_client, database
    mongo_client = MongoClient(MONGODB_URL)
    database = mongo_client[MONGODB_DB_NAME]
    
    # Verifica connessione
    try:
        mongo_client.admin.command('ping')
        print("✅ Connesso a MongoDB con successo!")
    except Exception as e:
        print(f"❌ Errore connessione MongoDB: {e}")
    
    yield
    
    # Shutdown: chiudi connessione
    if mongo_client:
        mongo_client.close()
        print("🔌 Connessione MongoDB chiusa")


app = FastAPI(
    title="BooksLibrary API",
    description="API per la gestione di una libreria privata",
    version="1.0.0",
    lifespan=lifespan
)

# Configurazione CORS per permettere comunicazione con frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://frontend:5173"],  # Vite default port e container name
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Modelli Pydantic
class LibroCreate(BaseModel):
    titolo: str = Field(..., description="Titolo del libro")
    data_pubblicazione: date = Field(..., description="Data di pubblicazione")
    autore: str = Field(..., description="Autore del libro")
    genere: str = Field(..., description="Genere del libro")
    sottogenere: Optional[str] = Field(None, description="Sottogenere del libro")
    recensione: Optional[str] = Field(None, description="Recensione del libro")
    commento: Optional[str] = Field(None, description="Commento personale sul libro")
    immagine: Optional[str] = Field(None, description="URL dell'immagine del libro")


class LibroUpdate(BaseModel):
    titolo: Optional[str] = None
    data_pubblicazione: Optional[date] = None
    autore: Optional[str] = None
    genere: Optional[str] = None
    sottogenere: Optional[str] = None
    recensione: Optional[str] = None
    commento: Optional[str] = None
    immagine: Optional[str] = None


class LibroResponse(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True
    )
    
    id: str = Field(..., alias="_id")
    titolo: str
    data_pubblicazione: date
    autore: str
    genere: str
    sottogenere: Optional[str] = None
    recensione: Optional[str] = None
    commento: Optional[str] = None
    immagine: Optional[str] = None


# Funzione helper per convertire ObjectId in stringa e gestire le date
def convert_objectid(doc):
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    # Converti datetime in date se necessario
    if doc and "data_pubblicazione" in doc:
        if isinstance(doc["data_pubblicazione"], datetime):
            doc["data_pubblicazione"] = doc["data_pubblicazione"].date()
        elif isinstance(doc["data_pubblicazione"], str):
            # Se è già una stringa, prova a convertirla
            try:
                doc["data_pubblicazione"] = datetime.fromisoformat(doc["data_pubblicazione"]).date()
            except:
                pass
    return doc


# Endpoint root
@app.get("/")
async def root():
    return {
        "message": "Benvenuto in BooksLibrary API",
        "status": "online",
        "mongodb": "connesso" if mongo_client is not None else "non connesso"
    }


# Endpoint health check
@app.get("/health")
async def health_check():
    """Endpoint per verificare lo stato dell'applicazione e del database"""
    import asyncio
    try:
        if mongo_client is not None:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(executor, mongo_client.admin.command, 'ping')
            db_status = "connesso"
        else:
            db_status = "non connesso"
    except Exception as e:
        db_status = f"errore: {str(e)}"
    
    return {
        "status": "healthy",
        "database": db_status
    }


# Endpoint info database
@app.get("/db/info")
async def db_info():
    """Endpoint per ottenere informazioni sul database"""
    import asyncio
    if database is None:
        return {"error": "Database non connesso"}
    
    try:
        loop = asyncio.get_event_loop()
        collections = await loop.run_in_executor(executor, database.list_collection_names)
        stats = await loop.run_in_executor(executor, database.command, "dbStats")
        
        return {
            "database_name": MONGODB_DB_NAME,
            "collections": collections,
            "stats": {
                "collections": stats.get("collections", 0),
                "dataSize": stats.get("dataSize", 0),
                "storageSize": stats.get("storageSize", 0)
            }
        }
    except Exception as e:
        return {"error": str(e)}


# Endpoint CRUD per i libri

@app.post("/libri", response_model=LibroResponse, status_code=201)
async def crea_libro(libro: LibroCreate, current_user: dict = Depends(get_current_user)):
    """Crea un nuovo libro"""
    import asyncio
    import traceback
    if database is None:
        raise HTTPException(status_code=500, detail="Database non connesso")
    
    try:
        loop = asyncio.get_event_loop()
        libro_dict = libro.model_dump()
        
        # Converti la data in datetime per MongoDB (MongoDB preferisce datetime)
        if "data_pubblicazione" in libro_dict and isinstance(libro_dict["data_pubblicazione"], date):
            libro_dict["data_pubblicazione"] = datetime.combine(libro_dict["data_pubblicazione"], datetime.min.time())
        
        result = await loop.run_in_executor(
            executor,
            database.libri.insert_one,
            libro_dict
        )
        
        # Recupera il libro appena creato
        libro_creato = await loop.run_in_executor(
            executor,
            database.libri.find_one,
            {"_id": result.inserted_id}
        )
        
        if not libro_creato:
            raise HTTPException(status_code=500, detail="Libro creato ma non recuperabile")
        
        # Converti per la risposta
        libro_convertito = convert_objectid(libro_creato)
        
        # Assicurati che _id sia presente come id per Pydantic
        if "_id" in libro_convertito:
            libro_convertito["id"] = libro_convertito["_id"]
        
        # Crea il modello di risposta manualmente per evitare problemi di validazione
        return LibroResponse(**libro_convertito)
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"Errore durante la creazione: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)  # Stampa nel log per debug
        raise HTTPException(status_code=500, detail=f"Errore durante la creazione: {str(e)}")


@app.get("/libri", response_model=List[LibroResponse])
async def lista_libri(current_user: dict = Depends(get_current_user)):
    """Ottieni tutti i libri"""
    import asyncio
    if database is None:
        raise HTTPException(status_code=500, detail="Database non connesso")
    
    try:
        loop = asyncio.get_event_loop()
        libri = await loop.run_in_executor(
            executor,
            lambda: list(database.libri.find())
        )
        
        libri_convertiti = [convert_objectid(libro) for libro in libri]
        # Assicurati che ogni libro abbia id oltre a _id
        for libro in libri_convertiti:
            if "_id" in libro:
                libro["id"] = libro["_id"]
        return [LibroResponse(**libro) for libro in libri_convertiti]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante il recupero: {str(e)}")


@app.get("/libri/{libro_id}", response_model=LibroResponse)
async def ottieni_libro(libro_id: str, current_user: dict = Depends(get_current_user)):
    """Ottieni un libro specifico per ID"""
    import asyncio
    if database is None:
        raise HTTPException(status_code=500, detail="Database non connesso")
    
    try:
        object_id = ObjectId(libro_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID non valido")
    
    try:
        loop = asyncio.get_event_loop()
        libro = await loop.run_in_executor(
            executor,
            database.libri.find_one,
            {"_id": object_id}
        )
        
        if not libro:
            raise HTTPException(status_code=404, detail="Libro non trovato")
        
        libro_convertito = convert_objectid(libro)
        if "_id" in libro_convertito:
            libro_convertito["id"] = libro_convertito["_id"]
        return LibroResponse(**libro_convertito)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante il recupero: {str(e)}")


@app.put("/libri/{libro_id}", response_model=LibroResponse)
async def aggiorna_libro(libro_id: str, libro_update: LibroUpdate, current_user: dict = Depends(get_current_user)):
    """Aggiorna un libro esistente"""
    import asyncio
    if database is None:
        raise HTTPException(status_code=500, detail="Database non connesso")
    
    try:
        object_id = ObjectId(libro_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID non valido")
    
    # Rimuovi i campi None dal dizionario di aggiornamento
    update_data = {k: v for k, v in libro_update.model_dump().items() if v is not None}
    
    if not update_data:
        raise HTTPException(status_code=400, detail="Nessun campo da aggiornare")
    
    # Converti la data in datetime se presente
    if "data_pubblicazione" in update_data and isinstance(update_data["data_pubblicazione"], date):
        update_data["data_pubblicazione"] = datetime.combine(update_data["data_pubblicazione"], datetime.min.time())
    
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor,
            database.libri.update_one,
            {"_id": object_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Libro non trovato")
        
        # Recupera il libro aggiornato
        libro_aggiornato = await loop.run_in_executor(
            executor,
            database.libri.find_one,
            {"_id": object_id}
        )
        
        libro_convertito = convert_objectid(libro_aggiornato)
        if "_id" in libro_convertito:
            libro_convertito["id"] = libro_convertito["_id"]
        return LibroResponse(**libro_convertito)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante l'aggiornamento: {str(e)}")


@app.delete("/libri/{libro_id}", status_code=204)
async def elimina_libro(libro_id: str, current_user: dict = Depends(get_current_user)):
    """Elimina un libro"""
    import asyncio
    if database is None:
        raise HTTPException(status_code=500, detail="Database non connesso")
    
    try:
        object_id = ObjectId(libro_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="ID non valido")
    
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor,
            database.libri.delete_one,
            {"_id": object_id}
        )
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Libro non trovato")
        
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante l'eliminazione: {str(e)}")

