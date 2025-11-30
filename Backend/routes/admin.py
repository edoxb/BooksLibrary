from fastapi import APIRouter, HTTPException, Depends
import asyncio
from database import get_database, get_executor
from auth import require_role

router = APIRouter()


@router.get("/admin/stats")
async def get_admin_stats(current_user: dict = Depends(require_role("admin"))):
    """Endpoint riservato agli amministratori - statistiche del sistema"""
    database = get_database()
    executor = get_executor()
    
    if database is None:
        raise HTTPException(status_code=500, detail="Database non connesso")
    
    try:
        loop = asyncio.get_event_loop()
        total_libri = await loop.run_in_executor(
            executor,
            database.libri.count_documents,
            {}
        )
        
        return {
            "total_libri": total_libri,
            "admin": current_user["username"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")


@router.delete("/admin/libri/all")
async def cancella_tutti_libri(current_user: dict = Depends(require_role("admin"))):
    """Endpoint riservato agli amministratori - cancella tutti i libri dal database"""
    database = get_database()
    executor = get_executor()
    
    if database is None:
        raise HTTPException(status_code=500, detail="Database non connesso")
    
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor,
            database.libri.delete_many,
            {}
        )
        
        return {
            "messaggio": "Tutti i libri sono stati cancellati",
            "libri_cancellati": result.deleted_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore: {str(e)}")
