from fastapi import APIRouter
import asyncio
from database import get_mongo_client, get_executor, get_database, MONGODB_DB_NAME

router = APIRouter()


@router.get("/")
async def root():
    """Endpoint root"""
    mongo_client = get_mongo_client()
    return {
        "message": "Benvenuto in BooksLibrary API",
        "status": "online",
        "mongodb": "connesso" if mongo_client is not None else "non connesso"
    }


@router.get("/health")
async def health_check():
    """Endpoint per verificare lo stato dell'applicazione e del database"""
    mongo_client = get_mongo_client()
    executor = get_executor()
    
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


@router.get("/db/info")
async def db_info():
    """Endpoint per ottenere informazioni sul database"""
    database = get_database()
    executor = get_executor()
    
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

