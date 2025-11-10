from fastapi import APIRouter, HTTPException, Depends
from typing import List
from bson import ObjectId
from bson.errors import InvalidId
from datetime import date, datetime
import asyncio
import traceback

from models import LibroCreate, LibroUpdate, LibroResponse
from database import get_database, get_executor, convert_objectid
from auth import get_current_user, require_role

router = APIRouter()


@router.post("/libri", response_model=LibroResponse, status_code=201)
async def crea_libro(libro: LibroCreate, current_user: dict = Depends(require_role("admin"))):
    """Crea un nuovo libro"""
    database = get_database()
    executor = get_executor()
    
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
        error_detail = f"Errore durante la creazione: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)  # Stampa nel log per debug
        raise HTTPException(status_code=500, detail=f"Errore durante la creazione: {str(e)}")


@router.get("/libri", response_model=List[LibroResponse])
async def lista_libri(current_user: dict = Depends(get_current_user)):
    """Ottieni tutti i libri"""
    database = get_database()
    executor = get_executor()
    
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


@router.get("/libri/{libro_id}", response_model=LibroResponse)
async def ottieni_libro(libro_id: str, current_user: dict = Depends(get_current_user)):
    """Ottieni un libro specifico per ID"""
    database = get_database()
    executor = get_executor()
    
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


@router.put("/libri/{libro_id}", response_model=LibroResponse)
async def aggiorna_libro(libro_id: str, libro_update: LibroUpdate, current_user: dict = Depends(get_current_user)):
    """Aggiorna un libro esistente"""
    database = get_database()
    executor = get_executor()
    
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


@router.delete("/libri/{libro_id}", status_code=204)
async def elimina_libro(libro_id: str, current_user: dict = Depends(require_role("admin"))):
    """Elimina un libro"""
    database = get_database()
    executor = get_executor()
    
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

