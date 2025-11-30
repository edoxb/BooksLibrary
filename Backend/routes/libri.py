from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from bson import ObjectId
from bson.errors import InvalidId
from datetime import date, datetime
import asyncio
import traceback
import re
import httpx

from models import LibroCreate, LibroUpdate, LibroResponse
from database import get_database, get_executor, convert_objectid
from auth import get_current_user, require_role

router = APIRouter()


def filter_libro_for_user(libro_dict: Dict[str, Any], current_user: dict) -> Dict[str, Any]:
    """
    Filtra i campi sensibili del libro in base al ruolo dell'utente.
    Il campo 'affittato_da' viene mostrato solo agli admin.
    """
    libro_filtered = libro_dict.copy()
    
    # Se l'utente non è admin, rimuovi il campo affittato_da
    if current_user and "roles" in current_user:
        is_admin = "admin" in current_user["roles"]
        if not is_admin and "affittato_da" in libro_filtered:
            libro_filtered.pop("affittato_da", None)
    else:
        # Se non ci sono informazioni sull'utente, rimuovi il campo per sicurezza
        libro_filtered.pop("affittato_da", None)
    
    return libro_filtered


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
        
        # Converti le date in datetime per MongoDB se sono stringhe
        if "data_restituzione" in libro_dict and libro_dict["data_restituzione"]:
            if isinstance(libro_dict["data_restituzione"], str):
                try:
                    # Gestisce formato datetime-local (YYYY-MM-DDTHH:mm)
                    if 'T' in libro_dict["data_restituzione"]:
                        libro_dict["data_restituzione"] = datetime.fromisoformat(libro_dict["data_restituzione"])
                    else:
                        libro_dict["data_restituzione"] = datetime.fromisoformat(libro_dict["data_restituzione"].replace('Z', '+00:00'))
                except ValueError:
                    # Se la conversione fallisce, rimuovi il campo
                    libro_dict.pop("data_restituzione", None)
        
        if "data_concessione" in libro_dict and libro_dict["data_concessione"]:
            if isinstance(libro_dict["data_concessione"], str):
                try:
                    # Gestisce formato datetime-local (YYYY-MM-DDTHH:mm)
                    if 'T' in libro_dict["data_concessione"]:
                        libro_dict["data_concessione"] = datetime.fromisoformat(libro_dict["data_concessione"])
                    else:
                        libro_dict["data_concessione"] = datetime.fromisoformat(libro_dict["data_concessione"].replace('Z', '+00:00'))
                except ValueError:
                    # Se la conversione fallisce, rimuovi il campo
                    libro_dict.pop("data_concessione", None)
        
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
        
        # Assicurati che i campi opzionali abbiano valori di default
        if "prenotazione" not in libro_convertito:
            libro_convertito["prenotazione"] = True
        if "stato_libro" not in libro_convertito:
            libro_convertito["stato_libro"] = "buono"
        
        # Filtra i campi sensibili in base al ruolo dell'utente
        libro_filtered = filter_libro_for_user(libro_convertito, current_user)
        
        # Crea il modello di risposta manualmente per evitare problemi di validazione
        return LibroResponse(**libro_filtered)
        
    except HTTPException:
        raise
    except Exception as e:
        error_detail = f"Errore durante la creazione: {str(e)}\n{traceback.format_exc()}"
        print(error_detail)  # Stampa nel log per debug
        raise HTTPException(status_code=500, detail=f"Errore durante la creazione: {str(e)}")


@router.get("/libri/search", response_model=List[LibroResponse])
async def cerca_libri(
    q: str = Query(..., min_length=1, description="Testo da cercare"),
    current_user: dict = Depends(get_current_user)
):
    """Cerca libri per titolo, autore, genere, sottogenere, recensione o commento"""
    database = get_database()
    executor = get_executor()
    
    if database is None:
        raise HTTPException(status_code=500, detail="Database non connesso")
    
    try:
        # Crea una regex case-insensitive per la ricerca
        search_regex = re.compile(re.escape(q), re.IGNORECASE)
        
        # Crea la query MongoDB per cercare in tutti i campi testuali
        query = {
            "$or": [
                {"titolo": search_regex},
                {"authors": search_regex},
                {"publisher": search_regex},
                {"categories": search_regex},
                {"language": search_regex},
                {"isbn_10": search_regex}
            ]
        }
        
        loop = asyncio.get_event_loop()
        libri = await loop.run_in_executor(
            executor,
            lambda: list(database.libri.find(query))
        )
        
        libri_convertiti = [convert_objectid(libro) for libro in libri]
        # Assicurati che ogni libro abbia id oltre a _id e valori di default per campi opzionali
        for libro in libri_convertiti:
            if "_id" in libro:
                libro["id"] = libro["_id"]
            # Imposta valori di default per retrocompatibilità
            if "prenotazione" not in libro:
                libro["prenotazione"] = True
            if "stato_libro" not in libro:
                libro["stato_libro"] = "buono"
        
        # Filtra i campi sensibili per ogni libro in base al ruolo dell'utente
        libri_filtered = [filter_libro_for_user(libro, current_user) for libro in libri_convertiti]
        
        return [LibroResponse(**libro) for libro in libri_filtered]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore durante la ricerca: {str(e)}")


@router.get("/libri", response_model=List[LibroResponse])
async def lista_libri(current_user: dict = Depends(get_current_user)):
    """Ottieni tutti i libri - DEPRECATO: usa /libri/search invece"""
    # Non restituire più tutti i libri, restituisci lista vuota
    # per forzare l'uso della ricerca
    return []


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
        
        # Assicurati che i campi opzionali abbiano valori di default
        if "prenotazione" not in libro_convertito:
            libro_convertito["prenotazione"] = True
        if "stato_libro" not in libro_convertito:
            libro_convertito["stato_libro"] = "buono"
        
        # Filtra i campi sensibili in base al ruolo dell'utente
        libro_filtered = filter_libro_for_user(libro_convertito, current_user)
        
        return LibroResponse(**libro_filtered)
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
        
        # Assicurati che i campi opzionali abbiano valori di default
        if "prenotazione" not in libro_convertito:
            libro_convertito["prenotazione"] = True
        if "stato_libro" not in libro_convertito:
            libro_convertito["stato_libro"] = "buono"
        
        # Filtra i campi sensibili in base al ruolo dell'utente
        libro_filtered = filter_libro_for_user(libro_convertito, current_user)
        
        return LibroResponse(**libro_filtered)
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


@router.get("/libri/google-books/search")
async def cerca_google_books(
    q: str = Query(..., min_length=1, description="Testo da cercare su Google Books"),
    current_user: dict = Depends(get_current_user)
):
    """Cerca libri su Google Books API tramite proxy"""
    try:
        url = "https://www.googleapis.com/books/v1/volumes"
        params = {"q": q}
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Errore nella richiesta a Google Books: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Errore sconosciuto: {str(e)}"
        )

